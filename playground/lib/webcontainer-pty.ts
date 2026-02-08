import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import type { PtyCallbacks, PtyConnectOptions, PtyTransport } from "../../src/internal.ts";

type WebContainerPtyOptions = {
  getCommand?: () => string;
  getCwd?: () => string;
  getEnv?: () => Record<string, string>;
  onLog?: (line: string) => void;
};

type CommandSpec = {
  command: string;
  args: string[];
  label: string;
};

let sharedWebContainerPromise: Promise<WebContainer> | null = null;

const WEB_CONTAINER_WELCOME = (() => {
  const ESC = "\x1b";
  const CSI = `${ESC}[`;
  const lines = [
    "",
    `${CSI}1;38;5;81m██████╗ ███████╗███████╗████████╗████████╗██╗   ██╗${CSI}0m`,
    `${CSI}1;38;5;117m██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚══██╔══╝╚██╗ ██╔╝${CSI}0m`,
    `${CSI}1;38;5;153m██████╔╝█████╗  ███████╗   ██║      ██║    ╚████╔╝ ${CSI}0m`,
    `${CSI}1;38;5;189m██╔══██╗██╔══╝  ╚════██║   ██║      ██║     ╚██╔╝  ${CSI}0m`,
    `${CSI}1;38;5;225m██║  ██║███████╗███████║   ██║      ██║      ██║   ${CSI}0m`,
    `${CSI}1;38;5;219m╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝      ╚═╝      ╚═╝   ${CSI}0m`,
    "",
    `${CSI}1mWelcome to restty WebContainer mode${CSI}0m`,
    `GitHub: ${CSI}4;38;5;81mhttps://github.com/wiedymi/restty${CSI}0m`,
    "",
    `${CSI}38;5;117mTry:${CSI}0m node demo.js`,
    `${CSI}38;5;117mTry:${CSI}0m node test.js`,
    `${CSI}38;5;117mTry:${CSI}0m node ansi-art.js`,
    `${CSI}38;5;117mTry:${CSI}0m node animation.js`,
    `${CSI}38;5;117mTry:${CSI}0m node colors.js`,
    `${CSI}38;5;117mTry:${CSI}0m node kitty.js`,
    "",
  ];
  return `${lines.join("\r\n")}\r\n`;
})();

const FALLBACK_DEMO_JS = `#!/usr/bin/env node
console.log("restty demo fallback");
console.log("Run: node ansi-art.js");
console.log("Run: node animation.js");
console.log("Run: node colors.js");
console.log("Run: node kitty.js");
console.log("Run: node test.js");
`;

const FALLBACK_TEST_JS = `#!/usr/bin/env node
console.log("restty test fallback");
console.log("Node is available.");
console.log("Run: node colors.js");
console.log("Run: node kitty.js");
`;

type SeedScriptSpec = {
  urls: string[];
  target: string;
  fallback: string;
};

const seedScripts: SeedScriptSpec[] = [
  {
    urls: ["/demo.js", "/playground/public/demo.js"],
    target: "demo.js",
    fallback: FALLBACK_DEMO_JS,
  },
  {
    urls: ["/test.js", "/playground/public/test.js"],
    target: "test.js",
    fallback: FALLBACK_TEST_JS,
  },
  {
    urls: ["/ansi-art.js", "/playground/public/ansi-art.js"],
    target: "ansi-art.js",
    fallback: "#!/usr/bin/env node\nconsole.log('ansi-art fallback');\n",
  },
  {
    urls: ["/animation.js", "/playground/public/animation.js"],
    target: "animation.js",
    fallback: "#!/usr/bin/env node\nconsole.log('animation fallback');\n",
  },
  {
    urls: ["/colors.js", "/playground/public/colors.js"],
    target: "colors.js",
    fallback: "#!/usr/bin/env node\nconsole.log('colors fallback');\n",
  },
  {
    urls: ["/kitty.js", "/playground/public/kitty.js"],
    target: "kitty.js",
    fallback: "#!/usr/bin/env node\nconsole.log('kitty fallback');\n",
  },
];

async function getSharedWebContainer(): Promise<WebContainer> {
  if (!sharedWebContainerPromise) {
    sharedWebContainerPromise = WebContainer.boot({ coep: "require-corp" });
  }
  return sharedWebContainerPromise;
}

function normalizeFetchedScript(text: string): string | null {
  const noBom = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!noBom) return null;

  const firstNonEmpty =
    noBom
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trimStart() ?? "";
  const lower = firstNonEmpty.toLowerCase();
  if (
    lower.startsWith("<!doctype") ||
    lower.startsWith("<html") ||
    lower.startsWith("<head") ||
    lower.startsWith("<body") ||
    lower.startsWith("<")
  ) {
    return null;
  }

  // Prefer explicit script shebangs; fall back to JS token sniffing.
  if (firstNonEmpty.startsWith("#!")) {
    if (!/\b(node|bun|deno|js)\b/i.test(firstNonEmpty)) return null;
    return `${noBom}\n`;
  }
  if (!/(?:^|\n)\s*(const|let|var|function|import|export)\b/.test(noBom)) return null;
  return `${noBom}\n`;
}

async function fetchScriptText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) return null;
    return normalizeFetchedScript(await res.text());
  } catch {
    return null;
  }
}

async function fetchFirstScript(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    const text = await fetchScriptText(url);
    if (text) return text;
  }
  return null;
}

async function ensureScriptsExecutable(webcontainer: WebContainer): Promise<void> {
  const workdir = webcontainer.workdir;
  const execPaths = [
    "demo.js",
    "test.js",
    "ansi-art.js",
    "animation.js",
    "colors.js",
    "kitty.js",
    `${workdir}/demo.js`,
    `${workdir}/test.js`,
    `${workdir}/ansi-art.js`,
    `${workdir}/animation.js`,
    `${workdir}/colors.js`,
    `${workdir}/kitty.js`,
  ];
  const chmodViaNode = await webcontainer.spawn("node", [
    "-e",
    [
      "const fs = require('node:fs');",
      "const paths = process.argv.slice(1);",
      "let touched = false;",
      "let ok = true;",
      "for (const p of paths) {",
      "  try {",
      "    if (!fs.existsSync(p)) continue;",
      "    touched = true;",
      "    const mode = fs.statSync(p).mode | 0o111;",
      "    fs.chmodSync(p, mode);",
      "    fs.accessSync(p, fs.constants.X_OK);",
      "  } catch {",
      "    ok = false;",
      "  }",
      "}",
      "if (!touched || !ok) process.exit(1);",
    ].join(" "),
    ...execPaths,
  ]);

  const nodeCode = await chmodViaNode.exit.catch(() => 1);
  if (nodeCode === 0) return;

  const chmod = await webcontainer.spawn("chmod", [
    "+x",
    "demo.js",
    "test.js",
    "ansi-art.js",
    "animation.js",
    "colors.js",
    "kitty.js",
  ]);
  const chmodCode = await chmod.exit.catch(() => 1);
  if (chmodCode !== 0) {
    throw new Error("Failed to set executable permissions for node demo scripts");
  }
}

async function removeLegacyShellScripts(webcontainer: WebContainer): Promise<void> {
  const workdir = webcontainer.workdir;
  const legacyPaths = ["demo.sh", "test.sh", `${workdir}/demo.sh`, `${workdir}/test.sh`];
  const cleanup = await webcontainer.spawn("node", [
    "-e",
    [
      "const fs = require('node:fs');",
      "for (const p of process.argv.slice(1)) {",
      "  try {",
      "    fs.rmSync(p, { force: true });",
      "  } catch {",
      "    // ignore cleanup failures",
      "  }",
      "}",
    ].join(" "),
    ...legacyPaths,
  ]);
  await cleanup.exit.catch(() => 1);
}

async function ensureSeedScripts(webcontainer: WebContainer): Promise<void> {
  await removeLegacyShellScripts(webcontainer);
  for (const spec of seedScripts) {
    const text = await fetchFirstScript(spec.urls);
    await webcontainer.fs.writeFile(spec.target, text ?? spec.fallback);
  }
  await ensureScriptsExecutable(webcontainer);
}

function parseCommand(spec: string): CommandSpec {
  const tokens = spec.match(/(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\\.|\S)+/g) ?? [];
  const cleaned = tokens.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }
    return token.replace(/\\(.)/g, "$1");
  });
  return {
    command: cleaned[0] ?? "",
    args: cleaned.slice(1),
    label: cleaned.join(" "),
  };
}

function normalizeCwd(cwd: string | undefined): string | undefined {
  if (!cwd) return undefined;
  const trimmed = cwd.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("/")) return undefined;
  return trimmed;
}

export function createWebContainerPtyTransport(options: WebContainerPtyOptions = {}): PtyTransport {
  let proc: WebContainerProcess | null = null;
  let callbacks: PtyCallbacks | null = null;
  let inputWriter: WritableStreamDefaultWriter<string> | null = null;
  let outputReader: ReadableStreamDefaultReader<string> | null = null;
  let connected = false;
  let connectionToken = 0;
  let activeCommand = "";

  const log = (line: string) => {
    options.onLog?.(`[webcontainer] ${line}`);
  };

  const resetStreams = () => {
    try {
      inputWriter?.releaseLock();
    } catch {
      // ignore release failures
    }
    try {
      outputReader?.releaseLock();
    } catch {
      // ignore release failures
    }
    inputWriter = null;
    outputReader = null;
  };

  const stopProcess = (emitDisconnect: boolean) => {
    const cb = callbacks;
    callbacks = null;
    connected = false;
    connectionToken += 1;
    activeCommand = "";

    try {
      outputReader?.cancel();
    } catch {
      // ignore reader cancel failures
    }
    resetStreams();

    if (proc) {
      try {
        proc.kill();
      } catch {
        // ignore kill failures
      }
      proc = null;
    }

    if (emitDisconnect) cb?.onDisconnect?.();
  };

  const handleConnectError = (cb: PtyCallbacks, err: unknown) => {
    connected = false;
    proc = null;
    resetStreams();
    const message = err instanceof Error ? err.message : String(err);
    cb.onError?.("Failed to start WebContainer process", [message]);
    cb.onDisconnect?.();
  };

  const startOutputPump = (token: number, cb: PtyCallbacks) => {
    const reader = outputReader;
    if (!reader) return;

    void (async () => {
      try {
        while (connectionToken === token) {
          const { value, done } = await reader.read();
          if (done || connectionToken !== token) break;
          if (value) cb.onData?.(value);
        }
      } catch (err) {
        if (connectionToken !== token) return;
        const message = err instanceof Error ? err.message : String(err);
        cb.onError?.("WebContainer output stream failed", [message]);
      }
    })();
  };

  const mapInputForCommand = (data: string): string => {
    if (activeCommand === "jsh") {
      // jsh line editing expects ^H for backward erase and does not reliably
      // handle DEL in this bridge path.
      if (data === "\x7f") return "\x08";
    }
    return data;
  };

  return {
    connect: async ({ cols = 80, rows = 24, callbacks: cb }: PtyConnectOptions) => {
      stopProcess(false);
      callbacks = cb;
      const token = connectionToken;

      const commandRaw = options.getCommand?.().trim() || "jsh";
      const spec = parseCommand(commandRaw);
      if (!spec.command) {
        cb.onError?.("Missing command", [
          "Provide a shell command for WebContainer (for example: jsh)",
        ]);
        cb.onDisconnect?.();
        return;
      }

      try {
        const webcontainer = await getSharedWebContainer();
        if (connectionToken !== token) return;
        await ensureSeedScripts(webcontainer);
        if (connectionToken !== token) return;

        const cwd = normalizeCwd(options.getCwd?.());
        const env = {
          TERM: "xterm-256color",
          COLORTERM: "truecolor",
          COLUMNS: String(cols),
          LINES: String(rows),
          ...options.getEnv?.(),
        };
        const spawned = await webcontainer.spawn(spec.command, spec.args, {
          terminal: { cols, rows },
          cwd,
          env,
        });

        if (connectionToken !== token) {
          try {
            spawned.kill();
          } catch {
            // ignore kill errors
          }
          return;
        }

        proc = spawned;
        activeCommand = spec.command;
        inputWriter = spawned.input.getWriter();
        outputReader = spawned.output.getReader();
        connected = true;

        cb.onConnect?.();
        cb.onStatus?.(spec.label || spec.command);
        log(`connected (${spec.label || spec.command})`);
        if (spec.command === "jsh") {
          cb.onData?.(WEB_CONTAINER_WELCOME);
        }

        startOutputPump(token, cb);

        void spawned.exit
          .then((code) => {
            if (connectionToken !== token) return;
            connected = false;
            proc = null;
            resetStreams();
            cb.onExit?.(code);
            cb.onDisconnect?.();
          })
          .catch((err) => {
            if (connectionToken !== token) return;
            connected = false;
            proc = null;
            resetStreams();
            const message = err instanceof Error ? err.message : String(err);
            cb.onError?.("WebContainer process exited with error", [message]);
            cb.onDisconnect?.();
          });
      } catch (err) {
        handleConnectError(cb, err);
      }
    },
    disconnect: () => {
      if (!proc && !connected) return;
      stopProcess(true);
      log("disconnected");
    },
    sendInput: (data: string) => {
      if (!connected || !inputWriter) return false;
      const payload = mapInputForCommand(data);
      void inputWriter.write(payload).catch(() => {
        // ignore async write failures here; lifecycle callbacks handle disconnect
      });
      return true;
    },
    resize: (cols: number, rows: number) => {
      if (!connected || !proc) return false;
      try {
        proc.resize({ cols, rows });
        return true;
      } catch {
        return false;
      }
    },
    isConnected: () => connected,
    destroy: () => {
      stopProcess(false);
    },
  };
}

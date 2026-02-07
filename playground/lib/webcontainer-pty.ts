import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import type { PtyCallbacks, PtyConnectOptions, PtyTransport } from "../../src/index.ts";

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
let sharedSeedPromise: Promise<void> | null = null;

const FALLBACK_DEMO_SCRIPT = `#!/usr/bin/env sh
set -eu
ESC=$(printf '\\033')
CSI="\${ESC}["
printf '%s?25l%s2J%sH' "\$CSI" "\$CSI" "\$CSI"
printf 'restty demo fallback\\n\\n'
i=0
while [ "\$i" -le 20 ]; do
  pct=\$(( i * 100 / 20 ))
  printf '\\rloading... %3s%%' "\$pct"
  sleep 0.03
  i=\$((i + 1))
done
printf '\\n\\n'
printf '%s1mstyles:%s0m %s1mBold%s0m %s3mItalic%s0m\\n' "\$CSI" "\$CSI" "\$CSI" "\$CSI" "\$CSI" "\$CSI"
printf '%s1mtruecolor:%s0m %s38;2;255;100;0mOrange%s0m\\n' "\$CSI" "\$CSI" "\$CSI" "\$CSI"
printf '\\nrun ./test.sh for static checks.\\n'
printf '%s0m%s?25h\\n' "\$CSI" "\$CSI"
`;

const FALLBACK_TEST_SCRIPT = `#!/usr/bin/env sh
set -eu
ESC=$(printf '\\033')
CSI="\${ESC}["
printf '%s?25l%s2J%sH' "\$CSI" "\$CSI" "\$CSI"
printf 'restty quick test\\n\\n'
printf '%s1mBold%s0m %s3mItalic%s0m %s4mUnderline%s0m\\n' "\$CSI" "\$CSI" "\$CSI" "\$CSI" "\$CSI" "\$CSI"
printf '%s38;2;255;100;0mOrange%s0m %s38;2;120;200;255mSky%s0m\\n\\n' "\$CSI" "\$CSI" "\$CSI" "\$CSI"
printf 'Done.\\n'
printf '%s0m%s?25h\\n' "\$CSI" "\$CSI"
`;

type SeedScriptSpec = {
  urls: string[];
  target: string;
  fallback: string;
};

const seedScripts: SeedScriptSpec[] = [
  {
    urls: ["/playground/public/demo.sh", "/demo.sh"],
    target: "demo.sh",
    fallback: FALLBACK_DEMO_SCRIPT,
  },
  {
    urls: ["/playground/public/test.sh", "/test.sh"],
    target: "test.sh",
    fallback: FALLBACK_TEST_SCRIPT,
  },
];

async function getSharedWebContainer(): Promise<WebContainer> {
  if (!sharedWebContainerPromise) {
    sharedWebContainerPromise = WebContainer.boot({ coep: "require-corp" });
  }
  return sharedWebContainerPromise;
}

async function fetchScriptText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    return text.trim().length > 0 ? text : null;
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
  const execPaths = ["demo.sh", "test.sh", `${workdir}/demo.sh`, `${workdir}/test.sh`];
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

  const chmod = await webcontainer.spawn("chmod", ["+x", "demo.sh", "test.sh"]);
  const chmodCode = await chmod.exit.catch(() => 1);
  if (chmodCode !== 0) {
    throw new Error("Failed to set executable permissions for demo scripts");
  }
}

async function ensureSeedScripts(webcontainer: WebContainer): Promise<void> {
  if (!sharedSeedPromise) {
    sharedSeedPromise = (async () => {
      for (const spec of seedScripts) {
        const text = await fetchFirstScript(spec.urls);
        await webcontainer.fs.writeFile(spec.target, text ?? spec.fallback);
      }
    })().catch((err) => {
      sharedSeedPromise = null;
      throw err;
    });
  }
  await sharedSeedPromise;
  await ensureScriptsExecutable(webcontainer);
}

function parseCommand(spec: string): CommandSpec {
  const tokens = spec.match(/(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\\.|\S)+/g) ?? [];
  const cleaned = tokens.map((token) => {
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
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
        cb.onError?.("Missing command", ["Provide a shell command for WebContainer (for example: jsh)"]);
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

import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import type {
  PtyCallbacks,
  PtyConnectOptions,
  PtyResizeMeta,
  PtyTransport,
} from "../../src/index.ts";
import { ensureWebContainerSeedScripts } from "./webcontainer-seed-scripts.ts";

type WebContainerPtyOptions = {
  getCommand?: () => string;
  getCwd?: () => string;
  getEnv?: () => Record<string, string>;
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
  const OSC = `${ESC}]`;
  const ST = `${ESC}\\`;
  const githubUrl = "https://github.com/wiedymi/restty";
  const githubLabel = `${CSI}4;38;5;81m${githubUrl}${CSI}0m`;
  const githubLink = `${OSC}8;;${githubUrl}${ST}${githubLabel}${OSC}8;;${ST}`;
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
    `GitHub: ${githubLink}`,
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

async function getSharedWebContainer(): Promise<WebContainer> {
  if (!sharedWebContainerPromise) {
    sharedWebContainerPromise = WebContainer.boot({ coep: "require-corp" });
  }
  return sharedWebContainerPromise;
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
        await ensureWebContainerSeedScripts(webcontainer);
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
    },
    sendInput: (data: string) => {
      if (!connected || !inputWriter) return false;
      const payload = mapInputForCommand(data);
      void inputWriter.write(payload).catch(() => {
        // ignore async write failures here; lifecycle callbacks handle disconnect
      });
      return true;
    },
    resize: (cols: number, rows: number, _meta?: PtyResizeMeta) => {
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

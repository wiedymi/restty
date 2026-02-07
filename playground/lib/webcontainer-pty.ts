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

async function getSharedWebContainer(): Promise<WebContainer> {
  if (!sharedWebContainerPromise) {
    sharedWebContainerPromise = WebContainer.boot({ coep: "require-corp" });
  }
  return sharedWebContainerPromise;
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

        const cwd = normalizeCwd(options.getCwd?.());
        const env = options.getEnv?.();
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
      void inputWriter.write(data).catch(() => {
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

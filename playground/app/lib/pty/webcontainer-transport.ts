import type { PtyConnectOptions, PtyResizeMeta, PtyTransport } from "../../../../src/index.ts";
import { PLAYGROUND_SHELL_WELCOME } from "./playground-shell-scripts.ts";
import { launchWebContainerCommand, parseWebContainerCommand } from "./webcontainer-launch.ts";
import { createWebContainerProcessController } from "./webcontainer-process.ts";

type WebContainerPtyOptions = {
  getCommand?: () => string;
  getCwd?: () => string;
  getEnv?: () => Record<string, string>;
};

export function createWebContainerPtyTransport(options: WebContainerPtyOptions = {}): PtyTransport {
  let connectionToken = 0;
  let activeCommand = "";
  const processController = createWebContainerProcessController();

  const stopProcess = (emitDisconnect: boolean) => {
    connectionToken += 1;
    activeCommand = "";
    processController.stop(emitDisconnect);
  };

  const mapInputForCommand = (data: string): string => {
    if (activeCommand === "jsh" && data === "\x7f") return "\x08";
    return data;
  };

  return {
    connect: async ({ cols = 80, rows = 24, callbacks: cb }: PtyConnectOptions) => {
      stopProcess(false);
      const token = connectionToken;

      const commandRaw = options.getCommand?.().trim() || "jsh";
      const spec = parseWebContainerCommand(commandRaw);
      if (!spec.command) {
        cb.onError?.("Missing command", [
          "Provide a shell command for WebContainer, for example: jsh",
        ]);
        cb.onDisconnect?.();
        return;
      }

      try {
        const spawned = await launchWebContainerCommand({
          cols,
          rows,
          spec,
          cwd: options.getCwd?.(),
          env: options.getEnv?.(),
          isTokenActive: () => connectionToken === token,
        });
        if (!spawned) return;

        activeCommand = spec.command;
        processController.attachProcess({
          callbacks: cb,
          isTokenActive: (currentToken) => connectionToken === currentToken,
          process: spawned,
          statusLabel: spec.label || spec.command,
          token,
          welcomeData: spec.command === "jsh" ? PLAYGROUND_SHELL_WELCOME : undefined,
        });
      } catch (err) {
        processController.handleConnectError(cb, err);
      }
    },
    disconnect: () => {
      if (!processController.isConnected()) return;
      stopProcess(true);
    },
    sendInput: (data: string) => {
      return processController.sendInput(data, mapInputForCommand);
    },
    resize: (cols: number, rows: number, _meta?: PtyResizeMeta) => {
      return processController.resize(cols, rows);
    },
    isConnected: processController.isConnected,
    destroy: () => {
      stopProcess(false);
    },
  };
}

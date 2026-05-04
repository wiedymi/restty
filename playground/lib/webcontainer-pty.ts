import type { PtyConnectOptions, PtyResizeMeta, PtyTransport } from "../../src/index.ts";
import { launchWebContainerCommand, parseWebContainerCommand } from "./webcontainer-launch.ts";
import { createWebContainerProcessController } from "./webcontainer-process.ts";

type WebContainerPtyOptions = {
  getCommand?: () => string;
  getCwd?: () => string;
  getEnv?: () => Record<string, string>;
};

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
      const token = connectionToken;

      const commandRaw = options.getCommand?.().trim() || "jsh";
      const spec = parseWebContainerCommand(commandRaw);
      if (!spec.command) {
        cb.onError?.("Missing command", [
          "Provide a shell command for WebContainer (for example: jsh)",
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
          welcomeData: spec.command === "jsh" ? WEB_CONTAINER_WELCOME : undefined,
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

import { listenShellCommand } from "./shell-bridge.ts";
import { restoreTerminalFocus, type SettingsDialogHost } from "./settings-dialog.ts";

type TargetLike = Pick<EventTarget, "addEventListener" | "removeEventListener">;

type Disposer = () => void;

export function bindSettingsShellEffects(options: {
  target: Window & TargetLike;
  host: SettingsDialogHost;
}): Disposer {
  return listenShellCommand(options.target, (detail) => {
    switch (detail?.command) {
      case "settings-open":
        options.host.hideContextMenu();
        break;
      case "settings-close":
        restoreTerminalFocus(options.host);
        break;
    }
  });
}

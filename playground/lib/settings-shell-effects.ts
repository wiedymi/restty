import { listenShellCommand } from "./shell-bridge.ts";

type TargetLike = Pick<EventTarget, "addEventListener" | "removeEventListener">;

type Disposer = () => void;

export function bindSettingsShellEffects(options: {
  target: Window & TargetLike;
  onOpen: () => void;
  onClose: () => void;
}): Disposer {
  return listenShellCommand(options.target, (detail) => {
    switch (detail?.command) {
      case "settings-open":
        options.onOpen();
        break;
      case "settings-close":
        options.onClose();
        break;
    }
  });
}

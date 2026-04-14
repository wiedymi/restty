import { dispatchConnectionState, dispatchThemeFileReset } from "./shell-bridge.ts";
import type { ConnectionStateDetail } from "./shell-events.ts";
import { restoreTerminalFocus, type SettingsDialogHost } from "./settings-dialog.ts";

type CreatePlaygroundShellEffectsOptions = {
  target: EventTarget;
};

export function createPlaygroundShellEffects({ target }: CreatePlaygroundShellEffectsOptions) {
  return {
    resetThemeFileInput() {
      dispatchThemeFileReset(target);
    },
    syncConnectionState(detail: ConnectionStateDetail) {
      dispatchConnectionState(detail, target);
    },
    openSettings(host: SettingsDialogHost) {
      host.hideContextMenu();
    },
    closeSettings(host: SettingsDialogHost) {
      restoreTerminalFocus(host);
    },
  };
}

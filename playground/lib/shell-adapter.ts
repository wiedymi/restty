import { createPlaygroundShellEffects } from "./shell-effects.ts";
import {
  isSettingsDialogOpen,
  type SettingsDialogElement,
  type SettingsDialogHost,
} from "./settings-dialog.ts";
import type { ConnectionStateDetail } from "./shell-events.ts";

type CreatePlaygroundShellAdapterOptions = {
  target: EventTarget;
  settingsDialog: SettingsDialogElement;
};

export function createPlaygroundShellAdapter(options: CreatePlaygroundShellAdapterOptions) {
  const shellEffects = createPlaygroundShellEffects({
    target: options.target,
  });

  return {
    isSettingsDialogOpen: () => isSettingsDialogOpen(options.settingsDialog),
    resetThemeFileInput() {
      shellEffects.resetThemeFileInput();
    },
    syncConnectionState(detail: ConnectionStateDetail) {
      shellEffects.syncConnectionState(detail);
    },
    openSettings(host: SettingsDialogHost) {
      shellEffects.openSettings(host);
    },
    closeSettings(host: SettingsDialogHost) {
      shellEffects.closeSettings(host);
    },
  };
}

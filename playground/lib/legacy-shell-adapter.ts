import { syncConnectionUi } from "./pty-connection.ts";
import {
  closeSettingsDialog,
  isSettingsDialogOpen,
  openSettingsDialog,
  type SettingsDialogElement,
  type SettingsDialogHost,
} from "./settings-dialog.ts";
import type { ConnectionStateDetail } from "./shell-events.ts";

type ConnectionUiElements = {
  connectionBackendEl: HTMLSelectElement | null;
  ptyUrlInput: HTMLInputElement | null;
  wcCommandInput: HTMLInputElement | null;
  wcCwdInput: HTMLInputElement | null;
  connectionHintEl: HTMLElement | null;
};

type CreateLegacyPlaygroundShellAdapterOptions = {
  themeFileInput: HTMLInputElement | null;
  settingsDialog: SettingsDialogElement;
  connectionUi: ConnectionUiElements;
  syncConnectionUi?: typeof syncConnectionUi;
};

export function createLegacyPlaygroundShellAdapter({
  themeFileInput,
  settingsDialog,
  connectionUi,
  syncConnectionUi: syncConnectionUiImpl = syncConnectionUi,
}: CreateLegacyPlaygroundShellAdapterOptions) {
  return {
    resetThemeFileInput() {
      if (themeFileInput) {
        themeFileInput.value = "";
      }
    },
    syncConnectionState(_detail: ConnectionStateDetail) {
      syncConnectionUiImpl(connectionUi);
    },
    openSettings(host: SettingsDialogHost) {
      openSettingsDialog({ host, settingsDialog });
    },
    closeSettings(host: SettingsDialogHost) {
      if (!isSettingsDialogOpen(settingsDialog)) return;
      closeSettingsDialog({ host, settingsDialog });
    },
    isSettingsDialogOpen() {
      return isSettingsDialogOpen(settingsDialog);
    },
  };
}

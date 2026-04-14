import { syncConnectionUi } from "./pty-connection.ts";
import { dispatchConnectionState, dispatchThemeFileReset } from "./shell-bridge.ts";
import {
  closeSettingsDialog,
  isSettingsDialogOpen,
  openSettingsDialog,
  restoreTerminalFocus,
  type SettingsDialogElement,
  type SettingsDialogHost,
} from "./settings-dialog.ts";
import { type ConnectionStateDetail } from "./shell-events.ts";

type ConnectionUiElements = {
  connectionBackendEl: HTMLSelectElement | null;
  ptyUrlInput: HTMLInputElement | null;
  wcCommandInput: HTMLInputElement | null;
  wcCwdInput: HTMLInputElement | null;
  connectionHintEl: HTMLElement | null;
};

type CreatePlaygroundShellAdapterOptions = {
  usesSvelteShell: boolean;
  target: EventTarget;
  themeFileInput: HTMLInputElement | null;
  settingsDialog: SettingsDialogElement;
  connectionUi: ConnectionUiElements;
  syncConnectionUi?: typeof syncConnectionUi;
};

export function createPlaygroundShellAdapter({
  usesSvelteShell,
  target,
  themeFileInput,
  settingsDialog,
  connectionUi,
  syncConnectionUi: syncConnectionUiImpl = syncConnectionUi,
}: CreatePlaygroundShellAdapterOptions) {
  function resetThemeFileInput() {
    if (usesSvelteShell) {
      dispatchThemeFileReset(target);
      return;
    }
    if (themeFileInput) {
      themeFileInput.value = "";
    }
  }

  function syncConnectionState(detail: ConnectionStateDetail) {
    if (usesSvelteShell) {
      dispatchConnectionState(detail, target);
      return;
    }
    syncConnectionUiImpl(connectionUi);
  }

  function openSettings(host: SettingsDialogHost) {
    if (usesSvelteShell) {
      host.hideContextMenu();
      return;
    }
    openSettingsDialog({ host, settingsDialog });
  }

  function closeSettings(host: SettingsDialogHost) {
    if (usesSvelteShell) {
      restoreTerminalFocus(host);
      return;
    }
    if (!isSettingsDialogOpen(settingsDialog)) return;
    closeSettingsDialog({ host, settingsDialog });
  }

  return {
    usesSvelteShell,
    isSettingsDialogOpen: () => isSettingsDialogOpen(settingsDialog),
    resetThemeFileInput,
    syncConnectionState,
    openSettings,
    closeSettings,
  };
}

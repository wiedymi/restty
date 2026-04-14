import { createLegacyPlaygroundShellAdapter } from "./legacy-shell-adapter.ts";
import { createPlaygroundShellEffects } from "./shell-effects.ts";
import {
  isSettingsDialogOpen,
  type SettingsDialogElement,
  type SettingsDialogHost,
} from "./settings-dialog.ts";

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
  syncConnectionUi?: typeof import("./pty-connection.ts").syncConnectionUi;
};

export function createPlaygroundShellAdapter(options: CreatePlaygroundShellAdapterOptions) {
  const adapter = options.usesSvelteShell
    ? createPlaygroundShellEffects({
        target: options.target,
      })
    : createLegacyPlaygroundShellAdapter({
        themeFileInput: options.themeFileInput,
        settingsDialog: options.settingsDialog,
        connectionUi: options.connectionUi,
        syncConnectionUi: options.syncConnectionUi,
      });

  return {
    usesSvelteShell: options.usesSvelteShell,
    isSettingsDialogOpen: () => isSettingsDialogOpen(options.settingsDialog),
    resetThemeFileInput() {
      adapter.resetThemeFileInput();
    },
    syncConnectionState(detail: import("./shell-events.ts").ConnectionStateDetail) {
      adapter.syncConnectionState(detail);
    },
    openSettings(host: SettingsDialogHost) {
      adapter.openSettings(host);
    },
    closeSettings(host: SettingsDialogHost) {
      adapter.closeSettings(host);
    },
  };
}

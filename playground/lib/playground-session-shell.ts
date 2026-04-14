import { Restty } from "../../src/index.ts";
import { createPaneAppearanceController } from "./appearance-controller.ts";
import { createConnectionController } from "./connection-controller.ts";
import { createPaneShellSync } from "./pane-shell-sync.ts";
import { createPlaygroundShellEffects } from "./shell-effects.ts";
import type { ConnectionStateDetail } from "./shell-events.ts";
import { isSettingsDialogOpen } from "./settings-dialog.ts";

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;
type PlaygroundWindow = Window & typeof globalThis;

type CreatePlaygroundSessionShellOptions = {
  window: PlaygroundWindow;
  settingsDialog: HTMLDialogElement | null;
  getActivePane: () => ManagedPane | null;
  getConnectionController: () => ReturnType<typeof createConnectionController>;
  getAppearanceController: () => ReturnType<typeof createPaneAppearanceController>;
};

export type PlaygroundSessionShell = {
  isSettingsDialogOpen: () => boolean;
  openSettings: ReturnType<typeof createPlaygroundShellEffects>["openSettings"];
  closeSettings: ReturnType<typeof createPlaygroundShellEffects>["closeSettings"];
  resetThemeFileInput: ReturnType<typeof createPlaygroundShellEffects>["resetThemeFileInput"];
  syncConnectionState: ReturnType<typeof createPlaygroundShellEffects>["syncConnectionState"];
  paneShellSync: ReturnType<typeof createPaneShellSync>;
  getConnectionShellStateDetail: () => ConnectionStateDetail;
};

export function createPlaygroundSessionShell({
  window,
  settingsDialog,
  getActivePane,
  getConnectionController,
  getAppearanceController,
}: CreatePlaygroundSessionShellOptions): PlaygroundSessionShell {
  function getPtyButtonLabel() {
    const pane = getActivePane();
    if (pane?.runtime.io.isPtyConnected()) return "Disconnect";
    return getConnectionController().getBackend() === "webcontainer"
      ? "Start WebContainer"
      : "Connect PTY";
  }

  function getConnectionShellStateDetail(): ConnectionStateDetail {
    const connectionController = getConnectionController();

    return {
      backend: connectionController.getBackend(),
      ptyUrl: connectionController.getPtyUrl(),
      ptyButtonLabel: getPtyButtonLabel(),
      webContainerCommand: connectionController.getWebContainerCommand(),
      webContainerCwd: connectionController.getWebContainerCwd(),
    };
  }

  const shellEffects = createPlaygroundShellEffects({
    target: window,
  });

  const paneShellSync = createPaneShellSync({
    target: window,
    getSelectedConnectionBackend: () => getConnectionController().getBackend(),
    getSelectedFontFamily: () => getAppearanceController().getFontFamily(),
    getSelectedLocalFontMatcher: () => getAppearanceController().getLocalFontMatcher(),
    getDetectedLocalFontOptions: () => getAppearanceController().getDetectedLocalFontOptions(),
    getLocalFontHintText: () => getAppearanceController().getLocalFontHintText(),
    getSelectedLigatures: () => getAppearanceController().getLigatures(),
    getSelectedFontHinting: () => getAppearanceController().getFontHinting(),
    getSelectedFontHintTarget: () => getAppearanceController().getFontHintTarget(),
    getSelectedShaderPreset: () => getAppearanceController().getShaderPreset(),
    syncSelectedDefaults: (state) => {
      getAppearanceController().syncTerminalDefaultsFromState(state);
    },
  });

  return {
    isSettingsDialogOpen: () => isSettingsDialogOpen(settingsDialog),
    openSettings: shellEffects.openSettings,
    closeSettings: shellEffects.closeSettings,
    resetThemeFileInput: shellEffects.resetThemeFileInput,
    syncConnectionState: shellEffects.syncConnectionState,
    paneShellSync,
    getConnectionShellStateDetail,
  };
}

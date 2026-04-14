import { Restty } from "../../src/index.ts";
import { createPaneAppearanceController } from "./appearance-controller.ts";
import { createConnectionController } from "./connection-controller.ts";
import { createPaneShellSync } from "./pane-shell-sync.ts";
import {
  dispatchConnectionState,
  dispatchThemeFileReset,
  listenShellCommand,
} from "./shell-bridge.ts";
import type { ConnectionStateDetail } from "./shell-events.ts";

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;
type PlaygroundWindow = Window & typeof globalThis;

type CreatePlaygroundSessionShellOptions = {
  window: PlaygroundWindow;
  getActivePane: () => ManagedPane | null;
  getConnectionController: () => ReturnType<typeof createConnectionController>;
  getAppearanceController: () => ReturnType<typeof createPaneAppearanceController>;
};

export type PlaygroundSessionShell = {
  isSettingsDialogOpen: () => boolean;
  resetThemeFileInput: () => void;
  publishConnectionState: () => void;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
};

export function createPlaygroundSessionShell({
  window,
  getActivePane,
  getConnectionController,
  getAppearanceController,
}: CreatePlaygroundSessionShellOptions): PlaygroundSessionShell {
  let settingsOpen = false;

  listenShellCommand(window, (detail) => {
    switch (detail?.command) {
      case "settings-open":
        settingsOpen = true;
        break;
      case "settings-close":
        settingsOpen = false;
        break;
    }
  });

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
    isSettingsDialogOpen: () => settingsOpen,
    resetThemeFileInput: () => {
      dispatchThemeFileReset(window);
    },
    publishConnectionState: () => {
      dispatchConnectionState(getConnectionShellStateDetail(), window);
    },
    paneShellSync,
  };
}

import { Restty } from "../../src/index.ts";
import { createConnectionController } from "./connection-controller.ts";
import { createDesktopNotificationHandler } from "./desktop-notifications.ts";
import { createPaneAppearanceController } from "./appearance-controller.ts";
import { createPaneLifecycleController } from "./pane-lifecycle.ts";
import { createPaneShellSync } from "./pane-shell-sync.ts";
import { createPlaygroundShellAdapter } from "./shell-adapter.ts";
import type { ConnectionStateDetail } from "./shell-events.ts";
import type { PlaygroundAppearanceInitialState } from "./startup-defaults.ts";
import type { PaneState } from "./pane-state.ts";
import type { LegacyPlaygroundElements } from "./elements.ts";

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;
type PlaygroundWindow = Window & typeof globalThis;

type CreatePlaygroundSessionOptions = {
  window: PlaygroundWindow;
  usesSvelteShell: boolean;
  getRestty: () => Restty;
  initialConnectionBackend: string;
  initialPtyUrl: string;
  initialWebContainerCommand: string;
  initialWebContainerCwd: string;
  appearanceInitialState: PlaygroundAppearanceInitialState;
  notificationHost?: typeof Notification;
  elements: Pick<
    LegacyPlaygroundElements,
    | "btnPause"
    | "rendererSelect"
    | "fontSizeInput"
    | "ptyBtn"
    | "themeSelect"
    | "themeFileInput"
    | "fontFamilySelect"
    | "ligaturesSelect"
    | "fontHintingSelect"
    | "fontHintTargetSelect"
    | "fontFamilyLocalSelect"
    | "btnLoadLocalFonts"
    | "fontFamilyHintEl"
    | "mouseModeEl"
    | "shaderPresetEl"
    | "connectionBackendEl"
    | "ptyUrlInput"
    | "wcCommandInput"
    | "wcCwdInput"
    | "connectionHintEl"
  > & {
    settingsDialog: HTMLDialogElement | null;
  };
};

export function createPlaygroundSession({
  window,
  usesSvelteShell,
  getRestty,
  initialConnectionBackend,
  initialPtyUrl,
  initialWebContainerCommand,
  initialWebContainerCwd,
  appearanceInitialState,
  notificationHost = globalThis.Notification,
  elements: {
    btnPause,
    rendererSelect,
    fontSizeInput,
    ptyBtn,
    themeSelect,
    themeFileInput,
    fontFamilySelect,
    ligaturesSelect,
    fontHintingSelect,
    fontHintTargetSelect,
    fontFamilyLocalSelect,
    btnLoadLocalFonts,
    fontFamilyHintEl,
    mouseModeEl,
    shaderPresetEl,
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
    connectionHintEl,
    settingsDialog,
  },
}: CreatePlaygroundSessionOptions) {
  const paneStates = new Map<number, PaneState>();
  let activePaneId: number | null = null;

  function waitForAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  function getActivePane(): ManagedPane | null {
    return getRestty().getActivePane();
  }

  let appearanceController: ReturnType<typeof createPaneAppearanceController>;
  let connectionController: ReturnType<typeof createConnectionController>;

  function getPtyButtonLabel() {
    const pane = getActivePane();
    if (pane?.runtime.io.isPtyConnected()) return "Disconnect";
    return connectionController.getBackend() === "webcontainer"
      ? "Start WebContainer"
      : "Connect PTY";
  }

  function getConnectionShellStateDetail(): ConnectionStateDetail {
    return {
      backend: connectionController.getBackend(),
      ptyUrl: connectionController.getPtyUrl(),
      ptyButtonLabel: getPtyButtonLabel(),
      webContainerCommand: connectionController.getWebContainerCommand(),
      webContainerCwd: connectionController.getWebContainerCwd(),
    };
  }

  const handleDesktopNotification = createDesktopNotificationHandler({
    sink:
      typeof notificationHost === "undefined"
        ? null
        : {
            getPermission: () => notificationHost.permission,
            requestPermission: () => notificationHost.requestPermission(),
            notify: (title, options) => {
              const browserNotification = new notificationHost(title, options);
              void browserNotification;
            },
          },
  });

  const shellAdapter = createPlaygroundShellAdapter({
    usesSvelteShell,
    target: window,
    themeFileInput,
    settingsDialog,
    connectionUi: {
      connectionBackendEl,
      ptyUrlInput,
      wcCommandInput,
      wcCwdInput,
      connectionHintEl,
    },
  });

  const paneShellSync = createPaneShellSync({
    usesSvelteShell,
    target: window,
    elements: {
      btnPause,
      rendererSelect,
      fontSizeInput,
      ptyBtn,
      themeSelect,
      fontFamilySelect,
      fontFamilyLocalSelect,
      btnLoadLocalFonts,
      fontFamilyHintEl,
      ligaturesSelect,
      fontHintingSelect,
      fontHintTargetSelect,
      mouseModeEl,
      shaderPresetEl,
    },
    getSelectedConnectionBackend: () => connectionController.getBackend(),
    getSelectedFontFamily: () => appearanceController.getFontFamily(),
    getSelectedLocalFontMatcher: () => appearanceController.getLocalFontMatcher(),
    getDetectedLocalFontOptions: () => appearanceController.getDetectedLocalFontOptions(),
    getLocalFontHintText: () => appearanceController.getLocalFontHintText(),
    getSelectedLigatures: () => appearanceController.getLigatures(),
    getSelectedFontHinting: () => appearanceController.getFontHinting(),
    getSelectedFontHintTarget: () => appearanceController.getFontHintTarget(),
    getSelectedShaderPreset: () => appearanceController.getShaderPreset(),
    syncSelectedDefaults: (state) => {
      appearanceController.syncTerminalDefaultsFromState(state);
    },
  });

  const paneLifecycle = createPaneLifecycleController({
    getPaneById: (id) => getRestty().getPaneById(id),
    getActivePane,
    getPaneState: (id) => paneStates.get(id),
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    getActivePaneId: () => activePaneId,
    getSelectedConnectionBackend: () => connectionController.getBackend(),
    getSelectedPtyUrl: () => connectionController.getPtyUrl(),
    syncPauseButton: (state) => {
      paneShellSync.syncPauseButton(state);
    },
    syncPtyButton: (pane) => {
      paneShellSync.syncPtyButton(pane);
    },
    waitForAnimationFrame,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
  });

  connectionController = createConnectionController({
    getActivePane,
    getPanes: () => getRestty().getPanes(),
    connectPaneIfNeeded: (pane) => paneLifecycle.connectPaneIfNeeded(pane),
    syncConnectionState: () => {
      shellAdapter.syncConnectionState(getConnectionShellStateDetail());
    },
    syncPtyButton: (pane) => {
      paneShellSync.syncPtyButton(pane);
    },
    initialBackend: initialConnectionBackend,
    initialPtyUrl,
    initialWebContainerCommand,
    initialWebContainerCwd,
  });

  appearanceController = createPaneAppearanceController({
    host: {
      getPanes: () => getRestty().getPanes(),
      setFontSources: (sources) => getRestty().setFontSources(sources),
      setShaderStages: (stages) => getRestty().setShaderStages(stages),
    },
    getActivePane,
    getActivePaneState: () => {
      return activePaneId === null ? null : (paneStates.get(activePaneId) ?? null);
    },
    getActivePaneId: () => activePaneId,
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    shellSync: {
      syncFontFamilyValue: () => paneShellSync.syncFontFamilyValue(),
      syncFontRenderingControls: () => paneShellSync.syncFontRenderingControls(),
      syncLocalFontControls: () => paneShellSync.syncLocalFontControls(),
      syncMouseModeValue: (value) => paneShellSync.syncMouseModeValue(value),
      syncShaderPresetValue: (value) => paneShellSync.syncShaderPresetValue(value),
      syncThemeSelectValue: (value) => paneShellSync.syncThemeSelectValue(value),
    },
    onThemeFileReset: shellAdapter.resetThemeFileInput,
    initialState: appearanceInitialState,
  });

  return {
    paneStates,
    shellAdapter,
    paneShellSync,
    paneLifecycle,
    connectionController,
    appearanceController,
    handleDesktopNotification,
    getConnectionShellStateDetail,
    getActivePaneId: () => activePaneId,
    setActivePaneId: (id: number | null) => {
      activePaneId = id;
    },
  };
}

import { Restty, listBuiltinThemeNames } from "../../src/index.ts";
import { createConnectionController } from "./connection-controller.ts";
import { createDesktopNotificationHandler } from "./desktop-notifications.ts";
import type { LegacyPlaygroundElements, SharedPlaygroundElements } from "./elements.ts";
import { createPaneAppearanceController } from "./appearance-controller.ts";
import { getConnectionBackend } from "./pty-connection.ts";
import { createPaneLifecycleController } from "./pane-lifecycle.ts";
import { createPaneShellSync } from "./pane-shell-sync.ts";
import { createPlaygroundShellAdapter } from "./shell-adapter.ts";
import { DEFAULT_CONNECTION_BACKEND } from "./shell-defaults.ts";
import { type ConnectionStateDetail } from "./shell-events.ts";
import { resolvePlaygroundStartupDefaults } from "./startup-defaults.ts";
import { bootstrapPlaygroundSurface } from "./surface-bootstrap.ts";
import { type PaneState, getActivePaneState } from "./pane-state.ts";
import { wirePlaygroundControls } from "./playground-wiring.ts";

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;
type PlaygroundWindow = Window & typeof globalThis;

type BootstrapPlaygroundOrchestratorOptions = {
  window: PlaygroundWindow;
  usesSvelteShell: boolean;
  sharedElements: SharedPlaygroundElements;
  legacyElements: LegacyPlaygroundElements;
  notificationHost?: typeof Notification;
};

export function bootstrapPlaygroundOrchestrator({
  window,
  usesSvelteShell,
  sharedElements: { paneRoot, settingsDialog },
  legacyElements: {
    btnInit,
    btnPause,
    btnClear,
    rendererSelect,
    demoSelect,
    btnRunDemo,
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
    connectionHintEl,
    ptyBtn,
    themeSelect,
    themeFileInput,
    fontSizeInput,
    fontFamilySelect,
    ligaturesSelect,
    fontHintingSelect,
    fontHintTargetSelect,
    fontFamilyLocalSelect,
    btnLoadLocalFonts,
    fontFamilyHintEl,
    mouseModeEl,
    shaderPresetEl,
    settingsFab,
    settingsClose,
  },
  notificationHost = globalThis.Notification,
}: BootstrapPlaygroundOrchestratorOptions): Restty {
  const paneStates = new Map<number, PaneState>();
  let activePaneId: number | null = null;
  let restty: Restty;

  const initialConnectionBackend = usesSvelteShell
    ? DEFAULT_CONNECTION_BACKEND
    : getConnectionBackend(connectionBackendEl);
  const builtinThemeNames = listBuiltinThemeNames();
  const {
    initialPtyUrl,
    initialWebContainerCommand,
    initialWebContainerCwd,
    initialFontSize,
    defaultThemeName,
    appearanceInitialState,
  } = resolvePlaygroundStartupDefaults({
    usesSvelteShell,
    shaderPresetValue: shaderPresetEl?.value,
    ptyUrlValue: ptyUrlInput?.value,
    webContainerCommandValue: wcCommandInput?.value,
    webContainerCwdValue: wcCwdInput?.value,
    rendererValue: rendererSelect?.value,
    fontSizeValue: fontSizeInput?.value,
    mouseModeValue: mouseModeEl?.value,
    fontFamilyValue: fontFamilySelect?.value,
    locationSearch: window.location.search,
    localFontPickerSupported:
      typeof window === "object" && window !== null && "queryLocalFonts" in window,
    builtinThemeNames,
  });

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

  function waitForAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  function getActivePane(): ManagedPane | null {
    return restty.getActivePane();
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
    getPaneById: (id) => restty.getPaneById(id),
    getActivePane: () => getActivePane(),
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
    getActivePane: () => getActivePane(),
    getPanes: () => restty.getPanes(),
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
      getPanes: () => restty.getPanes(),
      setFontSources: (sources) => restty.setFontSources(sources),
      setShaderStages: (stages) => restty.setShaderStages(stages),
    },
    getActivePane: () => getActivePane(),
    getActivePaneState: () => getActivePaneState(paneStates, activePaneId),
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

  restty = bootstrapPlaygroundSurface({
    root: paneRoot,
    target: window,
    initialFontSize,
    defaultThemeName,
    paneStates,
    setActivePaneId: (id) => {
      activePaneId = id;
    },
    isSettingsDialogOpen: shellAdapter.isSettingsDialogOpen,
    appearanceController,
    connectionController,
    paneLifecycle,
    paneShellSync,
    onDesktopNotification: handleDesktopNotification,
  });

  wirePlaygroundControls({
    restty,
    window,
    usesSvelteShell,
    sharedElements: { paneRoot, settingsDialog },
    legacyElements: {
      btnInit,
      btnPause,
      btnClear,
      rendererSelect,
      demoSelect,
      btnRunDemo,
      connectionBackendEl,
      ptyUrlInput,
      wcCommandInput,
      wcCwdInput,
      connectionHintEl,
      ptyBtn,
      themeSelect,
      themeFileInput,
      fontSizeInput,
      fontFamilySelect,
      ligaturesSelect,
      fontHintingSelect,
      fontHintTargetSelect,
      fontFamilyLocalSelect,
      btnLoadLocalFonts,
      fontFamilyHintEl,
      mouseModeEl,
      shaderPresetEl,
      settingsFab,
      settingsClose,
    },
    shellAdapter,
    paneShellSync,
    paneLifecycle,
    appearanceController,
    connectionController,
    paneStates,
    getActivePaneId: () => activePaneId,
    getConnectionShellStateDetail,
  });

  return restty;
}

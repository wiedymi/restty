import { Restty, listBuiltinThemeNames } from "../src/index.ts";
import { runActivePaneDemo, type PlaygroundDemoKind } from "./lib/demos.ts";
import { createConnectionController } from "./lib/connection-controller.ts";
import {
  bindAppearanceControls,
  bindConnectionControls,
  bindSettingsControls,
  bindTerminalControls,
} from "./lib/control-bindings.ts";
import { createDesktopNotificationHandler } from "./lib/desktop-notifications.ts";
import { queryPlaygroundElements } from "./lib/elements.ts";
import { createPaneAppearanceController } from "./lib/appearance-controller.ts";
import { getConnectionBackend } from "./lib/pty-connection.ts";
import { createPaneLifecycleController } from "./lib/pane-lifecycle.ts";
import { createPaneShellSync } from "./lib/pane-shell-sync.ts";
import { createPlaygroundShellAdapter } from "./lib/shell-adapter.ts";
import { getActivePaneState, type PaneState } from "./lib/pane-state.ts";
import { DEFAULT_CONNECTION_BACKEND } from "./lib/shell-defaults.ts";
import {
  SETTINGS_CLOSE_EVENT,
  SETTINGS_OPEN_EVENT,
  type ConnectionStateDetail,
} from "./lib/shell-events.ts";
import { resolvePlaygroundStartupDefaults } from "./lib/startup-defaults.ts";
import { bootstrapPlaygroundSurface } from "./lib/surface-bootstrap.ts";

const usesSvelteShell = document.documentElement.dataset.playgroundShell === "svelte";

const {
  paneRoot,
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
  settingsDialog,
  settingsClose,
} = queryPlaygroundElements(document, {
  includeLegacyControls: !usesSvelteShell,
});

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;

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
    typeof Notification === "undefined"
      ? null
      : {
          getPermission: () => Notification.permission,
          requestPermission: () => Notification.requestPermission(),
          notify: (title, options) => {
            const browserNotification = new Notification(title, options);
            void browserNotification;
          },
        },
});

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function getActivePane(): ManagedPane | null {
  return restty.getActivePane();
}

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

let appearanceController: ReturnType<typeof createPaneAppearanceController>;
let connectionController: ReturnType<typeof createConnectionController>;

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
  requestAnimationFrame,
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

bindSettingsControls({
  usesSvelteShell,
  target: window,
  settingsDialog,
  settingsFab,
  settingsClose,
  onOpen: () => {
    shellAdapter.openSettings(restty);
  },
  onClose: () => {
    shellAdapter.closeSettings(restty);
  },
});

function handleTerminalInit() {
  paneLifecycle.handleTerminalInit();
}

function handleTerminalPauseToggle() {
  paneLifecycle.handleTerminalPauseToggle();
}

function handleTerminalClear() {
  paneLifecycle.handleTerminalClear();
}

function handlePtyButtonClick() {
  paneLifecycle.handlePtyButtonClick();
}

bindConnectionControls({
  usesSvelteShell,
  target: window,
  connectionBackendEl,
  ptyUrlInput,
  wcCommandInput,
  wcCwdInput,
  onBackendChange: (value) => {
    connectionController.applyConnectionBackend(value);
  },
  onPtyUrlChange: (value) => {
    connectionController.setPtyUrl(value);
  },
  onWebContainerCommandChange: (value) => {
    connectionController.setWebContainerCommand(value);
  },
  onWebContainerCwdChange: (value) => {
    connectionController.setWebContainerCwd(value);
  },
});

bindTerminalControls({
  usesSvelteShell,
  target: window,
  btnClear,
  btnInit,
  btnPause,
  btnPty: ptyBtn,
  btnRunDemo,
  demoSelect,
  fontSizeInput,
  rendererSelect,
  onClear: handleTerminalClear,
  onDemoRun: (kind) => {
    runActivePaneDemo(paneStates, activePaneId, kind);
  },
  onFontSizeChange: (value) => {
    appearanceController.applyFontSizeValue(value);
  },
  onInit: handleTerminalInit,
  onPauseToggle: handleTerminalPauseToggle,
  onPtyButton: handlePtyButtonClick,
  onRendererChange: (value) => {
    appearanceController.applyRendererChoice(value);
  },
});

bindAppearanceControls({
  usesSvelteShell,
  target: window,
  btnLoadLocalFonts,
  fontFamilyLocalSelect,
  fontFamilySelect,
  fontHintTargetSelect,
  fontHintingSelect,
  ligaturesSelect,
  mouseModeEl,
  shaderPresetEl,
  themeFileInput,
  themeSelect,
  onFontFamilyChange: (value) => appearanceController.applyFontFamilySelection(value),
  onFontFamilyLocalChange: (value) => appearanceController.applyLocalFontSelection(value),
  onFontHintTargetChange: (value) => {
    appearanceController.applyFontHintTargetChange(value);
  },
  onFontHintingChange: (value) => {
    appearanceController.applyFontHintingChange(value);
  },
  onLigaturesChange: (value) => {
    appearanceController.applyLigaturesChange(value);
  },
  onLoadLocalFonts: () => appearanceController.loadLocalFonts(),
  onMouseModeChange: (value) => {
    appearanceController.applyMouseMode(value);
  },
  onShaderPresetChange: (value) => {
    appearanceController.applySelectedShaderPreset(value);
  },
  onThemeFileChange: (file) => appearanceController.applyUploadedThemeFile(file),
  onThemeSelectChange: (value) => {
    appearanceController.applyThemeSelection(value);
  },
});

shellAdapter.syncConnectionState(getConnectionShellStateDetail());
paneShellSync.syncFontFamilyValue();
paneShellSync.syncLocalFontControls();
paneShellSync.syncFontRenderingControls();

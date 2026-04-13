import { Restty, listBuiltinThemeNames } from "../src/index.ts";
import type { PlaygroundDemoKind } from "./lib/demos.ts";
import { createConnectionController } from "./lib/connection-controller.ts";
import {
  bindAppearanceControls,
  bindConnectionControls,
  bindSettingsControls,
  bindTerminalControls,
} from "./lib/control-bindings.ts";
import { createDesktopNotificationHandler } from "./lib/desktop-notifications.ts";
import { createPaneAppearanceController } from "./lib/appearance-controller.ts";
import { getConnectionBackend, syncConnectionUi } from "./lib/pty-connection.ts";
import { createPaneLifecycleController } from "./lib/pane-lifecycle.ts";
import { createPaneShellSync } from "./lib/pane-shell-sync.ts";
import {
  closeSettingsDialog,
  isSettingsDialogOpen,
  openSettingsDialog,
  restoreTerminalFocus,
} from "./lib/settings-dialog.ts";
import { getActivePaneState, type PaneState } from "./lib/pane-state.ts";
import {
  SETTINGS_CLOSE_EVENT,
  SETTINGS_OPEN_EVENT,
  THEME_FILE_RESET_EVENT,
} from "./lib/shell-events.ts";
import { resolvePlaygroundStartupDefaults } from "./lib/startup-defaults.ts";
import { bootstrapPlaygroundSurface } from "./lib/surface-bootstrap.ts";

const paneRoot = document.getElementById("paneRoot") as HTMLElement | null;
if (!paneRoot) {
  throw new Error("missing #paneRoot element");
}

const btnInit = document.getElementById("btnInit");
const btnPause = document.getElementById("btnPause");
const btnClear = document.getElementById("btnClear");
const rendererSelect = document.getElementById("rendererSelect") as HTMLSelectElement | null;
const demoSelect = document.getElementById("demoSelect") as HTMLSelectElement | null;
const btnRunDemo = document.getElementById("btnRunDemo");
const connectionBackendEl = document.getElementById(
  "connectionBackend",
) as HTMLSelectElement | null;
const ptyUrlInput = document.getElementById("ptyUrl") as HTMLInputElement | null;
const wcCommandInput = document.getElementById("wcCommand") as HTMLInputElement | null;
const wcCwdInput = document.getElementById("wcCwd") as HTMLInputElement | null;
const connectionHintEl = document.getElementById("connectionHint") as HTMLElement | null;
const ptyBtn = document.getElementById("btnPty");
const themeSelect = document.getElementById("themeSelect") as HTMLSelectElement | null;
const themeFileInput = document.getElementById("themeFile") as HTMLInputElement | null;
const fontSizeInput = document.getElementById("fontSize") as HTMLInputElement | null;
const fontFamilySelect = document.getElementById("fontFamily") as HTMLSelectElement | null;
const ligaturesSelect = document.getElementById("ligatures") as HTMLSelectElement | null;
const fontHintingSelect = document.getElementById("fontHinting") as HTMLSelectElement | null;
const fontHintTargetSelect = document.getElementById("fontHintTarget") as HTMLSelectElement | null;
const fontFamilyLocalSelect = document.getElementById(
  "fontFamilyLocal",
) as HTMLSelectElement | null;
const btnLoadLocalFonts = document.getElementById("btnLoadLocalFonts") as HTMLButtonElement | null;
const fontFamilyHintEl = document.getElementById("fontFamilyHint");
const mouseModeEl = document.getElementById("mouseMode") as HTMLSelectElement | null;
const shaderPresetEl = document.getElementById("shaderPreset") as HTMLSelectElement | null;
const settingsFab = document.getElementById("settingsFab") as HTMLButtonElement | null;
const settingsDialog = document.getElementById("settingsDialog") as HTMLDialogElement | null;
const settingsClose = document.getElementById("settingsClose") as HTMLButtonElement | null;

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;

const paneStates = new Map<number, PaneState>();
let activePaneId: number | null = null;
let restty: Restty;
const usesSvelteShell = document.documentElement.dataset.playgroundShell === "svelte";
const initialConnectionBackend = getConnectionBackend(connectionBackendEl);
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
  },
  getSelectedConnectionBackend: () => connectionController.getBackend(),
  getSelectedFontFamily: () => appearanceController.getFontFamily(),
  getSelectedLocalFontMatcher: () => appearanceController.getLocalFontMatcher(),
  getDetectedLocalFontOptions: () => appearanceController.getDetectedLocalFontOptions(),
  getLocalFontHintText: () => appearanceController.getLocalFontHintText(),
  getSelectedLigatures: () => appearanceController.getLigatures(),
  getSelectedFontHinting: () => appearanceController.getFontHinting(),
  getSelectedFontHintTarget: () => appearanceController.getFontHintTarget(),
  syncSelectedDefaults: (state) => {
    appearanceController.syncTerminalDefaultsFromState(state);
  },
});

connectionController = createConnectionController({
  getActivePane: () => getActivePane(),
  getPanes: () => restty.getPanes(),
  connectPaneIfNeeded: (pane) => paneLifecycle.connectPaneIfNeeded(pane),
  syncConnectionUi: usesSvelteShell
    ? undefined
    : () => {
        syncConnectionUi({
          connectionBackendEl,
          ptyUrlInput,
          wcCommandInput,
          wcCwdInput,
          connectionHintEl,
        });
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
    syncThemeSelectValue: (value) => paneShellSync.syncThemeSelectValue(value),
  },
  onThemeFileReset: () => {
    if (usesSvelteShell) {
      window.dispatchEvent(new CustomEvent(THEME_FILE_RESET_EVENT));
    } else if (themeFileInput) {
      themeFileInput.value = "";
    }
  },
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
  isSettingsDialogOpen: () => isSettingsDialogOpen(),
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
    if (usesSvelteShell) {
      restty.hideContextMenu();
      return;
    }
    openSettingsDialog({ host: restty, settingsDialog });
  },
  onClose: () => {
    if (usesSvelteShell) {
      restoreTerminalFocus(restty);
      return;
    }
    if (!isSettingsDialogOpen(settingsDialog)) return;
    closeSettingsDialog({ host: restty, settingsDialog });
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

function runSelectedDemo(kind: PlaygroundDemoKind | string | null | undefined) {
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  state.demos?.run(kind ?? "basic");
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
    runSelectedDemo(kind);
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

if (!usesSvelteShell) {
  syncConnectionUi({
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
    connectionHintEl,
  });
}
paneShellSync.syncFontFamilyValue();
paneShellSync.syncLocalFontControls();
paneShellSync.syncFontRenderingControls();

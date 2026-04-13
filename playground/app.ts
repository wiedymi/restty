import { Restty, listBuiltinThemeNames } from "../src/index.ts";
import { createDemoController, type PlaygroundDemoKind } from "./lib/demos.ts";
import { createConnectionController } from "./lib/connection-controller.ts";
import {
  bindAppearanceControls,
  bindConnectionControls,
  bindSettingsControls,
  bindTerminalControls,
} from "./lib/control-bindings.ts";
import {
  DEFAULT_FONT_FAMILY,
  getDefaultLocalFontHintText,
  supportsLocalFontPicker,
} from "./lib/font-controls.ts";
import { createPaneAppearanceController } from "./lib/appearance-controller.ts";
import {
  createAdaptivePtyTransport,
  getConnectionBackend,
  syncConnectionUi,
} from "./lib/pty-connection.ts";
import { createPaneLifecycleController } from "./lib/pane-lifecycle.ts";
import { createPaneShellSync } from "./lib/pane-shell-sync.ts";
import type { ShaderPreset } from "./lib/shader-presets.ts";
import {
  closeSettingsDialog,
  isSettingsDialogOpen,
  openSettingsDialog,
  restoreTerminalFocus,
} from "./lib/settings-dialog.ts";
import {
  createPaneState,
  getActivePaneState,
  type PaneState,
  type RendererChoice,
} from "./lib/pane-state.ts";
import {
  SETTINGS_CLOSE_EVENT,
  SETTINGS_OPEN_EVENT,
  THEME_FILE_RESET_EVENT,
} from "./lib/shell-events.ts";

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

const DEFAULT_THEME_NAME = "Aizen Dark";
type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;

const paneStates = new Map<number, PaneState>();
let activePaneId: number | null = null;
let resizeRaf = 0;
let restty: Restty;
let notificationPermissionRequest: Promise<NotificationPermission> | null = null;
const usesSvelteShell = document.documentElement.dataset.playgroundShell === "svelte";
const initialShaderPreset = usesSvelteShell
  ? "none"
  : ((shaderPresetEl?.value as ShaderPreset | undefined) ?? "none");
const initialConnectionBackend = getConnectionBackend(connectionBackendEl);
const initialPtyUrl = ptyUrlInput?.value ?? "ws://localhost:8787/pty";
const initialWebContainerCommand = wcCommandInput?.value?.trim() || "jsh";
const initialWebContainerCwd = wcCwdInput?.value?.trim() || "/";
const initialRendererDefault: RendererChoice = isRendererChoice(rendererSelect?.value)
  ? rendererSelect.value
  : "auto";
const initialFontSizeDefault = parseFontSize(fontSizeInput?.value, 18);
const initialMouseModeDefault = mouseModeEl?.value || "auto";

const initialFontSize = fontSizeInput?.value ? Number(fontSizeInput.value) : 18;
const initialFontFamily = fontFamilySelect?.value ?? DEFAULT_FONT_FAMILY;
const initialLocalFontMatcher = "";
const initialDetectedLocalFontOptions = [];
const initialLocalFontHintText = getDefaultLocalFontHintText(supportsLocalFontPicker());
const searchParams =
  typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
function isTruthyQueryParam(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function isFalsyQueryParam(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off";
}

const initialLigatures = !isFalsyQueryParam(searchParams?.get("ligatures"));
const initialFontHinting = isTruthyQueryParam(searchParams?.get("hinting"));
const initialFontHintTarget =
  searchParams?.get("hintTarget") === "light" || searchParams?.get("hintTarget") === "normal"
    ? searchParams.get("hintTarget")!
    : "auto";

function isRendererChoice(value: string | null | undefined): value is RendererChoice {
  return value === "auto" || value === "webgpu" || value === "webgl2";
}

function parseFontSize(value: string | null | undefined, fallback = 18) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function handleDesktopNotification(notification: {
  title: string;
  body: string;
  source: "osc9" | "osc777";
  raw: string;
  paneId: number;
}) {
  const title = notification.title.trim() || "Terminal notification";
  const body = notification.body.trim();
  const prefix = `[notify][pane ${notification.paneId}][${notification.source}]`;
  if (body) {
    console.info(`${prefix} ${title}: ${body}`);
  } else {
    console.info(`${prefix} ${title}`);
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const browserNotification = new Notification(title, body ? { body } : undefined);
      void browserNotification;
    } catch {
      // Ignore browser notification failures in playground mode.
    }
    return;
  }

  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    if (!notificationPermissionRequest) {
      notificationPermissionRequest = Notification.requestPermission().catch(() => "denied");
    }
    void notificationPermissionRequest.then((permission) => {
      if (permission !== "granted") return;
      try {
        const browserNotification = new Notification(title, body ? { body } : undefined);
        void browserNotification;
      } catch {
        // Ignore browser notification failures in playground mode.
      }
    });
  }
}

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

function queueResizeAllPanes() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    for (const pane of restty.getPanes()) {
      pane.runtime.interaction.updateSize(true);
    }
  });
}

const builtinThemeNames = listBuiltinThemeNames();
const defaultThemeName = builtinThemeNames.includes(DEFAULT_THEME_NAME) ? DEFAULT_THEME_NAME : "";

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
  initialState: {
    detectedLocalFontOptions: initialDetectedLocalFontOptions,
    fontFamily: initialFontFamily,
    fontHintTarget: initialFontHintTarget,
    fontHinting: initialFontHinting,
    fontSizeDefault: initialFontSizeDefault,
    ligatures: initialLigatures,
    localFontHintText: initialLocalFontHintText,
    localFontMatcher: initialLocalFontMatcher,
    mouseModeDefault: initialMouseModeDefault,
    rendererDefault: initialRendererDefault,
    shaderPreset: initialShaderPreset,
  },
});

restty = new Restty({
  root: paneRoot,
  surface: {
    createInitialPane: false,
    autoInit: false,
    paneStyles: {
      inactivePaneOpacity: 0.9,
    },
    searchUi: {
      styles: {
        offsetTopPx: 14,
        offsetRightPx: 14,
        maxWidthPx: 400,
        borderRadiusPx: 14,
        panelBackground: "rgba(14, 14, 14, 0.92)",
        panelBorderColor: "rgba(255, 255, 255, 0.14)",
        buttonHoverBackground: "rgba(255, 255, 255, 0.18)",
        statusActiveTextColor: "#e0bc72",
      },
    },
    events: {
      onPaneCreated: (pane) => {
        const state = paneStates.get(pane.id);
        if (!state) return;

        pane.paused = state.paused;
        pane.setPaused = (value: boolean) => {
          paneLifecycle.setPanePaused(pane.id, value);
        };

        state.demos = createDemoController(pane.runtime);
        pane.runtime.interaction.setMouseMode(state.mouseMode);
        void paneLifecycle.initPane(pane, state);
      },
      onPaneClosed: (pane) => {
        const state = paneStates.get(pane.id);
        state?.demos?.stop();
        paneStates.delete(pane.id);
      },
      onActivePaneChange: (pane) => {
        activePaneId = pane?.id ?? null;
        if (!pane) return;
        const state = paneStates.get(pane.id);
        if (!state) return;
        paneShellSync.syncPtyButton(pane);
        paneShellSync.renderActivePaneControls(pane, state);
      },
      onLayoutChanged: () => {
        queueResizeAllPanes();
      },
      onDesktopNotification: handleDesktopNotification,
    },
    defaultContextMenu: {
      canOpen: () => !isSettingsDialogOpen(),
      getPtyUrl: () => connectionController.getConnectUrl(),
    },
    shortcuts: {
      enabled: true,
      canHandleEvent: () => !isSettingsDialogOpen(),
    },
  },
  terminal: ({ id, sourcePane }) => {
    const paneState = createPaneState({
      id,
      sourceState: sourcePane ? (paneStates.get(sourcePane.id) ?? null) : null,
      renderer: appearanceController.getRendererDefault(),
      fontSize: Number.isFinite(appearanceController.getFontSizeDefault())
        ? appearanceController.getFontSizeDefault()
        : Number.isFinite(initialFontSize)
          ? initialFontSize
          : 18,
      mouseMode: appearanceController.getMouseModeDefault(),
      defaultThemeName,
    });
    paneStates.set(id, paneState);
    return {
      renderer: paneState.renderer,
      fontSize: paneState.fontSize,
      ligatures: appearanceController.getLigatures(),
      fontHinting: appearanceController.getFontHinting(),
      fontHintTarget: appearanceController.getFontHintTarget(),
      // Ghostty parity: use EM sizing semantics and native alpha blending.
      fontSizeMode: "em",
      alphaBlending: "native",
      fontSources: appearanceController.getFontSources(),
    };
  },
  services: ({ id }) => ({
    ptyTransport: createAdaptivePtyTransport({
      getConnectionBackend: () => connectionController.getBackend(),
      getPtyUrl: () => connectionController.getConnectUrl(),
      getWebContainerCommand: () => connectionController.getWebContainerCommand(),
      getWebContainerCwd: () => connectionController.getWebContainerCwd(),
    }),
    callbacks: {},
  }),
});
appearanceController.applyCurrentShaderPreset();

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

window.addEventListener("resize", () => {
  queueResizeAllPanes();
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
const firstPane = restty.createInitialPane({ focus: true });
activePaneId = firstPane.id;
const firstState = paneStates.get(firstPane.id);
if (firstState) {
  paneShellSync.syncPtyButton(firstPane);
  paneShellSync.renderActivePaneControls(firstPane, firstState);
}
queueResizeAllPanes();

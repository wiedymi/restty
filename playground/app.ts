import { Restty, listBuiltinThemeNames } from "../src/index.ts";
import { createDemoController, type PlaygroundDemoKind } from "./lib/demos.ts";
import { createConnectionController } from "./lib/connection-controller.ts";
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
  CONNECTION_BACKEND_CHANGE_EVENT,
  FONT_FAMILY_LOCAL_CHANGE_EVENT,
  FONT_FAMILY_CHANGE_EVENT,
  FONT_HINT_TARGET_CHANGE_EVENT,
  FONT_HINTING_CHANGE_EVENT,
  FONT_LIGATURES_CHANGE_EVENT,
  LOAD_LOCAL_FONTS_EVENT,
  MOUSE_MODE_CHANGE_EVENT,
  PTY_BUTTON_EVENT,
  PTY_URL_CHANGE_EVENT,
  RUN_DEMO_EVENT,
  SETTINGS_CLOSE_EVENT,
  SETTINGS_OPEN_EVENT,
  SHADER_PRESET_CHANGE_EVENT,
  TERMINAL_CLEAR_EVENT,
  TERMINAL_FONT_SIZE_EVENT,
  TERMINAL_INIT_EVENT,
  TERMINAL_PAUSE_EVENT,
  TERMINAL_RENDERER_EVENT,
  THEME_FILE_CHANGE_EVENT,
  THEME_FILE_RESET_EVENT,
  THEME_SELECT_CHANGE_EVENT,
  WC_COMMAND_CHANGE_EVENT,
  WC_CWD_CHANGE_EVENT,
  type DemoRunDetail,
  type RendererChangeDetail,
  type ShaderPresetChangeDetail,
  type ShellStringValueDetail,
  type ThemeFileChangeDetail,
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
type DemoRunEvent = CustomEvent<DemoRunDetail>;
type FontControlChangeEvent = CustomEvent<ShellStringValueDetail>;
type LocalFontControlChangeEvent = CustomEvent<ShellStringValueDetail>;
type MouseModeChangeEvent = CustomEvent<ShellStringValueDetail>;
type ThemeFileChangeEvent = CustomEvent<ThemeFileChangeDetail>;
type ThemeSelectChangeEvent = CustomEvent<ShellStringValueDetail>;
type ShaderPresetChangeEvent = CustomEvent<ShaderPresetChangeDetail>;
type FontSizeChangeEvent = CustomEvent<ShellStringValueDetail>;
type RendererChangeEvent = CustomEvent<RendererChangeDetail>;

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

if (usesSvelteShell) {
  window.addEventListener(SETTINGS_OPEN_EVENT, () => {
    restty.hideContextMenu();
  });
  window.addEventListener(SETTINGS_CLOSE_EVENT, () => {
    restoreTerminalFocus(restty);
  });
} else {
  settingsFab?.addEventListener("click", () => {
    openSettingsDialog({ host: restty, settingsDialog });
  });

  settingsClose?.addEventListener("click", () => {
    closeSettingsDialog({ host: restty, settingsDialog });
  });

  settingsDialog?.addEventListener("click", (event) => {
    if (event.target !== settingsDialog) return;
    closeSettingsDialog({ host: restty, settingsDialog });
  });

  settingsDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSettingsDialog({ host: restty, settingsDialog });
  });

  window.addEventListener(
    "keydown",
    (event) => {
      if (isSettingsDialogOpen(settingsDialog) && event.key === "Escape") {
        event.preventDefault();
        closeSettingsDialog({ host: restty, settingsDialog });
      }
    },
    { capture: true },
  );
}

window.addEventListener("resize", () => {
  queueResizeAllPanes();
});

if (usesSvelteShell) {
  window.addEventListener(CONNECTION_BACKEND_CHANGE_EVENT, (event) => {
    connectionController.applyConnectionBackend((event as FontControlChangeEvent).detail?.value);
  });
  window.addEventListener(PTY_URL_CHANGE_EVENT, (event) => {
    connectionController.setPtyUrl((event as FontControlChangeEvent).detail?.value);
  });
  window.addEventListener(WC_COMMAND_CHANGE_EVENT, (event) => {
    connectionController.setWebContainerCommand((event as FontControlChangeEvent).detail?.value);
  });
  window.addEventListener(WC_CWD_CHANGE_EVENT, (event) => {
    connectionController.setWebContainerCwd((event as FontControlChangeEvent).detail?.value);
  });
} else {
  connectionBackendEl?.addEventListener("change", () => {
    connectionController.setPtyUrl(ptyUrlInput?.value);
    connectionController.setWebContainerCommand(wcCommandInput?.value);
    connectionController.setWebContainerCwd(wcCwdInput?.value);
    connectionController.applyConnectionBackend(connectionBackendEl?.value);
  });
  ptyUrlInput?.addEventListener("input", () => {
    connectionController.setPtyUrl(ptyUrlInput.value);
  });
  ptyUrlInput?.addEventListener("change", () => {
    connectionController.setPtyUrl(ptyUrlInput.value);
  });
  wcCommandInput?.addEventListener("input", () => {
    connectionController.setWebContainerCommand(wcCommandInput.value);
  });
  wcCommandInput?.addEventListener("change", () => {
    connectionController.setWebContainerCommand(wcCommandInput.value);
  });
  wcCwdInput?.addEventListener("input", () => {
    connectionController.setWebContainerCwd(wcCwdInput.value);
  });
  wcCwdInput?.addEventListener("change", () => {
    connectionController.setWebContainerCwd(wcCwdInput.value);
  });
}

function handleTerminalInit() {
  paneLifecycle.handleTerminalInit();
}

function handleTerminalPauseToggle() {
  paneLifecycle.handleTerminalPauseToggle();
}

function handleTerminalClear() {
  paneLifecycle.handleTerminalClear();
}

if (usesSvelteShell) {
  window.addEventListener(TERMINAL_INIT_EVENT, handleTerminalInit);
  window.addEventListener(TERMINAL_PAUSE_EVENT, handleTerminalPauseToggle);
  window.addEventListener(TERMINAL_CLEAR_EVENT, handleTerminalClear);
} else {
  btnInit?.addEventListener("click", handleTerminalInit);
  btnPause?.addEventListener("click", handleTerminalPauseToggle);
  btnClear?.addEventListener("click", handleTerminalClear);
}

function runSelectedDemo(kind: PlaygroundDemoKind | string | null | undefined) {
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  state.demos?.run(kind ?? "basic");
}

if (usesSvelteShell) {
  window.addEventListener(RUN_DEMO_EVENT, (event) => {
    runSelectedDemo((event as DemoRunEvent).detail?.kind);
  });
} else {
  btnRunDemo?.addEventListener("click", () => {
    runSelectedDemo(demoSelect?.value);
  });
}

function handlePtyButtonClick() {
  paneLifecycle.handlePtyButtonClick();
}

if (usesSvelteShell) {
  window.addEventListener(PTY_BUTTON_EVENT, handlePtyButtonClick);
} else {
  ptyBtn?.addEventListener("click", handlePtyButtonClick);
}

if (usesSvelteShell) {
  window.addEventListener(TERMINAL_RENDERER_EVENT, (event) => {
    appearanceController.applyRendererChoice((event as RendererChangeEvent).detail?.value);
  });
} else {
  rendererSelect?.addEventListener("change", () => {
    appearanceController.applyRendererChoice(rendererSelect.value);
  });
}

if (usesSvelteShell) {
  window.addEventListener(THEME_FILE_CHANGE_EVENT, (event) => {
    void appearanceController.applyUploadedThemeFile((event as ThemeFileChangeEvent).detail?.file);
  });
} else if (themeFileInput) {
  themeFileInput.addEventListener("change", () => {
    void appearanceController.applyUploadedThemeFile(themeFileInput.files?.[0]);
  });
}

if (usesSvelteShell) {
  window.addEventListener(THEME_SELECT_CHANGE_EVENT, (event) => {
    appearanceController.applyThemeSelection((event as ThemeSelectChangeEvent).detail?.value);
  });
} else if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    appearanceController.applyThemeSelection(themeSelect.value);
  });
}

if (usesSvelteShell) {
  window.addEventListener(MOUSE_MODE_CHANGE_EVENT, (event) => {
    appearanceController.applyMouseMode((event as MouseModeChangeEvent).detail?.value);
  });
} else if (mouseModeEl) {
  mouseModeEl.addEventListener("change", () => {
    appearanceController.applyMouseMode(mouseModeEl.value);
  });
}

if (usesSvelteShell) {
  window.addEventListener(SHADER_PRESET_CHANGE_EVENT, (event) => {
    appearanceController.applySelectedShaderPreset(
      (event as ShaderPresetChangeEvent).detail?.value,
    );
  });
} else if (shaderPresetEl) {
  shaderPresetEl.addEventListener("change", () => {
    appearanceController.applySelectedShaderPreset(shaderPresetEl.value);
  });
}

if (usesSvelteShell) {
  window.addEventListener(TERMINAL_FONT_SIZE_EVENT, (event) => {
    appearanceController.applyFontSizeValue((event as FontSizeChangeEvent).detail?.value);
  });
} else if (fontSizeInput) {
  const applyFontSize = () => {
    appearanceController.applyFontSizeValue(fontSizeInput.value);
  };

  fontSizeInput.addEventListener("change", applyFontSize);
  fontSizeInput.addEventListener("input", applyFontSize);
}

if (usesSvelteShell) {
  window.addEventListener(FONT_HINTING_CHANGE_EVENT, (event) => {
    appearanceController.applyFontHintingChange((event as FontControlChangeEvent).detail?.value);
  });
  window.addEventListener(FONT_LIGATURES_CHANGE_EVENT, (event) => {
    appearanceController.applyLigaturesChange((event as FontControlChangeEvent).detail?.value);
  });
  window.addEventListener(FONT_HINT_TARGET_CHANGE_EVENT, (event) => {
    appearanceController.applyFontHintTargetChange((event as FontControlChangeEvent).detail?.value);
  });
} else {
  if (fontHintingSelect) {
    fontHintingSelect.addEventListener("change", () => {
      appearanceController.applyFontHintingChange(fontHintingSelect.value);
    });
  }

  if (ligaturesSelect) {
    ligaturesSelect.addEventListener("change", () => {
      appearanceController.applyLigaturesChange(ligaturesSelect.value);
    });
  }

  if (fontHintTargetSelect) {
    fontHintTargetSelect.addEventListener("change", () => {
      appearanceController.applyFontHintTargetChange(fontHintTargetSelect.value);
    });
  }
}

if (fontFamilySelect) {
  if (usesSvelteShell) {
    window.addEventListener(FONT_FAMILY_CHANGE_EVENT, (event) => {
      void appearanceController.applyFontFamilySelection(
        (event as FontControlChangeEvent).detail?.value,
      );
    });
  } else {
    fontFamilySelect.addEventListener("change", () => {
      void appearanceController.applyFontFamilySelection(fontFamilySelect.value);
    });
  }
}

if (usesSvelteShell) {
  window.addEventListener(FONT_FAMILY_LOCAL_CHANGE_EVENT, (event) => {
    void appearanceController.applyLocalFontSelection(
      (event as LocalFontControlChangeEvent).detail?.value,
    );
  });
  window.addEventListener(LOAD_LOCAL_FONTS_EVENT, () => {
    void appearanceController.loadLocalFonts();
  });
} else {
  if (fontFamilyLocalSelect) {
    fontFamilyLocalSelect.addEventListener("change", () => {
      void appearanceController.applyLocalFontSelection(fontFamilyLocalSelect.value);
    });
  }

  if (btnLoadLocalFonts) {
    btnLoadLocalFonts.addEventListener("click", () => {
      void appearanceController.loadLocalFonts();
    });
  }
}

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

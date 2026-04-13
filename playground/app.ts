import {
  Restty,
  listBuiltinThemeNames,
  parseGhosttyTheme,
  type GhosttyTheme,
  type ResttyShaderStage,
} from "../src/index.ts";
import { createDemoController, type PlaygroundDemoKind } from "./lib/demos.ts";
import {
  applyFontRenderingOptionsToAllPanes,
  applyFontSourcesToAllPanes,
} from "./lib/font-application.ts";
import {
  DEFAULT_FONT_FAMILY,
  FONT_FAMILY_LOCAL_PREFIX,
  detectLocalFontState,
  detectLocalFonts,
  getDefaultLocalFontHintText,
  getCurrentFontSources,
  getLocalFontSelectValue,
  resolveFontHintTarget,
  supportsLocalFontPicker,
  syncFontFamilyControls,
  syncHintingControls,
  type FontHintTarget,
  type LocalFontOption,
} from "./lib/font-controls.ts";
import {
  createAdaptivePtyTransport,
  getConnectUrl,
  getConnectionBackend,
  syncConnectionUi,
} from "./lib/pty-connection.ts";
import {
  applyBuiltinThemeToPane,
  applySavedThemeForPane,
  applyThemeToPane,
  resetThemeForPane,
} from "./lib/pane-theme.ts";
import { shaderStagesForPreset, type ShaderPreset } from "./lib/shader-presets.ts";
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
  withPanePaused,
} from "./lib/pane-state.ts";
import {
  FONT_FAMILY_LOCAL_CHANGE_EVENT,
  FONT_FAMILY_CHANGE_EVENT,
  FONT_FAMILY_STATE_EVENT,
  FONT_HINT_TARGET_CHANGE_EVENT,
  FONT_HINTING_CHANGE_EVENT,
  FONT_LIGATURES_CHANGE_EVENT,
  FONT_RENDERING_STATE_EVENT,
  LOCAL_FONT_STATE_EVENT,
  LOAD_LOCAL_FONTS_EVENT,
  MOUSE_MODE_CHANGE_EVENT,
  MOUSE_MODE_STATE_EVENT,
  PTY_BUTTON_EVENT,
  PTY_BUTTON_STATE_EVENT,
  RUN_DEMO_EVENT,
  SETTINGS_CLOSE_EVENT,
  SETTINGS_OPEN_EVENT,
  SHADER_PRESET_CHANGE_EVENT,
  TERMINAL_CLEAR_EVENT,
  TERMINAL_FONT_SIZE_EVENT,
  TERMINAL_INIT_EVENT,
  TERMINAL_PAUSE_EVENT,
  TERMINAL_RENDERER_EVENT,
  TERMINAL_STATE_EVENT,
  THEME_FILE_CHANGE_EVENT,
  THEME_FILE_RESET_EVENT,
  THEME_SELECT_CHANGE_EVENT,
  THEME_SELECT_STATE_EVENT,
  type DemoRunDetail,
  type FontRenderingStateDetail,
  type LocalFontStateDetail,
  type PtyButtonStateDetail,
  type RendererChangeDetail,
  type ShaderPresetChangeDetail,
  type ShellStringValueDetail,
  type TerminalStateDetail,
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
let selectedShaderPreset = usesSvelteShell
  ? "none"
  : ((shaderPresetEl?.value as ShaderPreset | undefined) ?? "none");

const initialFontSize = fontSizeInput?.value ? Number(fontSizeInput.value) : 18;
let selectedFontFamily = fontFamilySelect?.value ?? DEFAULT_FONT_FAMILY;
let selectedLocalFontMatcher = "";
let detectedLocalFontOptions: LocalFontOption[] = [];
let localFontHintText = getDefaultLocalFontHintText(supportsLocalFontPicker());
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

let selectedLigatures = !isFalsyQueryParam(searchParams?.get("ligatures"));
let selectedFontHinting = isTruthyQueryParam(searchParams?.get("hinting"));
let selectedFontHintTarget = resolveFontHintTarget(searchParams?.get("hintTarget"));

function isRendererChoice(value: string | null | undefined): value is RendererChoice {
  return value === "auto" || value === "webgpu" || value === "webgl2";
}

function parseFontSize(value: string | null | undefined, fallback = 18) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function applyShaderPreset() {
  restty.setShaderStages(shaderStagesForPreset(selectedShaderPreset));
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

function syncPauseButton(state: PaneState) {
  if (usesSvelteShell) {
    window.dispatchEvent(
      new CustomEvent(TERMINAL_STATE_EVENT, {
        detail: {
          pauseLabel: state.paused ? "Resume" : "Pause",
        },
      }),
    );
    return;
  }
  if (btnPause) btnPause.textContent = state.paused ? "Resume" : "Pause";
}

function syncTerminalControlValues(state: PaneState) {
  if (usesSvelteShell) {
    window.dispatchEvent(
      new CustomEvent(TERMINAL_STATE_EVENT, {
        detail: {
          pauseLabel: state.paused ? "Resume" : "Pause",
          renderer: state.renderer,
          fontSize: state.fontSize,
        },
      }),
    );
    return;
  }
  if (rendererSelect) rendererSelect.value = state.renderer;
  if (fontSizeInput) fontSizeInput.value = `${state.fontSize}`;
}

function syncPtyButton(pane: ManagedPane) {
  if (usesSvelteShell) {
    const label = pane.runtime.io.isPtyConnected()
      ? "Disconnect"
      : getConnectionBackend(connectionBackendEl) === "webcontainer"
        ? "Start WebContainer"
        : "Connect PTY";
    window.dispatchEvent(
      new CustomEvent(PTY_BUTTON_STATE_EVENT, {
        detail: { label },
      }),
    );
    return;
  }
  if (!ptyBtn) return;
  if (pane.runtime.io.isPtyConnected()) {
    ptyBtn.textContent = "Disconnect";
    return;
  }
  ptyBtn.textContent =
    getConnectionBackend(connectionBackendEl) === "webcontainer"
      ? "Start WebContainer"
      : "Connect PTY";
}

function syncThemeSelectValue(value: string) {
  if (usesSvelteShell) {
    window.dispatchEvent(
      new CustomEvent(THEME_SELECT_STATE_EVENT, {
        detail: { value },
      }),
    );
    return;
  }
  if (themeSelect) {
    themeSelect.value = value;
  }
}

function syncLocalFontControls() {
  const supportsPicker = supportsLocalFontPicker();
  if (usesSvelteShell) {
    window.dispatchEvent(
      new CustomEvent(LOCAL_FONT_STATE_EVENT, {
        detail: {
          value: getLocalFontSelectValue(selectedLocalFontMatcher),
          hintText: localFontHintText,
          loadDisabled: !supportsPicker,
          selectDisabled: !supportsPicker,
          options: [{ value: "", label: "Local Font: None" }, ...detectedLocalFontOptions],
        } satisfies LocalFontStateDetail,
      }),
    );
    return;
  }
  syncFontFamilyControls({
    fontFamilySelect: null,
    fontFamilyLocalSelect,
    btnLoadLocalFonts,
    selectedFontFamily,
    selectedLocalFontMatcher,
    supportsLocalFontPicker: supportsPicker,
  });
  if (fontFamilyHintEl) {
    fontFamilyHintEl.textContent = localFontHintText;
  }
}

function renderActivePaneControls(pane: ManagedPane, state: PaneState) {
  syncTerminalControlValues(state);
  syncFontFamilyValue();
  syncFontFamilyControls({
    fontFamilySelect: usesSvelteShell ? null : fontFamilySelect,
    fontFamilyLocalSelect: usesSvelteShell ? null : fontFamilyLocalSelect,
    btnLoadLocalFonts: usesSvelteShell ? null : btnLoadLocalFonts,
    selectedFontFamily,
    selectedLocalFontMatcher,
    supportsLocalFontPicker: supportsLocalFontPicker(),
  });
  syncLocalFontControls();
  syncFontRenderingControls();
  state.mouseMode = pane.runtime.interaction.getMouseStatus().mode;
  if (usesSvelteShell) {
    window.dispatchEvent(
      new CustomEvent(MOUSE_MODE_STATE_EVENT, {
        detail: { value: state.mouseMode },
      }),
    );
  } else if (mouseModeEl) {
    const hasOption = Array.from(mouseModeEl.options).some(
      (option) => option.value === state.mouseMode,
    );
    mouseModeEl.value = hasOption ? state.mouseMode : "auto";
  }
  syncThemeSelectValue(state.theme.selectValue);
}

function syncFontFamilyValue() {
  if (usesSvelteShell) {
    window.dispatchEvent(
      new CustomEvent(FONT_FAMILY_STATE_EVENT, {
        detail: { value: selectedFontFamily },
      }),
    );
    return;
  }
  if (fontFamilySelect) {
    fontFamilySelect.value = selectedFontFamily;
  }
}

function setPanePaused(id: number, value: boolean) {
  const pane = restty.getPaneById(id);
  const state = paneStates.get(id);
  if (!pane || !state) return;
  const nextState = withPanePaused(state, value);
  paneStates.set(id, nextState);
  pane.paused = nextState.paused;
  pane.runtime.terminal.setPaused(nextState.paused);
  if (id === activePaneId) {
    syncPauseButton(nextState);
  }
}

function connectPaneIfNeeded(pane: ManagedPane) {
  if (getConnectionBackend(connectionBackendEl) !== "webcontainer") return;
  if (pane.runtime.io.isPtyConnected()) return;
  pane.runtime.interaction.updateSize(true);
  pane.runtime.io.connectPty(getConnectUrl(connectionBackendEl, ptyUrlInput));
  requestAnimationFrame(() => {
    pane.runtime.interaction.updateSize(true);
  });
}

async function initPaneApp(pane: ManagedPane, state: PaneState) {
  await pane.runtime.lifecycle.init();
  paneStates.set(
    pane.id,
    applySavedThemeForPane({
      pane,
      state,
    }),
  );
  await waitForAnimationFrame();
  pane.runtime.interaction.updateSize(true);
  connectPaneIfNeeded(pane);
  if (pane.id === activePaneId) {
    syncPtyButton(pane);
  }
  pane.canvas.focus({ preventScroll: true });
}

function queueResizeAllPanes() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    for (const pane of restty.getPanes()) {
      pane.runtime.interaction.updateSize(true);
    }
  });
}

function populateThemeSelect(names: string[]) {
  if (!themeSelect) return;
  const existing = new Set<string>();
  for (const opt of themeSelect.options) {
    if (opt.value) existing.add(opt.value);
  }
  for (const name of names) {
    if (existing.has(name)) continue;
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    themeSelect.appendChild(option);
  }
}

const builtinThemeNames = listBuiltinThemeNames();
populateThemeSelect(builtinThemeNames);
const defaultThemeName = builtinThemeNames.includes(DEFAULT_THEME_NAME) ? DEFAULT_THEME_NAME : "";

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
          setPanePaused(pane.id, value);
        };

        state.demos = createDemoController(pane.runtime);
        pane.runtime.interaction.setMouseMode(state.mouseMode);
        void initPaneApp(pane, state);
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
        syncPtyButton(pane);
        renderActivePaneControls(pane, state);
      },
      onLayoutChanged: () => {
        queueResizeAllPanes();
      },
      onDesktopNotification: handleDesktopNotification,
    },
    defaultContextMenu: {
      canOpen: () => !isSettingsDialogOpen(),
      getPtyUrl: () => getConnectUrl(connectionBackendEl, ptyUrlInput),
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
      renderer: isRendererChoice(rendererSelect?.value) ? rendererSelect.value : "auto",
      fontSize: parseFontSize(
        fontSizeInput?.value,
        Number.isFinite(initialFontSize) ? initialFontSize : 18,
      ),
      mouseMode: mouseModeEl?.value || "auto",
      defaultThemeName,
    });
    paneStates.set(id, paneState);
    return {
      renderer: paneState.renderer,
      fontSize: paneState.fontSize,
      ligatures: selectedLigatures,
      fontHinting: selectedFontHinting,
      fontHintTarget: selectedFontHintTarget,
      // Ghostty parity: use EM sizing semantics and native alpha blending.
      fontSizeMode: "em",
      alphaBlending: "native",
      fontSources: getCurrentFontSources(selectedFontFamily, selectedLocalFontMatcher),
    };
  },
  services: ({ id }) => ({
    ptyTransport: createAdaptivePtyTransport({
      getConnectionBackend: () => getConnectionBackend(connectionBackendEl),
      getPtyUrl: () => getConnectUrl(connectionBackendEl, ptyUrlInput),
      getWebContainerCommand: () => wcCommandInput?.value?.trim() || "jsh",
      getWebContainerCwd: () => wcCwdInput?.value?.trim() || "/",
    }),
    callbacks: {},
  }),
});
applyShaderPreset();

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

connectionBackendEl?.addEventListener("change", () => {
  if (!usesSvelteShell) {
    syncConnectionUi({
      connectionBackendEl,
      ptyUrlInput,
      wcCommandInput,
      wcCwdInput,
      connectionHintEl,
    });
  }
  for (const pane of restty.getPanes()) {
    if (pane.runtime.io.isPtyConnected()) {
      pane.runtime.io.disconnectPty();
    }
  }
  if (getConnectionBackend(connectionBackendEl) === "webcontainer") {
    for (const pane of restty.getPanes()) {
      connectPaneIfNeeded(pane);
    }
  }

  const activePane = getActivePane();
  if (activePane) {
    syncPtyButton(activePane);
  }
});

function handleTerminalInit() {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  setPanePaused(pane.id, false);
  state.demos?.stop();
  void initPaneApp(pane, state);
}

function handleTerminalPauseToggle() {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  setPanePaused(pane.id, !state.paused);
}

function handleTerminalClear() {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state) return;
  state.demos?.stop();
  pane.runtime.terminal.clearScreen();
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
  const pane = getActivePane();
  if (!pane) return;
  if (pane.runtime.io.isPtyConnected()) {
    pane.runtime.io.disconnectPty();
  } else {
    pane.runtime.io.connectPty(getConnectUrl(connectionBackendEl, ptyUrlInput));
  }
  syncPtyButton(pane);
}

if (usesSvelteShell) {
  window.addEventListener(PTY_BUTTON_EVENT, handlePtyButtonClick);
} else {
  ptyBtn?.addEventListener("click", handlePtyButtonClick);
}

function applyRendererChoice(value: string | null | undefined) {
  const pane = getActivePane();
  const state = getActivePaneState(paneStates, activePaneId);
  if (!pane || !state) return;
  if (!isRendererChoice(value)) return;
  state.renderer = value;
  pane.runtime.terminal.setRenderer(value);
}

if (usesSvelteShell) {
  window.addEventListener(TERMINAL_RENDERER_EVENT, (event) => {
    applyRendererChoice((event as RendererChangeEvent).detail?.value);
  });
} else {
  rendererSelect?.addEventListener("change", () => {
    applyRendererChoice(rendererSelect.value);
  });
}

function applyUploadedThemeFile(file: File | null | undefined) {
  const pane = getActivePane();
  const state = getActivePaneState(paneStates, activePaneId);
  if (!pane || !state || !file) return;
  file
    .text()
    .then((text) => {
      const theme: GhosttyTheme = parseGhosttyTheme(text);
      const nextState = applyThemeToPane({
        pane,
        state,
        theme,
        sourceLabel: file.name || "theme file",
      });
      if (nextState) {
        paneStates.set(pane.id, nextState);
        if (pane.id === activePaneId) {
          syncThemeSelectValue(nextState.theme.selectValue);
        }
      }
    })
    .catch((err) => {
      console.error("theme load failed", err);
    })
    .finally(() => {
      if (usesSvelteShell) {
        window.dispatchEvent(new CustomEvent(THEME_FILE_RESET_EVENT));
      } else if (themeFileInput) {
        themeFileInput.value = "";
      }
    });
}

if (usesSvelteShell) {
  window.addEventListener(THEME_FILE_CHANGE_EVENT, (event) => {
    applyUploadedThemeFile((event as ThemeFileChangeEvent).detail?.file);
  });
} else if (themeFileInput) {
  themeFileInput.addEventListener("change", () => {
    applyUploadedThemeFile(themeFileInput.files?.[0]);
  });
}

function applyThemeSelection(name: string | null | undefined) {
  const pane = getActivePane();
  const state = getActivePaneState(paneStates, activePaneId);
  if (!pane || !state) return;
  if (!name) {
    paneStates.set(
      pane.id,
      resetThemeForPane({
        pane,
        state,
      }),
    );
    if (pane.id === activePaneId) {
      syncThemeSelectValue("");
    }
    return;
  }
  const nextState = applyBuiltinThemeToPane({
    pane,
    state,
    name,
  });
  if (nextState) {
    paneStates.set(pane.id, nextState);
    if (pane.id === activePaneId) {
      syncThemeSelectValue(nextState.theme.selectValue);
    }
  }
}

if (usesSvelteShell) {
  window.addEventListener(THEME_SELECT_CHANGE_EVENT, (event) => {
    applyThemeSelection((event as ThemeSelectChangeEvent).detail?.value);
  });
} else if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    applyThemeSelection(themeSelect.value);
  });
}

function applyMouseMode(value: string | null | undefined) {
  const pane = getActivePane();
  const state = getActivePaneState(paneStates, activePaneId);
  if (!pane || !state) return;
  pane.runtime.interaction.setMouseMode(value ?? "auto");
  state.mouseMode = pane.runtime.interaction.getMouseStatus().mode;
  if (pane.id === activePaneId && usesSvelteShell) {
    window.dispatchEvent(
      new CustomEvent(MOUSE_MODE_STATE_EVENT, {
        detail: { value: state.mouseMode },
      }),
    );
  } else if (pane.id === activePaneId && mouseModeEl) {
    mouseModeEl.value = state.mouseMode;
  }
}

if (usesSvelteShell) {
  window.addEventListener(MOUSE_MODE_CHANGE_EVENT, (event) => {
    applyMouseMode((event as MouseModeChangeEvent).detail?.value);
  });
} else if (mouseModeEl) {
  mouseModeEl.addEventListener("change", () => {
    applyMouseMode(mouseModeEl.value);
  });
}

function applySelectedShaderPreset(value: ShaderPreset | string | null | undefined) {
  if (
    value !== "none" &&
    value !== "scanline" &&
    value !== "aurora" &&
    value !== "crt-lite" &&
    value !== "mono-green"
  ) {
    selectedShaderPreset = "none";
  } else {
    selectedShaderPreset = value;
  }
  applyShaderPreset();
}

if (usesSvelteShell) {
  window.addEventListener(SHADER_PRESET_CHANGE_EVENT, (event) => {
    applySelectedShaderPreset((event as ShaderPresetChangeEvent).detail?.value);
  });
} else if (shaderPresetEl) {
  shaderPresetEl.addEventListener("change", () => {
    applySelectedShaderPreset(shaderPresetEl.value);
  });
}

function applyFontSizeValue(value: string | null | undefined) {
  const pane = getActivePane();
  const state = getActivePaneState(paneStates, activePaneId);
  if (!pane || !state) return;
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return;
  state.fontSize = nextValue;
  pane.runtime.terminal.setFontSize(nextValue);
}

if (usesSvelteShell) {
  window.addEventListener(TERMINAL_FONT_SIZE_EVENT, (event) => {
    applyFontSizeValue((event as FontSizeChangeEvent).detail?.value);
  });
} else if (fontSizeInput) {
  const applyFontSize = () => {
    applyFontSizeValue(fontSizeInput.value);
  };

  fontSizeInput.addEventListener("change", applyFontSize);
  fontSizeInput.addEventListener("input", applyFontSize);
}

function applyFontRenderingSelections() {
  syncFontRenderingControls();
  applyFontRenderingOptionsToAllPanes({
    host: restty,
    selectedLigatures,
    selectedFontHinting,
    selectedFontHintTarget,
  });
}

function syncFontRenderingControls() {
  if (usesSvelteShell) {
    window.dispatchEvent(
      new CustomEvent(FONT_RENDERING_STATE_EVENT, {
        detail: {
          ligatures: selectedLigatures ? "on" : "off",
          fontHinting: selectedFontHinting ? "on" : "off",
          fontHintTarget: selectedFontHintTarget,
        },
      }),
    );
    return;
  }
  syncHintingControls({
    ligaturesSelect,
    fontHintingSelect,
    fontHintTargetSelect,
    selectedLigatures,
    selectedFontHinting,
    selectedFontHintTarget,
  });
}

if (usesSvelteShell) {
  window.addEventListener(FONT_HINTING_CHANGE_EVENT, (event) => {
    selectedFontHinting = (event as FontControlChangeEvent).detail?.value === "on";
    applyFontRenderingSelections();
  });
  window.addEventListener(FONT_LIGATURES_CHANGE_EVENT, (event) => {
    selectedLigatures = (event as FontControlChangeEvent).detail?.value === "on";
    applyFontRenderingSelections();
  });
  window.addEventListener(FONT_HINT_TARGET_CHANGE_EVENT, (event) => {
    selectedFontHintTarget = resolveFontHintTarget((event as FontControlChangeEvent).detail?.value);
    applyFontRenderingSelections();
  });
} else {
  if (fontHintingSelect) {
    fontHintingSelect.addEventListener("change", () => {
      selectedFontHinting = fontHintingSelect.value === "on";
      applyFontRenderingSelections();
    });
  }

  if (ligaturesSelect) {
    ligaturesSelect.addEventListener("change", () => {
      selectedLigatures = ligaturesSelect.value === "on";
      applyFontRenderingSelections();
    });
  }

  if (fontHintTargetSelect) {
    fontHintTargetSelect.addEventListener("change", () => {
      selectedFontHintTarget = resolveFontHintTarget(fontHintTargetSelect.value);
      applyFontRenderingSelections();
    });
  }
}

if (fontFamilySelect) {
  const applyFontFamilySelection = (value: string | null | undefined) => {
    selectedFontFamily = value || DEFAULT_FONT_FAMILY;
    syncFontFamilyValue();
    syncFontFamilyControls({
      fontFamilySelect: usesSvelteShell ? null : fontFamilySelect,
      fontFamilyLocalSelect: usesSvelteShell ? null : fontFamilyLocalSelect,
      btnLoadLocalFonts: usesSvelteShell ? null : btnLoadLocalFonts,
      selectedFontFamily,
      selectedLocalFontMatcher,
      supportsLocalFontPicker: supportsLocalFontPicker(),
    });
    syncLocalFontControls();
    void applyFontSourcesToAllPanes({
      host: restty,
      selectedFontFamily,
      selectedLocalFontMatcher,
      onError: (error) => {
        console.error("font source apply failed", error);
      },
    });
  };

  if (usesSvelteShell) {
    window.addEventListener(FONT_FAMILY_CHANGE_EVENT, (event) => {
      applyFontFamilySelection((event as FontControlChangeEvent).detail?.value);
    });
  } else {
    fontFamilySelect.addEventListener("change", () => {
      applyFontFamilySelection(fontFamilySelect.value);
    });
  }
}

function applyLocalFontSelection(value: string | null | undefined) {
  if (!value) {
    selectedLocalFontMatcher = "";
  } else if (value.startsWith(FONT_FAMILY_LOCAL_PREFIX)) {
    const encoded = value.slice(FONT_FAMILY_LOCAL_PREFIX.length);
    selectedLocalFontMatcher = decodeURIComponent(encoded).trim().toLowerCase();
  } else {
    selectedLocalFontMatcher = "";
  }
  syncFontFamilyControls({
    fontFamilySelect: usesSvelteShell ? null : fontFamilySelect,
    fontFamilyLocalSelect: usesSvelteShell ? null : fontFamilyLocalSelect,
    btnLoadLocalFonts: usesSvelteShell ? null : btnLoadLocalFonts,
    selectedFontFamily,
    selectedLocalFontMatcher,
    supportsLocalFontPicker: supportsLocalFontPicker(),
  });
  syncLocalFontControls();
  void applyFontSourcesToAllPanes({
    host: restty,
    selectedFontFamily,
    selectedLocalFontMatcher,
    onError: (error) => {
      console.error("font source apply failed", error);
    },
  });
}

if (usesSvelteShell) {
  window.addEventListener(FONT_FAMILY_LOCAL_CHANGE_EVENT, (event) => {
    applyLocalFontSelection((event as LocalFontControlChangeEvent).detail?.value);
  });
  window.addEventListener(LOAD_LOCAL_FONTS_EVENT, () => {
    void detectLocalFontState().then((state) => {
      detectedLocalFontOptions = state.detectedOptions;
      localFontHintText = state.hintText;
      syncLocalFontControls();
    });
  });
} else {
  if (fontFamilyLocalSelect) {
    fontFamilyLocalSelect.addEventListener("change", () => {
      applyLocalFontSelection(fontFamilyLocalSelect.value);
    });
  }

  if (btnLoadLocalFonts) {
    btnLoadLocalFonts.addEventListener("click", () => {
      void detectLocalFonts({
        fontFamilyLocalSelect,
        fontFamilyHintEl,
      });
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
syncFontFamilyControls({
  fontFamilySelect: usesSvelteShell ? null : fontFamilySelect,
  fontFamilyLocalSelect: usesSvelteShell ? null : fontFamilyLocalSelect,
  btnLoadLocalFonts: usesSvelteShell ? null : btnLoadLocalFonts,
  selectedFontFamily,
  selectedLocalFontMatcher,
  supportsLocalFontPicker: supportsLocalFontPicker(),
});
syncFontFamilyValue();
syncLocalFontControls();
syncHintingControls({
  ligaturesSelect,
  fontHintingSelect,
  fontHintTargetSelect,
  selectedLigatures,
  selectedFontHinting,
  selectedFontHintTarget,
});
const firstPane = restty.createInitialPane({ focus: true });
activePaneId = firstPane.id;
const firstState = paneStates.get(firstPane.id);
if (firstState) {
  syncPtyButton(firstPane);
  renderActivePaneControls(firstPane, firstState);
}
queueResizeAllPanes();

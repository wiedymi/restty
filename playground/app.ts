import {
  Restty,
  createWebSocketPtyTransport,
  listBuiltinThemeNames,
  getBuiltinTheme,
  parseGhosttyTheme,
  type GhosttyTheme,
  type PtyTransport,
  type ResttyFontSource,
  type ResttyManagedAppPane,
} from "../src/internal.ts";
import { createDemoController, type PlaygroundDemoKind } from "./lib/demos.ts";
import { createWebContainerPtyTransport } from "./lib/webcontainer-pty.ts";

const paneRoot = document.getElementById("paneRoot") as HTMLElement | null;
if (!paneRoot) {
  throw new Error("missing #paneRoot element");
}

const backendEl = document.getElementById("backend");
const fpsEl = document.getElementById("fps");
const termSizeEl = document.getElementById("termSize");
const ptyStatusEl = document.getElementById("ptyStatus");

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
const fontFamilyLocalSelect = document.getElementById(
  "fontFamilyLocal",
) as HTMLSelectElement | null;
const btnLoadLocalFonts = document.getElementById("btnLoadLocalFonts") as HTMLButtonElement | null;
const fontFamilyHintEl = document.getElementById("fontFamilyHint");
const mouseModeEl = document.getElementById("mouseMode") as HTMLSelectElement | null;
const settingsFab = document.getElementById("settingsFab") as HTMLButtonElement | null;
const settingsDialog = document.getElementById("settingsDialog") as HTMLDialogElement | null;
const settingsClose = document.getElementById("settingsClose") as HTMLButtonElement | null;

const DEFAULT_THEME_NAME = "Aizen Dark";
const DEFAULT_FONT_FAMILY = "jetbrains";
const FONT_FAMILY_LOCAL_PREFIX = "local:";
const FONT_URL_JETBRAINS_MONO =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf";
const FONT_URL_NERD_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf";
const FONT_URL_NOTO_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/unhinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf";
const FONT_URL_SYMBOLA = "https://cdn.jsdelivr.net/gh/ChiefMikeK/ttf-symbola@master/Symbola.ttf";
const FONT_URL_NOTO_COLOR_EMOJI =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf";
const FONT_URL_OPENMOJI =
  "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/font/OpenMoji-black-glyf/OpenMoji-black-glyf.ttf";
const FONT_URL_NOTO_CJK_SC =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf";

type RendererChoice = "auto" | "webgpu" | "webgl2";
type ConnectionBackend = "ws" | "webcontainer";

type PaneUiState = {
  backend: string;
  fps: string;
  termSize: string;
  ptyStatus: string;
};

type PaneThemeState = {
  selectValue: string;
  sourceLabel: string;
  theme: GhosttyTheme | null;
};

type PaneState = {
  id: number;
  renderer: RendererChoice;
  fontSize: number;
  mouseMode: string;
  paused: boolean;
  theme: PaneThemeState;
  demos: ReturnType<typeof createDemoController> | null;
  ui: PaneUiState;
};

const paneStates = new Map<number, PaneState>();
let activePaneId: number | null = null;
let resizeRaf = 0;
let restty: Restty;

const initialFontSize = fontSizeInput?.value ? Number(fontSizeInput.value) : 18;
let selectedFontFamily = fontFamilySelect?.value ?? DEFAULT_FONT_FAMILY;
let selectedLocalFontMatcher = "";

function setText(el: HTMLElement | null, value: string) {
  if (el) el.textContent = value;
}

function isRendererChoice(value: string | null | undefined): value is RendererChoice {
  return value === "auto" || value === "webgpu" || value === "webgl2";
}

function parseFontSize(value: string | null | undefined, fallback = 18) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function supportsLocalFontPicker() {
  return typeof window !== "undefined" && "queryLocalFonts" in window;
}

function setFontFamilyHint(text: string) {
  if (fontFamilyHintEl) fontFamilyHintEl.textContent = text;
}

function buildFontSourcesForSelection(value: string, localMatcher: string): ResttyFontSource[] {
  const sources: ResttyFontSource[] = [];

  if (localMatcher) {
    sources.push({
      type: "local",
      label: `local:${localMatcher}`,
      matchers: [localMatcher],
      required: true,
    });
  }

  if (value === "jetbrains") {
    sources.push({
      type: "local",
      label: "local:jetbrains mono",
      matchers: ["jetbrains mono"],
    });
  }

  sources.push({
    type: "url",
    label: "JetBrains Mono",
    url: FONT_URL_JETBRAINS_MONO,
  });
  sources.push({
    type: "url",
    label: "Symbols Nerd Font Mono",
    url: FONT_URL_NERD_SYMBOLS,
  });
  sources.push({
    type: "local",
    label: "Apple Symbols",
    matchers: ["apple symbols", "applesymbols", "apple symbols regular"],
    required: true,
  });
  sources.push({
    type: "url",
    label: "Noto Sans Symbols 2",
    url: FONT_URL_NOTO_SYMBOLS,
  });
  sources.push({
    type: "url",
    label: "Symbola",
    url: FONT_URL_SYMBOLA,
  });
  sources.push({
    type: "local",
    label: "Apple Color Emoji",
    matchers: ["apple color emoji", "applecoloremoji"],
    required: true,
  });
  sources.push({
    type: "url",
    label: "Noto Color Emoji",
    url: FONT_URL_NOTO_COLOR_EMOJI,
  });
  sources.push({
    type: "url",
    label: "OpenMoji",
    url: FONT_URL_OPENMOJI,
  });
  sources.push({
    type: "url",
    label: "Noto Sans CJK SC",
    url: FONT_URL_NOTO_CJK_SC,
  });

  return sources;
}

function getCurrentFontSources(): ResttyFontSource[] {
  return buildFontSourcesForSelection(selectedFontFamily, selectedLocalFontMatcher);
}

function syncFontFamilyControls() {
  if (fontFamilySelect) {
    fontFamilySelect.value = selectedFontFamily;
  }
  if (fontFamilyLocalSelect) {
    fontFamilyLocalSelect.value = selectedLocalFontMatcher
      ? `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(selectedLocalFontMatcher)}`
      : "";
  }
  if (!supportsLocalFontPicker() && btnLoadLocalFonts) {
    btnLoadLocalFonts.disabled = true;
  }
  if (!supportsLocalFontPicker() && fontFamilyLocalSelect) {
    fontFamilyLocalSelect.disabled = true;
  }
}

async function applyFontSourcesToAllPanes() {
  try {
    await restty.setFontSources(getCurrentFontSources());
  } catch (err: any) {
    console.error("font source apply failed", err);
  }
}

function upsertDetectedLocalFontOption(family: string) {
  if (!fontFamilyLocalSelect) return;
  const matcher = family.trim().toLowerCase();
  if (!matcher) return;
  const value = `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(matcher)}`;
  for (let i = 0; i < fontFamilyLocalSelect.options.length; i += 1) {
    if (fontFamilyLocalSelect.options[i]?.value === value) return;
  }
  const option = document.createElement("option");
  option.value = value;
  option.textContent = `Local Font: ${family}`;
  option.dataset.localDetected = "1";
  fontFamilyLocalSelect.appendChild(option);
}

async function detectLocalFonts() {
  if (!supportsLocalFontPicker()) {
    setFontFamilyHint("Local font picker is not supported in this browser.");
    return;
  }
  try {
    if (fontFamilyLocalSelect) {
      for (let i = fontFamilyLocalSelect.options.length - 1; i >= 0; i -= 1) {
        if (fontFamilyLocalSelect.options[i]?.dataset.localDetected === "1") {
          fontFamilyLocalSelect.remove(i);
        }
      }
    }
    const fonts = await (window as any).queryLocalFonts();
    const seen = new Set<string>();
    let added = 0;
    for (let i = 0; i < fonts.length; i += 1) {
      const family = String(fonts[i]?.family ?? "").trim();
      if (!family) continue;
      const key = family.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      upsertDetectedLocalFontOption(family);
      added += 1;
    }
    if (fontFamilyLocalSelect) {
      fontFamilyLocalSelect.disabled = false;
    }
    setFontFamilyHint(`Detected ${added} local font families.`);
  } catch {
    setFontFamilyHint("Local font access denied or unavailable.");
  }
}

function getConnectionBackend(): ConnectionBackend {
  const value = connectionBackendEl?.value;
  return value === "webcontainer" ? "webcontainer" : "ws";
}

function getConnectUrl(): string {
  if (getConnectionBackend() === "webcontainer") return "";
  return ptyUrlInput?.value?.trim() ?? "";
}

function syncConnectionUi() {
  const backend = getConnectionBackend();
  const webcontainerMode = backend === "webcontainer";
  if (ptyUrlInput) ptyUrlInput.disabled = webcontainerMode;
  if (wcCommandInput) wcCommandInput.disabled = !webcontainerMode;
  if (wcCwdInput) wcCwdInput.disabled = !webcontainerMode;
  if (connectionHintEl) {
    connectionHintEl.textContent = webcontainerMode
      ? "Using in-browser WebContainer process"
      : "Using WebSocket PTY URL";
  }
}

function createAdaptivePtyTransport(): PtyTransport {
  const wsTransport = createWebSocketPtyTransport();
  const webContainerTransport = createWebContainerPtyTransport({
    getCommand: () => wcCommandInput?.value?.trim() || "jsh",
    getCwd: () => wcCwdInput?.value?.trim() || "/",
  });

  let activeTransport: PtyTransport | null = null;
  const pickTransport = () =>
    getConnectionBackend() === "webcontainer" ? webContainerTransport : wsTransport;

  return {
    connect: (options) => {
      const nextTransport = pickTransport();
      if (activeTransport && activeTransport !== nextTransport) {
        activeTransport.disconnect();
      }
      activeTransport = nextTransport;
      return nextTransport.connect(options);
    },
    disconnect: () => {
      activeTransport?.disconnect();
      wsTransport.disconnect();
      webContainerTransport.disconnect();
      activeTransport = null;
    },
    sendInput: (data: string) => {
      return activeTransport?.sendInput(data) ?? false;
    },
    resize: (cols: number, rows: number) => {
      return activeTransport?.resize(cols, rows) ?? false;
    },
    isConnected: () => {
      return activeTransport?.isConnected() ?? false;
    },
    destroy: () => {
      activeTransport?.disconnect();
      wsTransport.destroy?.();
      webContainerTransport.destroy?.();
      activeTransport = null;
    },
  };
}

function isSettingsDialogOpen() {
  return Boolean(settingsDialog?.open);
}

function restoreTerminalFocus() {
  const pane = restty.getFocusedPane() ?? restty.getActivePane() ?? restty.getPanes()[0] ?? null;
  if (!pane) return;
  pane.canvas.focus({ preventScroll: true });
}

function openSettingsDialog() {
  restty.hideContextMenu();
  if (!settingsDialog || settingsDialog.open) return;
  if (typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
    return;
  }
  settingsDialog.setAttribute("open", "");
}

function closeSettingsDialog() {
  if (!settingsDialog || !settingsDialog.open) return;
  if (typeof settingsDialog.close === "function") {
    settingsDialog.close();
  } else {
    settingsDialog.removeAttribute("open");
  }
  restoreTerminalFocus();
}

function createDefaultPaneUi(): PaneUiState {
  return {
    backend: "-",
    fps: "0",
    termSize: "0x0",
    ptyStatus: "disconnected",
  };
}

function createPaneState(id: number, sourcePane: ResttyManagedAppPane | null): PaneState {
  const sourceState = sourcePane ? paneStates.get(sourcePane.id) : null;
  return {
    id,
    renderer:
      sourceState?.renderer ??
      (isRendererChoice(rendererSelect?.value) ? rendererSelect.value : "auto"),
    fontSize:
      sourceState?.fontSize ??
      parseFontSize(fontSizeInput?.value, Number.isFinite(initialFontSize) ? initialFontSize : 18),
    mouseMode: sourceState?.mouseMode ?? (mouseModeEl?.value || "auto"),
    paused: sourceState?.paused ?? false,
    theme: sourceState
      ? {
          selectValue: sourceState.theme.selectValue,
          sourceLabel: sourceState.theme.sourceLabel,
          theme: sourceState.theme.theme,
        }
      : {
          selectValue: defaultThemeName,
          sourceLabel: defaultThemeName ? "default theme" : "",
          theme: null,
        },
    demos: null,
    ui: createDefaultPaneUi(),
  };
}

function getActivePane(): ResttyManagedAppPane | null {
  return restty.getActivePane();
}

function getActivePaneState(): PaneState | null {
  if (activePaneId === null) return null;
  return paneStates.get(activePaneId) ?? null;
}

function syncPauseButton(state: PaneState) {
  if (btnPause) btnPause.textContent = state.paused ? "Resume" : "Pause";
}

function syncPtyButton(pane: ResttyManagedAppPane, state: PaneState) {
  if (!ptyBtn) return;
  if (pane.app.isPtyConnected()) {
    ptyBtn.textContent = "Disconnect";
    return;
  }
  ptyBtn.textContent =
    getConnectionBackend() === "webcontainer" ? "Start WebContainer" : "Connect PTY";
  setText(ptyStatusEl, state.ui.ptyStatus);
}

function renderActivePaneStatus(pane: ResttyManagedAppPane, state: PaneState) {
  setText(backendEl, state.ui.backend);
  setText(fpsEl, state.ui.fps);
  setText(termSizeEl, state.ui.termSize);
  setText(ptyStatusEl, state.ui.ptyStatus);
  syncPtyButton(pane, state);
}

function renderActivePaneControls(pane: ResttyManagedAppPane, state: PaneState) {
  syncPauseButton(state);
  if (rendererSelect) rendererSelect.value = state.renderer;
  if (fontSizeInput) fontSizeInput.value = `${state.fontSize}`;
  syncFontFamilyControls();
  state.mouseMode = pane.app.getMouseStatus().mode;
  if (mouseModeEl) {
    const hasOption = Array.from(mouseModeEl.options).some((option) => option.value === state.mouseMode);
    mouseModeEl.value = hasOption ? state.mouseMode : "auto";
  }
  if (themeSelect) themeSelect.value = state.theme.selectValue;
}

function updatePaneUi(id: number, update: (state: PaneState) => void) {
  const state = paneStates.get(id);
  if (!state) return;
  update(state);
  if (id !== activePaneId) return;
  const pane = restty.getPaneById(id);
  if (!pane) return;
  renderActivePaneStatus(pane, state);
}

function setPanePaused(id: number, value: boolean) {
  const pane = restty.getPaneById(id);
  const state = paneStates.get(id);
  if (!pane || !state) return;
  state.paused = Boolean(value);
  pane.paused = state.paused;
  pane.app.setPaused(state.paused);
  if (id === activePaneId) {
    syncPauseButton(state);
  }
}

function connectPaneIfNeeded(pane: ResttyManagedAppPane) {
  if (getConnectionBackend() !== "webcontainer") return;
  if (pane.app.isPtyConnected()) return;
  pane.app.connectPty(getConnectUrl());
}

function applyThemeToPane(
  pane: ResttyManagedAppPane,
  state: PaneState,
  theme: GhosttyTheme,
  sourceLabel: string,
  selectValue = "",
): boolean {
  try {
    pane.app.applyTheme(theme, sourceLabel);
    state.theme = {
      selectValue,
      sourceLabel,
      theme,
    };
    if (pane.id === activePaneId && themeSelect) {
      themeSelect.value = selectValue;
    }
    return true;
  } catch (err) {
    console.error("theme apply failed", err);
    return false;
  }
}

function applyBuiltinThemeToPane(
  pane: ResttyManagedAppPane,
  state: PaneState,
  name: string,
  sourceLabel = name,
): boolean {
  const theme = getBuiltinTheme(name);
  if (!theme) return false;
  return applyThemeToPane(pane, state, theme, sourceLabel, name);
}

function resetThemeForPane(pane: ResttyManagedAppPane, state: PaneState) {
  pane.app.resetTheme();
  state.theme = {
    selectValue: "",
    sourceLabel: "",
    theme: null,
  };
  if (pane.id === activePaneId && themeSelect) {
    themeSelect.value = "";
  }
}

function queueResizeAllPanes() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    for (const pane of restty.getPanes()) {
      pane.app.updateSize(true);
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
  createInitialPane: false,
  autoInit: false,
  paneStyles: {
    inactivePaneOpacity: 0.9,
  },
  appOptions: ({ id, sourcePane }) => {
    const paneState = createPaneState(id, sourcePane);
    paneStates.set(id, paneState);
    return {
      renderer: paneState.renderer,
      fontSize: paneState.fontSize,
      fontSources: getCurrentFontSources(),
      ptyTransport: createAdaptivePtyTransport(),
      callbacks: {
        onBackend: (backend) => {
          updatePaneUi(id, (state) => {
            state.ui.backend = backend;
          });
        },
        onFps: (fps) => {
          updatePaneUi(id, (state) => {
            state.ui.fps = `${Math.round(fps)}`;
          });
        },
        onTermSize: (cols, rows) => {
          updatePaneUi(id, (state) => {
            state.ui.termSize = `${cols}x${rows}`;
          });
        },
        onPtyStatus: (status) => {
          updatePaneUi(id, (state) => {
            state.ui.ptyStatus = status;
          });
        },
      },
    };
  },
  onPaneCreated: (pane) => {
    const state = paneStates.get(pane.id);
    if (!state) return;

    pane.paused = state.paused;
    pane.setPaused = (value: boolean) => {
      setPanePaused(pane.id, value);
    };

    state.demos = createDemoController(pane.app);
    pane.app.setMouseMode(state.mouseMode);

    if (state.theme.selectValue) {
      applyBuiltinThemeToPane(pane, state, state.theme.selectValue, state.theme.sourceLabel);
    } else if (state.theme.theme) {
      applyThemeToPane(
        pane,
        state,
        state.theme.theme,
        state.theme.sourceLabel || "pane theme",
        state.theme.selectValue,
      );
    }

    void pane.app.init().then(() => {
      connectPaneIfNeeded(pane);
    });
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
    renderActivePaneStatus(pane, state);
    renderActivePaneControls(pane, state);
  },
  onLayoutChanged: () => {
    queueResizeAllPanes();
  },
  defaultContextMenu: {
    canOpen: () => !isSettingsDialogOpen(),
    getPtyUrl: () => getConnectUrl(),
  },
  shortcuts: {
    enabled: true,
    canHandleEvent: () => !isSettingsDialogOpen(),
  },
});

settingsFab?.addEventListener("click", () => {
  openSettingsDialog();
});

settingsClose?.addEventListener("click", () => {
  closeSettingsDialog();
});

settingsDialog?.addEventListener("click", (event) => {
  if (event.target !== settingsDialog) return;
  closeSettingsDialog();
});

settingsDialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSettingsDialog();
});

window.addEventListener(
  "keydown",
  (event) => {
    if (isSettingsDialogOpen() && event.key === "Escape") {
      event.preventDefault();
      closeSettingsDialog();
    }
  },
  { capture: true },
);

window.addEventListener("resize", () => {
  queueResizeAllPanes();
});

connectionBackendEl?.addEventListener("change", () => {
  syncConnectionUi();
  for (const pane of restty.getPanes()) {
    if (pane.app.isPtyConnected()) {
      pane.app.disconnectPty();
    }
  }
  if (getConnectionBackend() === "webcontainer") {
    for (const pane of restty.getPanes()) {
      connectPaneIfNeeded(pane);
    }
  }

  const activePane = getActivePane();
  const activeState = getActivePaneState();
  if (activePane && activeState) {
    syncPtyButton(activePane, activeState);
  }
});

btnInit?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState();
  if (!state) return;
  setPanePaused(pane.id, false);
  state.demos?.stop();
  void pane.app.init().then(() => {
    connectPaneIfNeeded(pane);
  });
});

btnPause?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState();
  if (!state) return;
  setPanePaused(pane.id, !state.paused);
});

btnClear?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  const state = getActivePaneState();
  if (!state) return;
  state.demos?.stop();
  pane.app.clearScreen();
});

btnRunDemo?.addEventListener("click", () => {
  const state = getActivePaneState();
  if (!state) return;
  state.demos?.run((demoSelect?.value as PlaygroundDemoKind | string) ?? "basic");
});

ptyBtn?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  if (pane.app.isPtyConnected()) {
    pane.app.disconnectPty();
  } else {
    pane.app.connectPty(getConnectUrl());
  }
});

rendererSelect?.addEventListener("change", () => {
  const pane = getActivePane();
  const state = getActivePaneState();
  if (!pane || !state) return;
  const value = rendererSelect.value;
  if (!isRendererChoice(value)) return;
  state.renderer = value;
  pane.app.setRenderer(value);
});

if (themeFileInput) {
  themeFileInput.addEventListener("change", () => {
    const pane = getActivePane();
    const state = getActivePaneState();
    const file = themeFileInput.files?.[0];
    if (!pane || !state || !file) return;
    file
      .text()
      .then((text) => {
        const theme: GhosttyTheme = parseGhosttyTheme(text);
        if (applyThemeToPane(pane, state, theme, file.name || "theme file", "") && themeSelect) {
          themeSelect.value = "";
        }
      })
      .catch((err) => {
        console.error("theme load failed", err);
      })
      .finally(() => {
        themeFileInput.value = "";
      });
  });
}

if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    const pane = getActivePane();
    const state = getActivePaneState();
    if (!pane || !state) return;
    const name = themeSelect.value;
    if (!name) {
      resetThemeForPane(pane, state);
      return;
    }
    applyBuiltinThemeToPane(pane, state, name);
  });
}

if (mouseModeEl) {
  mouseModeEl.addEventListener("change", () => {
    const pane = getActivePane();
    const state = getActivePaneState();
    if (!pane || !state) return;
    const value = mouseModeEl.value;
    pane.app.setMouseMode(value);
    state.mouseMode = pane.app.getMouseStatus().mode;
    if (pane.id === activePaneId) {
      mouseModeEl.value = state.mouseMode;
    }
  });
}

if (fontSizeInput) {
  const applyFontSize = () => {
    const pane = getActivePane();
    const state = getActivePaneState();
    if (!pane || !state) return;
    const value = Number(fontSizeInput.value);
    if (!Number.isFinite(value)) return;
    state.fontSize = value;
    pane.app.setFontSize(value);
  };

  fontSizeInput.addEventListener("change", applyFontSize);
  fontSizeInput.addEventListener("input", applyFontSize);
}

if (fontFamilySelect) {
  fontFamilySelect.addEventListener("change", () => {
    selectedFontFamily = fontFamilySelect.value || DEFAULT_FONT_FAMILY;
    syncFontFamilyControls();
    void applyFontSourcesToAllPanes();
  });
}

if (fontFamilyLocalSelect) {
  fontFamilyLocalSelect.addEventListener("change", () => {
    const value = fontFamilyLocalSelect.value;
    if (!value) {
      selectedLocalFontMatcher = "";
    } else if (value.startsWith(FONT_FAMILY_LOCAL_PREFIX)) {
      const encoded = value.slice(FONT_FAMILY_LOCAL_PREFIX.length);
      selectedLocalFontMatcher = decodeURIComponent(encoded).trim().toLowerCase();
    } else {
      selectedLocalFontMatcher = "";
    }
    syncFontFamilyControls();
    void applyFontSourcesToAllPanes();
  });
}

if (btnLoadLocalFonts) {
  btnLoadLocalFonts.addEventListener("click", () => {
    void detectLocalFonts();
  });
}

syncConnectionUi();
syncFontFamilyControls();
if (supportsLocalFontPicker()) {
  setFontFamilyHint("Select a base font, then pick a local font from the local picker.");
} else {
  setFontFamilyHint("Local font picker is not supported in this browser.");
}

const firstPane = restty.createInitialPane({ focus: true });
activePaneId = firstPane.id;
const firstState = paneStates.get(firstPane.id);
if (firstState) {
  renderActivePaneStatus(firstPane, firstState);
  renderActivePaneControls(firstPane, firstState);
}
queueResizeAllPanes();

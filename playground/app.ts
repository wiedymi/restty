import {
  createResttyApp,
  createResttyAppSession,
  createResttyPaneManager,
  createDefaultResttyPaneContextMenuItems,
  getResttyShortcutModifierLabel,
} from "../src/app/index.ts";
import {
  createWebSocketPtyTransport,
  listBuiltinThemeNames,
  getBuiltinTheme,
  parseGhosttyTheme,
  type GhosttyTheme,
  type PtyTransport,
  type ResttyFontSource,
} from "../src/index.ts";
import { createDemoController } from "./lib/demos.ts";
import { parseCodepointInput } from "./lib/codepoint.ts";
import { createWebContainerPtyTransport } from "./lib/webcontainer-pty.ts";

const paneRoot = document.getElementById("paneRoot") as HTMLElement | null;
if (!paneRoot) {
  throw new Error("missing #paneRoot element");
}

const backendEl = document.getElementById("backend");
const fpsEl = document.getElementById("fps");
const dprEl = document.getElementById("dpr");
const sizeEl = document.getElementById("size");
const gridEl = document.getElementById("grid");
const cellEl = document.getElementById("cell");
const termSizeEl = document.getElementById("termSize");
const cursorPosEl = document.getElementById("cursorPos");
const inputDebugEl = document.getElementById("inputDebug");
const dbgEl = document.getElementById("dbg");
const ptyStatusEl = document.getElementById("ptyStatus");
const mouseStatusEl = document.getElementById("mouseStatus");
const logEl = document.getElementById("log");
const logDumpEl = document.getElementById("logDump") as HTMLTextAreaElement | null;
const atlasInfoEl = document.getElementById("atlasInfo");
const atlasCanvas = document.getElementById("atlasCanvas") as HTMLCanvasElement | null;

const btnInit = document.getElementById("btnInit");
const btnPause = document.getElementById("btnPause");
const btnClear = document.getElementById("btnClear");
const rendererSelect = document.getElementById("rendererSelect") as HTMLSelectElement | null;
const demoSelect = document.getElementById("demoSelect") as HTMLSelectElement | null;
const btnRunDemo = document.getElementById("btnRunDemo");
const connectionBackendEl = document.getElementById("connectionBackend") as HTMLSelectElement | null;
const ptyUrlInput = document.getElementById("ptyUrl") as HTMLInputElement | null;
const wcCommandInput = document.getElementById("wcCommand") as HTMLInputElement | null;
const wcCwdInput = document.getElementById("wcCwd") as HTMLInputElement | null;
const connectionHintEl = document.getElementById("connectionHint") as HTMLElement | null;
const ptyBtn = document.getElementById("btnPty");
const themeSelect = document.getElementById("themeSelect") as HTMLSelectElement | null;
const themeFileInput = document.getElementById("themeFile") as HTMLInputElement | null;
const fontSizeInput = document.getElementById("fontSize") as HTMLInputElement | null;
const fontFamilySelect = document.getElementById("fontFamily") as HTMLSelectElement | null;
const fontFamilyLocalSelect = document.getElementById("fontFamilyLocal") as HTMLSelectElement | null;
const btnLoadLocalFonts = document.getElementById("btnLoadLocalFonts") as HTMLButtonElement | null;
const fontFamilyHintEl = document.getElementById("fontFamilyHint");
const atlasCpInput = document.getElementById("atlasCp") as HTMLInputElement | null;
const atlasBtn = document.getElementById("btnAtlas");
const btnCopyLog = document.getElementById("btnCopyLog");
const btnClearLog = document.getElementById("btnClearLog");
const mouseModeEl = document.getElementById("mouseMode") as HTMLSelectElement | null;
const settingsFab = document.getElementById("settingsFab") as HTMLButtonElement | null;
const settingsDialog = document.getElementById("settingsDialog") as HTMLDialogElement | null;
const settingsClose = document.getElementById("settingsClose") as HTMLButtonElement | null;

const DEFAULT_THEME_NAME = "Aizen Dark";
const DEFAULT_FONT_FAMILY = "jetbrains";
const FONT_FAMILY_LOCAL_PREFIX = "local:";
const FONT_URL_JETBRAINS_MONO =
  "https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Regular.ttf";
const FONT_URL_NERD_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf";
const FONT_URL_NOTO_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/unhinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf";
const FONT_URL_OPENMOJI =
  "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/font/OpenMoji-black-glyf/OpenMoji-black-glyf.ttf";
const LOG_LIMIT = 200;
const logBuffer: string[] = [];

function appendLog(line: string) {
  const timestamp = new Date().toISOString().slice(11, 23);
  const entry = `${timestamp} ${line}`;
  logBuffer.push(entry);
  if (logBuffer.length > LOG_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_LIMIT);
  }
  if (logEl) logEl.textContent = line;
  if (logDumpEl) {
    logDumpEl.value = logBuffer.join("\n");
    logDumpEl.scrollTop = logDumpEl.scrollHeight;
  }
}

function isSettingsDialogOpen() {
  return Boolean(settingsDialog?.open);
}

function restoreTerminalFocus() {
  const pane = getFocusedPane() ?? getActivePane() ?? getFirstPane();
  if (!pane) return;
  pane.canvas.focus({ preventScroll: true });
}

function openSettingsDialog() {
  paneManager?.hideContextMenu();
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

type RendererChoice = "auto" | "webgpu" | "webgl2";
type ConnectionBackend = "ws" | "webcontainer";

type PaneUiState = {
  backend: string;
  fps: string;
  dpr: string;
  size: string;
  grid: string;
  cell: string;
  termSize: string;
  cursor: string;
  inputDebug: string;
  debug: string;
  ptyStatus: string;
  mouseStatus: string;
};

type PaneThemeState = {
  selectValue: string;
  sourceLabel: string;
  theme: GhosttyTheme | null;
};

type Pane = {
  id: number;
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  imeInput: HTMLTextAreaElement;
  termDebugEl: HTMLPreElement;
  focusTarget: HTMLCanvasElement;
  app: ReturnType<typeof createResttyApp>;
  demos: ReturnType<typeof createDemoController>;
  paused: boolean;
  setPaused?: (value: boolean) => void;
  renderer: RendererChoice;
  fontSize: number;
  mouseMode: string;
  theme: PaneThemeState;
  ui: PaneUiState;
};

const sharedSession = createResttyAppSession();
const panes = new Map<number, Pane>();
let activePaneId: number | null = null;
let resizeRaf = 0;
let paneManager: ReturnType<typeof createResttyPaneManager<Pane>> | undefined;

const initialFontSize = fontSizeInput?.value ? Number(fontSizeInput.value) : 18;
let selectedFontFamily = fontFamilySelect?.value ?? DEFAULT_FONT_FAMILY;
let selectedLocalFontMatcher = "";

function supportsLocalFontPicker() {
  return typeof navigator !== "undefined" && "queryLocalFonts" in navigator;
}

function setFontFamilyHint(text: string) {
  if (fontFamilyHintEl) fontFamilyHintEl.textContent = text;
}

function buildFontSourcesForSelection(
  value: string,
  localMatcher: string,
): ResttyFontSource[] {
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
    type: "url",
    label: "Noto Sans Symbols 2",
    url: FONT_URL_NOTO_SYMBOLS,
  });
  sources.push({
    type: "url",
    label: "OpenMoji",
    url: FONT_URL_OPENMOJI,
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
  const sources = getCurrentFontSources();
  const updates: Array<Promise<void>> = [];
  const iterator = panes.values();
  for (let next = iterator.next(); !next.done; next = iterator.next()) {
    updates.push(next.value.app.setFontSources(sources));
  }
  if (!updates.length) return;
  try {
    await Promise.all(updates);
    appendLog(`[ui] font family applied (${selectedFontFamily})`);
  } catch (err: any) {
    appendLog(`[ui] font family apply failed: ${err?.message ?? err}`);
  }
}

function upsertDetectedLocalFontOption(family: string) {
  if (!fontFamilyLocalSelect) return;
  const matcher = family.trim().toLowerCase();
  if (!matcher) return;
  const value = `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(matcher)}`;
  for (let i = 0; i < fontFamilyLocalSelect.options.length; i += 1) {
    if (fontFamilyLocalSelect.options[i].value === value) return;
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
        if (fontFamilyLocalSelect.options[i].dataset.localDetected === "1") {
          fontFamilyLocalSelect.remove(i);
        }
      }
    }
    const fonts = await (navigator as any).queryLocalFonts();
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
  } catch (err: any) {
    setFontFamilyHint("Local font access denied or unavailable.");
    appendLog(`[ui] local font detect failed: ${err?.message ?? err}`);
  }
}

function isRendererChoice(value: string | null | undefined): value is RendererChoice {
  return value === "auto" || value === "webgpu" || value === "webgl2";
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

function connectPaneIfNeeded(pane: Pane) {
  if (getConnectionBackend() !== "webcontainer") return;
  if (pane.app.isPtyConnected()) return;
  pane.app.connectPty(getConnectUrl());
}

function createAdaptivePtyTransport(): PtyTransport {
  const wsTransport = createWebSocketPtyTransport();
  const webContainerTransport = createWebContainerPtyTransport({
    getCommand: () => wcCommandInput?.value?.trim() || "jsh",
    getCwd: () => wcCwdInput?.value?.trim() || "/",
    onLog: appendLog,
  });

  let activeTransport: PtyTransport | null = null;
  const pickTransport = () => (getConnectionBackend() === "webcontainer" ? webContainerTransport : wsTransport);

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

function parseFontSize(value: string | null | undefined, fallback = 18) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createDefaultPaneUi(): PaneUiState {
  return {
    backend: "-",
    fps: "0",
    dpr: "1",
    size: "0x0",
    grid: "0x0",
    cell: "0x0",
    termSize: "0x0",
    cursor: "0,0",
    inputDebug: "-",
    debug: "-",
    ptyStatus: "disconnected",
    mouseStatus: "-",
  };
}

function setText(el: HTMLElement | null, value: string) {
  if (el) el.textContent = value;
}

function getActivePane(): Pane | null {
  if (paneManager) {
    return paneManager.getActivePane();
  }
  if (activePaneId === null) return null;
  return panes.get(activePaneId) ?? null;
}

function getFirstPane(): Pane | null {
  for (const pane of panes.values()) return pane;
  return null;
}

function getFocusedPane(): Pane | null {
  if (paneManager) {
    return paneManager.getFocusedPane();
  }
  return getActivePane();
}

function syncPauseButton(pane: Pane) {
  if (btnPause) btnPause.textContent = pane.paused ? "Resume" : "Pause";
}

function syncPtyButton(pane: Pane) {
  if (!ptyBtn) return;
  if (pane.app.isPtyConnected()) {
    ptyBtn.textContent = "Disconnect";
    return;
  }
  ptyBtn.textContent = getConnectionBackend() === "webcontainer" ? "Start WebContainer" : "Connect PTY";
}

function renderActivePaneStatus(pane: Pane) {
  setText(backendEl, pane.ui.backend);
  setText(fpsEl, pane.ui.fps);
  setText(dprEl, pane.ui.dpr);
  setText(sizeEl, pane.ui.size);
  setText(gridEl, pane.ui.grid);
  setText(cellEl, pane.ui.cell);
  setText(termSizeEl, pane.ui.termSize);
  setText(cursorPosEl, pane.ui.cursor);
  setText(inputDebugEl, pane.ui.inputDebug);
  setText(dbgEl, pane.ui.debug);
  setText(ptyStatusEl, pane.ui.ptyStatus);
  setText(mouseStatusEl, pane.ui.mouseStatus);
  syncPtyButton(pane);
}

function renderActivePaneControls(pane: Pane) {
  syncPauseButton(pane);
  if (rendererSelect) rendererSelect.value = pane.renderer;
  if (fontSizeInput) fontSizeInput.value = `${pane.fontSize}`;
  syncFontFamilyControls();
  pane.mouseMode = pane.app.getMouseStatus().mode;
  if (mouseModeEl) {
    const hasOption = Array.from(mouseModeEl.options).some((option) => option.value === pane.mouseMode);
    mouseModeEl.value = hasOption ? pane.mouseMode : "auto";
  }
  if (themeSelect) themeSelect.value = pane.theme.selectValue;
}

function mutatePane(id: number, update: (pane: Pane) => void) {
  const pane = panes.get(id);
  if (!pane) return;
  update(pane);
  if (pane.id === activePaneId) {
    renderActivePaneStatus(pane);
  }
}

function setPanePaused(pane: Pane, value: boolean) {
  pane.paused = Boolean(value);
  pane.app.setPaused(pane.paused);
  if (pane.id === activePaneId) syncPauseButton(pane);
}

function queueResizeAllPanes() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    for (const pane of panes.values()) {
      pane.app.updateSize(true);
    }
  });
}

function applyThemeToPane(
  pane: Pane,
  theme: GhosttyTheme,
  sourceLabel: string,
  selectValue = "",
): boolean {
  try {
    pane.app.applyTheme(theme, sourceLabel);
    pane.theme = {
      selectValue,
      sourceLabel,
      theme,
    };
    if (pane.id === activePaneId && themeSelect) {
      themeSelect.value = selectValue;
    }
    return true;
  } catch (err: any) {
    appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
    return false;
  }
}

function applyBuiltinThemeToPane(pane: Pane, name: string, sourceLabel = name): boolean {
  const theme = getBuiltinTheme(name);
  if (!theme) {
    appendLog(`[ui] theme load failed: unknown theme: ${name}`);
    return false;
  }
  return applyThemeToPane(pane, theme, sourceLabel, name);
}

function resetThemeForPane(pane: Pane) {
  pane.app.resetTheme();
  pane.theme = {
    selectValue: "",
    sourceLabel: "",
    theme: null,
  };
  if (pane.id === activePaneId && themeSelect) {
    themeSelect.value = "";
  }
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
appendLog(`[ui] themes loaded (${builtinThemeNames.length})`);
const defaultThemeName = builtinThemeNames.includes(DEFAULT_THEME_NAME) ? DEFAULT_THEME_NAME : "";

function createPane(id: number, cloneFrom?: Pane | null): Pane {
  const container = document.createElement("div");
  container.className = "pane";
  container.dataset.paneId = `${id}`;

  const canvas = document.createElement("canvas");
  canvas.className = "pane-canvas";
  canvas.tabIndex = 0;

  const imeInput = document.createElement("textarea");
  imeInput.className = "pane-ime-input";
  imeInput.autocapitalize = "off";
  imeInput.autocomplete = "off";
  imeInput.autocorrect = "off";
  imeInput.spellcheck = false;
  imeInput.setAttribute("aria-hidden", "true");

  const termDebugEl = document.createElement("pre");
  termDebugEl.className = "pane-term-debug";
  termDebugEl.setAttribute("aria-live", "polite");

  container.append(canvas, imeInput, termDebugEl);

  const pane: Pane = {
    id,
    container,
    canvas,
    imeInput,
    termDebugEl,
    focusTarget: canvas,
    app: null as unknown as ReturnType<typeof createResttyApp>,
    demos: null as unknown as ReturnType<typeof createDemoController>,
    paused: false,
    renderer: cloneFrom?.renderer ?? (isRendererChoice(rendererSelect?.value) ? rendererSelect.value : "auto"),
    fontSize: cloneFrom?.fontSize ?? parseFontSize(fontSizeInput?.value, Number.isFinite(initialFontSize) ? initialFontSize : 18),
    mouseMode: cloneFrom?.mouseMode ?? (mouseModeEl?.value || "on"),
    theme: cloneFrom
      ? {
          selectValue: cloneFrom.theme.selectValue,
          sourceLabel: cloneFrom.theme.sourceLabel,
          theme: cloneFrom.theme.theme,
        }
      : {
          selectValue: defaultThemeName,
          sourceLabel: defaultThemeName ? "default theme" : "",
          theme: null,
        },
    ui: createDefaultPaneUi(),
  };

  panes.set(id, pane);

  const app = createResttyApp({
    canvas,
    imeInput,
    session: sharedSession,
    ptyTransport: createAdaptivePtyTransport(),
    elements: {
      termDebugEl,
      atlasInfoEl,
      atlasCanvas,
    },
    debugExpose: true,
    renderer: pane.renderer,
    fontSize: pane.fontSize,
    fontSources: getCurrentFontSources(),
    callbacks: {
      onLog: (line) => appendLog(`[pane ${id}] ${line}`),
      onBackend: (backend) => {
        mutatePane(id, (target) => {
          target.ui.backend = backend;
        });
      },
      onFps: (fps) => {
        mutatePane(id, (target) => {
          target.ui.fps = `${Math.round(fps)}`;
        });
      },
      onDpr: (dpr) => {
        mutatePane(id, (target) => {
          target.ui.dpr = Number.isFinite(dpr) ? dpr.toFixed(2) : "-";
        });
      },
      onCanvasSize: (width, height) => {
        mutatePane(id, (target) => {
          target.ui.size = `${width}x${height}`;
        });
      },
      onGridSize: (cols, rows) => {
        mutatePane(id, (target) => {
          target.ui.grid = `${cols}x${rows}`;
        });
      },
      onCellSize: (cellW, cellH) => {
        mutatePane(id, (target) => {
          target.ui.cell = `${cellW.toFixed(1)}x${cellH.toFixed(1)}`;
        });
      },
      onTermSize: (cols, rows) => {
        mutatePane(id, (target) => {
          target.ui.termSize = `${cols}x${rows}`;
        });
      },
      onCursor: (col, row) => {
        mutatePane(id, (target) => {
          target.ui.cursor = `${col},${row}`;
        });
      },
      onDebug: (text) => {
        mutatePane(id, (target) => {
          target.ui.debug = text;
        });
      },
      onInputDebug: (text) => {
        mutatePane(id, (target) => {
          target.ui.inputDebug = text;
        });
      },
      onPtyStatus: (status) => {
        mutatePane(id, (target) => {
          target.ui.ptyStatus = status;
        });
        const target = panes.get(id);
        if (target && target.id === activePaneId) {
          syncPtyButton(target);
        }
      },
      onMouseStatus: (status) => {
        mutatePane(id, (target) => {
          target.ui.mouseStatus = status;
        });
      },
    },
  });

  pane.app = app;
  pane.demos = createDemoController(app);
  pane.setPaused = (value: boolean) => {
    setPanePaused(pane, value);
  };
  pane.mouseMode = pane.app.getMouseStatus().mode;
  pane.ui.ptyStatus = pane.app.isPtyConnected() ? "connected" : "disconnected";

  if (pane.theme.selectValue) {
    applyBuiltinThemeToPane(pane, pane.theme.selectValue, pane.theme.sourceLabel || pane.theme.selectValue);
  } else if (pane.theme.theme) {
    applyThemeToPane(pane, pane.theme.theme, pane.theme.sourceLabel || "pane theme", pane.theme.selectValue);
  }

  pane.app.setMouseMode(pane.mouseMode);
  void pane.app.init().then(() => {
    connectPaneIfNeeded(pane);
  });

  return pane;
}

const manager = createResttyPaneManager<Pane>({
  root: paneRoot,
  createPane: ({ id, sourcePane }) => createPane(id, sourcePane),
  destroyPane: (pane) => {
    pane.demos.stop();
    pane.app.destroy();
    panes.delete(pane.id);
  },
  onActivePaneChange: (pane) => {
    activePaneId = pane?.id ?? null;
    if (!pane) return;
    renderActivePaneStatus(pane);
    renderActivePaneControls(pane);
  },
  onPaneSplit: (sourcePane, createdPane, direction) => {
    appendLog(`[ui] split ${direction} pane ${sourcePane.id} -> pane ${createdPane.id}`);
  },
  onPaneClosed: (pane) => {
    appendLog(`[ui] closed pane ${pane.id}`);
  },
  onLayoutChanged: () => {
    queueResizeAllPanes();
  },
  contextMenu: {
    canOpen: () => !isSettingsDialogOpen(),
    getItems: (pane, manager) =>
      createDefaultResttyPaneContextMenuItems({
        pane,
        manager,
        modKeyLabel: getResttyShortcutModifierLabel(),
        getPtyUrl: () => getConnectUrl(),
      }),
  },
  shortcuts: {
    enabled: true,
    canHandleEvent: () => !isSettingsDialogOpen(),
    isAllowedInputTarget: (target) => target.classList.contains("pane-ime-input"),
  },
});
paneManager = manager;

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

window.addEventListener("keydown", (event) => {
  if (isSettingsDialogOpen()) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettingsDialog();
    }
  }
}, { capture: true });

window.addEventListener("resize", () => {
  queueResizeAllPanes();
});

connectionBackendEl?.addEventListener("change", () => {
  syncConnectionUi();
  for (const pane of panes.values()) {
    if (pane.app.isPtyConnected()) {
      pane.app.disconnectPty();
    }
  }
  if (getConnectionBackend() === "webcontainer") {
    for (const pane of panes.values()) {
      connectPaneIfNeeded(pane);
    }
  }
  appendLog(`[ui] connection backend: ${getConnectionBackend()}`);
  const pane = getActivePane();
  if (pane) syncPtyButton(pane);
});

btnInit?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  setPanePaused(pane, false);
  pane.demos.stop();
  void pane.app.init().then(() => {
    connectPaneIfNeeded(pane);
  });
});

btnPause?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  setPanePaused(pane, !pane.paused);
});

btnClear?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  pane.demos.stop();
  pane.app.clearScreen();
});

btnRunDemo?.addEventListener("click", () => {
  const pane = getActivePane();
  if (!pane) return;
  pane.demos.run(demoSelect?.value ?? "basic");
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
  if (!pane) return;
  const value = rendererSelect.value;
  if (!isRendererChoice(value)) return;
  pane.renderer = value;
  pane.app.setRenderer(value);
});

if (themeFileInput) {
  themeFileInput.addEventListener("change", () => {
    const pane = getActivePane();
    const file = themeFileInput.files?.[0];
    if (!pane || !file) return;
    file
      .text()
      .then((text) => {
        const theme: GhosttyTheme = parseGhosttyTheme(text);
        if (applyThemeToPane(pane, theme, file.name || "theme file", "") && themeSelect) {
          themeSelect.value = "";
        }
      })
      .catch((err: any) => {
        console.error("theme load failed", err);
        appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
      })
      .finally(() => {
        themeFileInput.value = "";
      });
  });
}

if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    const pane = getActivePane();
    if (!pane) return;
    const name = themeSelect.value;
    if (!name) {
      resetThemeForPane(pane);
      return;
    }
    applyBuiltinThemeToPane(pane, name);
  });
}

if (mouseModeEl) {
  mouseModeEl.addEventListener("change", () => {
    const pane = getActivePane();
    if (!pane) return;
    const value = mouseModeEl.value;
    pane.app.setMouseMode(value);
    pane.mouseMode = pane.app.getMouseStatus().mode;
    if (pane.id === activePaneId) {
      mouseModeEl.value = pane.mouseMode;
    }
  });
}

if (fontSizeInput) {
  const applyFontSize = () => {
    const pane = getActivePane();
    if (!pane) return;
    const value = Number(fontSizeInput.value);
    if (!Number.isFinite(value)) return;
    pane.fontSize = value;
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

if (btnCopyLog) {
  btnCopyLog.addEventListener("click", async () => {
    const text = logDumpEl ? logDumpEl.value : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      appendLog("[ui] logs copied");
    } catch (err: any) {
      appendLog(`[ui] copy failed: ${err?.message ?? err}`);
    }
  });
}

if (btnClearLog) {
  btnClearLog.addEventListener("click", () => {
    logBuffer.length = 0;
    if (logDumpEl) logDumpEl.value = "";
    appendLog("[ui] logs cleared");
  });
}

if (atlasBtn) {
  atlasBtn.addEventListener("click", () => {
    const pane = getActivePane();
    if (!pane) return;
    const raw = atlasCpInput?.value ?? "";
    const cp = parseCodepointInput(raw);
    if (cp === null) {
      if (atlasInfoEl) atlasInfoEl.textContent = "invalid codepoint";
      return;
    }
    pane.app.dumpAtlasForCodepoint(cp);
  });
}

if (atlasCpInput) {
  atlasCpInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const pane = getActivePane();
    if (!pane) return;
    const raw = atlasCpInput.value;
    const cp = parseCodepointInput(raw);
    if (cp === null) {
      if (atlasInfoEl) atlasInfoEl.textContent = "invalid codepoint";
      return;
    }
    pane.app.dumpAtlasForCodepoint(cp);
  });
}

syncConnectionUi();
syncFontFamilyControls();
if (supportsLocalFontPicker()) {
  setFontFamilyHint("Select a base font, then pick a local font from the local picker.");
} else {
  setFontFamilyHint("Local font picker is not supported in this browser.");
}

const firstPane = manager.createInitialPane({ focus: true });
activePaneId = firstPane.id;
queueResizeAllPanes();

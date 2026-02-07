import {
  Font,
  UnicodeBuffer,
  shape,
  glyphBufferToShapedGlyphs,
  buildAtlas,
  atlasToRGBA,
  rasterizeGlyph,
  rasterizeGlyphWithTransform,
  PixelMode,
} from "./public/text-shaper.js";

import {
  createResttyApp,
  listBuiltinThemeNames,
  getBuiltinTheme,
  parseGhosttyTheme,
  type GhosttyTheme,
} from "../src/index.ts";
import { createDemoController } from "./lib/demos.ts";
import { parseCodepointInput } from "./lib/codepoint.ts";

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const imeInput = document.getElementById("imeInput") as HTMLTextAreaElement | null;

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
const termDebugEl = document.getElementById("termDebug");
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
const ptyUrlInput = document.getElementById("ptyUrl") as HTMLInputElement | null;
const ptyBtn = document.getElementById("btnPty");
const themeSelect = document.getElementById("themeSelect") as HTMLSelectElement | null;
const themeFileInput = document.getElementById("themeFile") as HTMLInputElement | null;
const fontSizeInput = document.getElementById("fontSize") as HTMLInputElement | null;
const atlasCpInput = document.getElementById("atlasCp") as HTMLInputElement | null;
const atlasBtn = document.getElementById("btnAtlas");
const btnCopyLog = document.getElementById("btnCopyLog");
const btnClearLog = document.getElementById("btnClearLog");
const mouseModeEl = document.getElementById("mouseMode") as HTMLSelectElement | null;

const DEFAULT_THEME_NAME = "Aizen Dark";
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

const initialFontSize = fontSizeInput?.value ? Number(fontSizeInput.value) : 18;

const app = createResttyApp({
  canvas,
  imeInput,
  textShaper: {
    Font,
    UnicodeBuffer,
    shape,
    glyphBufferToShapedGlyphs,
    buildAtlas,
    atlasToRGBA,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    PixelMode,
  },
  elements: {
    backendEl,
    fpsEl,
    dprEl,
    sizeEl,
    gridEl,
    cellEl,
    termSizeEl,
    cursorPosEl,
    inputDebugEl,
    dbgEl,
    ptyStatusEl,
    mouseStatusEl,
    termDebugEl,
    logEl,
    atlasInfoEl,
    atlasCanvas,
  },
  debugExpose: true,
  callbacks: {
    onLog: appendLog,
    onPtyStatus: (status) => {
      if (ptyBtn) {
        ptyBtn.textContent = status === "connected" ? "Disconnect PTY" : "Connect PTY";
      }
    },
  },
  fontSize: Number.isFinite(initialFontSize) ? initialFontSize : 18,
});
const demos = createDemoController(app);

let paused = false;

function setPaused(value: boolean) {
  paused = value;
  app.setPaused(value);
  if (btnPause) btnPause.textContent = paused ? "Resume" : "Pause";
}

function loadThemeByName(name: string, sourceLabel = name) {
  try {
    const theme = getBuiltinTheme(name);
    if (!theme) throw new Error(`unknown theme: ${name}`);
    app.applyTheme(theme, sourceLabel);
    return true;
  } catch (err: any) {
    appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
    return false;
  }
}

let defaultThemeApplied = false;

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

function loadBuiltinThemes() {
  const names = listBuiltinThemeNames();
  populateThemeSelect(names);
  appendLog(`[ui] themes loaded (${names.length})`);
  if (!defaultThemeApplied && names.includes(DEFAULT_THEME_NAME)) {
    defaultThemeApplied = true;
    if (themeSelect) themeSelect.value = DEFAULT_THEME_NAME;
    loadThemeByName(DEFAULT_THEME_NAME, "default theme");
  }
}

btnInit?.addEventListener("click", () => {
  setPaused(false);
  demos.stop();
  app.init();
});

btnPause?.addEventListener("click", () => {
  setPaused(!paused);
});

btnClear?.addEventListener("click", () => {
  demos.stop();
  app.clearScreen();
});

btnRunDemo?.addEventListener("click", () => {
  demos.run(demoSelect?.value ?? "basic");
});

ptyBtn?.addEventListener("click", () => {
  if (app.isPtyConnected()) {
    app.disconnectPty();
  } else {
    const url = ptyUrlInput?.value?.trim() ?? "";
    if (url) app.connectPty(url);
  }
});

rendererSelect?.addEventListener("change", () => {
  const value = rendererSelect.value;
  if (value === "auto" || value === "webgpu" || value === "webgl2") {
    app.setRenderer(value);
  }
});

if (themeFileInput) {
  themeFileInput.addEventListener("change", () => {
    const file = themeFileInput?.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        const theme: GhosttyTheme = parseGhosttyTheme(text);
        app.applyTheme(theme, file.name || "theme file");
        if (themeSelect) themeSelect.value = "";
      })
      .catch((err: any) => {
        console.error("theme load failed", err);
        appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
      });
  });
}

if (themeSelect) {
  themeSelect.addEventListener("change", () => {
    const name = themeSelect.value;
    if (!name) {
      app.resetTheme();
      return;
    }
    loadThemeByName(name);
  });
}

if (mouseModeEl) {
  mouseModeEl.addEventListener("change", () => {
    const value = mouseModeEl.value;
    app.setMouseMode(value);
  });
}

if (fontSizeInput) {
  fontSizeInput.addEventListener("change", () => {
    const value = Number(fontSizeInput.value);
    app.setFontSize(value);
  });
  fontSizeInput.addEventListener("input", () => {
    const value = Number(fontSizeInput.value);
    if (Number.isFinite(value)) app.setFontSize(value);
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
    const raw = atlasCpInput?.value ?? "";
    const cp = parseCodepointInput(raw);
    if (cp === null) {
      if (atlasInfoEl) atlasInfoEl.textContent = "invalid codepoint";
      return;
    }
    app.dumpAtlasForCodepoint(cp);
  });
}

if (atlasCpInput) {
  atlasCpInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const raw = atlasCpInput.value;
    const cp = parseCodepointInput(raw);
    if (cp === null) {
      if (atlasInfoEl) atlasInfoEl.textContent = "invalid codepoint";
      return;
    }
    app.dumpAtlasForCodepoint(cp);
  });
}

loadBuiltinThemes();
app.init();
if (mouseModeEl) mouseModeEl.value = app.getMouseStatus().mode;
if (fontSizeInput) fontSizeInput.value = `${Number.isFinite(initialFontSize) ? initialFontSize : 18}`;

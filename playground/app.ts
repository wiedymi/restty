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
  parseGhosttyTheme,
  type GhosttyTheme,
} from "../src/index.ts";

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

function assetUrl(path: string) {
  let normalized = path;
  if (normalized.startsWith("./public/")) {
    normalized = `/playground/public/${normalized.slice("./public/".length)}`;
  } else if (!normalized.startsWith("/playground/public/") && !normalized.startsWith("/")) {
    normalized = `/playground/public/${normalized}`;
  }
  return new URL(normalized, window.location.origin).toString();
}

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

let paused = false;
let demoTimer = 0;

function stopDemo() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = 0;
  }
}

function setPaused(value: boolean) {
  paused = value;
  app.setPaused(value);
  if (btnPause) btnPause.textContent = paused ? "Resume" : "Pause";
}

function joinLines(lines: string[]) {
  return lines.join("\r\n");
}

function demoBasic() {
  const lines = [
    "restty demo: basics",
    "",
    "Styles: " +
      "\x1b[1mBold\x1b[0m " +
      "\x1b[3mItalic\x1b[0m " +
      "\x1b[4mUnderline\x1b[0m " +
      "\x1b[7mReverse\x1b[0m " +
      "\x1b[9mStrike\x1b[0m",
    "",
    "RGB: " +
      "\x1b[38;2;255;100;0mOrange\x1b[0m " +
      "\x1b[38;2;120;200;255mSky\x1b[0m " +
      "\x1b[38;2;160;255;160mMint\x1b[0m",
    "BG:  " +
      "\x1b[48;2;60;60;60m  \x1b[0m " +
      "\x1b[48;2;120;40;40m  \x1b[0m " +
      "\x1b[48;2;40;120;40m  \x1b[0m " +
      "\x1b[48;2;40;40;120m  \x1b[0m",
    "",
    "Box: ┌────────────────────┐",
    "     │  mono renderer     │",
    "     └────────────────────┘",
    "",
  ];
  return `\x1b[2J\x1b[H${joinLines(lines)}`;
}

function demoPalette() {
  const lines = ["restty demo: palette", ""];
  const blocks: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    blocks.push(`\x1b[48;5;${i}m  \x1b[0m`);
  }
  lines.push(`Base 16: ${blocks.join(" ")}`);

  lines.push("");
  for (let row = 0; row < 6; row += 1) {
    const rowBlocks: string[] = [];
    for (let col = 0; col < 12; col += 1) {
      const idx = 16 + row * 12 + col;
      rowBlocks.push(`\x1b[48;5;${idx}m  \x1b[0m`);
    }
    lines.push(rowBlocks.join(""));
  }

  lines.push("");
  const gray: string[] = [];
  for (let i = 232; i <= 255; i += 1) {
    gray.push(`\x1b[48;5;${i}m \x1b[0m`);
  }
  lines.push(`Grayscale: ${gray.join("")}`);
  lines.push("");
  return `\x1b[2J\x1b[H${joinLines(lines)}`;
}

function demoUnicode() {
  const lines = [
    "restty demo: unicode",
    "",
    "Arrows: ← ↑ → ↓  ↖ ↗ ↘ ↙",
    "Math:   ∑ √ ∞ ≈ ≠ ≤ ≥",
    "Blocks: ░ ▒ ▓ █ ▌ ▐ ▀ ▄",
    "Lines:  ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼",
    "Braille: ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏",
    "",
  ];
  return `\x1b[2J\x1b[H${joinLines(lines)}`;
}

function startAnimationDemo() {
  stopDemo();
  app.clearScreen();
  const start = performance.now();
  let tick = 0;
  demoTimer = window.setInterval(() => {
    const now = performance.now();
    const elapsed = (now - start) / 1000;
    const spinner = ["|", "/", "-", "\\"][tick % 4];
    const cols = 80;
    const barWidth = Math.max(10, Math.min(60, cols - 20));
    const phase = (Math.sin(elapsed * 1.6) + 1) * 0.5;
    const fill = Math.floor(barWidth * phase);
    const bar = "█".repeat(fill) + " ".repeat(Math.max(0, barWidth - fill));

    const lines = [
      `restty demo: animation ${spinner}`,
      "",
      `time ${elapsed.toFixed(2)}s`,
      `progress [${bar}]`,
      "",
      "palette:",
      `  \x1b[38;5;45mcyan\x1b[0m \x1b[38;5;202morange\x1b[0m \x1b[38;5;118mgreen\x1b[0m \x1b[38;5;213mpink\x1b[0m`,
      "",
      "type to echo input below...",
      "",
    ];
    app.sendInput(`\x1b[H\x1b[J${joinLines(lines)}`);
    tick += 1;
  }, 80);
}

function runDemo(kind: string) {
  stopDemo();
  switch (kind) {
    case "palette":
      app.sendInput(demoPalette());
      break;
    case "unicode":
      app.sendInput(demoUnicode());
      break;
    case "anim":
      startAnimationDemo();
      break;
    case "basic":
    default:
      app.sendInput(demoBasic());
      break;
  }
}

async function loadThemeByName(name: string, sourceLabel = name) {
  try {
    const url = assetUrl(`./public/themes/${encodeURIComponent(name)}`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`theme ${resp.status}`);
    const text = await resp.text();
    const theme = parseGhosttyTheme(text);
    app.applyTheme(theme, sourceLabel);
    return true;
  } catch (err: any) {
    appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
    return false;
  }
}

let themeManifestLoaded = false;
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

async function loadThemeManifest() {
  if (themeManifestLoaded) return;
  themeManifestLoaded = true;
  try {
    const url = assetUrl("./public/themes/manifest.json");
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`theme manifest ${resp.status}`);
    const data = await resp.json();
    if (data && Array.isArray(data.themes)) {
      populateThemeSelect(data.themes);
      appendLog(`[ui] themes loaded (${data.themes.length})`);
      if (!defaultThemeApplied && data.themes.includes(DEFAULT_THEME_NAME)) {
        defaultThemeApplied = true;
        if (themeSelect) themeSelect.value = DEFAULT_THEME_NAME;
        await loadThemeByName(DEFAULT_THEME_NAME, "default theme");
      }
    }
  } catch (err: any) {
    appendLog(`[ui] theme manifest failed: ${err?.message ?? err}`);
  }
}

function parseCodepointInput(value: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.startsWith("U+")) {
    const hex = upper.slice(2);
    const cp = Number.parseInt(hex, 16);
    return Number.isFinite(cp) ? cp : null;
  }
  if (upper.startsWith("0X")) {
    const cp = Number.parseInt(upper.slice(2), 16);
    return Number.isFinite(cp) ? cp : null;
  }
  if (/^[0-9A-F]+$/i.test(trimmed) && trimmed.length >= 4) {
    const cp = Number.parseInt(trimmed, 16);
    return Number.isFinite(cp) ? cp : null;
  }
  const codepoint = trimmed.codePointAt(0);
  return codepoint ?? null;
}

btnInit?.addEventListener("click", () => {
  setPaused(false);
  stopDemo();
  app.init();
});

btnPause?.addEventListener("click", () => {
  setPaused(!paused);
});

btnClear?.addEventListener("click", () => {
  stopDemo();
  app.clearScreen();
});

btnRunDemo?.addEventListener("click", () => {
  runDemo(demoSelect?.value ?? "basic");
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
  themeSelect.addEventListener("change", async () => {
    const name = themeSelect.value;
    if (!name) {
      app.resetTheme();
      return;
    }
    await loadThemeByName(name);
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

loadThemeManifest();
app.init();
if (mouseModeEl) mouseModeEl.value = app.getMouseStatus().mode;
if (fontSizeInput) fontSizeInput.value = `${Number.isFinite(initialFontSize) ? initialFontSize : 18}`;

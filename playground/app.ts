import {
  Font,
  UnicodeBuffer,
  shape,
  glyphBufferToShapedGlyphs,
  buildAtlas,
  atlasToRGBA,
  PixelMode,
} from "./public/text-shaper.js";

// Import from wterm library
import {
  // Input
  createInputHandler,
  // Fonts
  isNerdSymbolCodepoint,
  getNerdConstraint,
  isSymbolFont,
  isNerdSymbolFont,
  fontMaxCellSpan,
  fontScaleOverride,
  fontRasterScale,
  fontAdvanceUnits,
  glyphWidthUnits,
  createFontEntry,
  resetFontEntry,
  // WASM
  loadWtermWasm,
  // Theme
  colorToFloats,
  colorToRgbU32,
  parseGhosttyTheme,
  // Renderer
  BOX_LINE_MAP,
  BOX_STYLE_NONE,
  BOX_STYLE_LIGHT,
  BOX_STYLE_HEAVY,
  BOX_STYLE_DOUBLE,
  initWebGPU,
  initWebGL,
  ensureInstanceBuffer,
  ensureGLInstanceBuffer,
  configureContext,
  drawBlockElement,
  drawBoxDrawing,
  drawBraille,
  drawPowerline,
  constrainGlyphBox,
  pushRect,
  pushRectSnapped,
  pushRectBox,
  isBlockElement,
  isBoxDrawing,
  isBraille,
  isPowerline,
  isSymbolCp,
  isSpaceCp,
  isGraphicsElement,
  isPrivateUse,
  applyAlpha,
  RECT_SHADER,
  GLYPH_SHADER,
  // Grid
  fontHeightUnits,
  clamp,
  // Selection
  selectionForRow as selectionForRowLib,
  normalizeSelectionCell as normalizeSelectionCellLib,
  // IME
  PREEDIT_BG,
  PREEDIT_ACTIVE_BG,
  PREEDIT_FG,
  PREEDIT_UL,
  PREEDIT_CARET,
  type Color,
  type WebGPUState,
  type WebGLState,
  type WebGLAtlasState,
  type NerdMetrics,
  type NerdConstraint,
  type InputHandler,
  type RenderState,
  type GhosttyTheme,
  type WtermWasmExports,
  type FontEntry,
  type FontManagerState,
  WtermWasm,
} from "../src/index.ts";

let canvas = document.getElementById("screen") as HTMLCanvasElement;
let currentContextType: "webgpu" | "webgl2" | null = null;
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
const mouseModeEl = document.getElementById("mouseMode");
const mouseStatusEl = document.getElementById("mouseStatus");
const logEl = document.getElementById("log");
const logDumpEl = document.getElementById("logDump");
const btnCopyLog = document.getElementById("btnCopyLog");
const btnClearLog = document.getElementById("btnClearLog");
const termDebug = document.getElementById("termDebug");

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
const atlasInfoEl = document.getElementById("atlasInfo");
const atlasCanvas = document.getElementById("atlasCanvas") as HTMLCanvasElement | null;

const DEFAULT_THEME_NAME = "Aizen Dark";

const DEFAULT_BG_BASE: Color = [0.08, 0.09, 0.1, 1.0];
const DEFAULT_FG_BASE: Color = [0.92, 0.93, 0.95, 1.0];
const SELECTION_BASE: Color = [0.35, 0.55, 0.9, 0.45];
const CURSOR_BASE: Color = [0.95, 0.95, 0.95, 1.0];
let defaultBg: Color = [...DEFAULT_BG_BASE];
let defaultFg: Color = [...DEFAULT_FG_BASE];
let selectionColor: Color = [...SELECTION_BASE];
let cursorFallback: Color = [...CURSOR_BASE];
const CURSOR_BLINK_MS = 600;
const FORCE_CURSOR_BLINK = false;

let paused = false;
let backend = "none";
let preferredRenderer: "auto" | "webgpu" | "webgl2" = "auto";
let rafId = 0;
let frameCount = 0;
let lastFpsTime = performance.now();
let currentDpr = window.devicePixelRatio || 1;
let wasm: WtermWasm | null = null;
let wasmExports: WtermWasmExports | null = null;
let wasmHandle = 0;
let wasmReady = false;
let lastWasmUpdate = 0;
let activeState: WebGPUState | WebGLState | null = null;
let demoTimer = 0;
let sizeRaf = 0;
const RESIZE_OVERLAY_HOLD_MS = 500;
const RESIZE_OVERLAY_FADE_MS = 400;
const resizeState = {
  active: false,
  lastAt: 0,
  cols: 0,
  rows: 0,
  dpr: 1,
};
let needsRender = true;
let lastRenderTime = 0;
let nextBlinkTime = performance.now() + CURSOR_BLINK_MS;
let ptySocket: WebSocket | null = null;
let ptyConnected = false;
let lastCursorForCpr = { row: 1, col: 1 };
let inputHandler: InputHandler | null = null;
let activeTheme: GhosttyTheme | null = null;
const logBuffer: string[] = [];
const LOG_LIMIT = 200;
const WASM_LOG_FILTERS = [
  {
    re: /warning\\(stream\\): ignoring CSI .* t/i,
    note: "[wasm] note: CSI t window ops not implemented (safe to ignore)",
  },
  {
    re: /warning\\(stream\\): unknown CSI m with intermediate/i,
    note: "[wasm] note: CSI m intermediates ignored (safe to ignore)",
  },
];
const wasmLogNotes = new Set();
const ATLAS_PADDING = 4;
const MAX_SYMBOL_ATLAS_SCALE = 1;
const SYMBOL_ATLAS_PADDING = 10;
const SYMBOL_ATLAS_MAX_SIZE = 4096;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

canvas.tabIndex = 0;
canvas.addEventListener("pointerdown", () => {
  canvas.focus();
  imeInput?.focus();
});
canvas.addEventListener("focus", () => {
  imeInput?.focus();
});

const imeInput = document.getElementById("imeInput") as HTMLTextAreaElement | null;
const imeState = {
  composing: false,
  preedit: "",
  selectionStart: 0,
  selectionEnd: 0,
};

const selectionState: {
  active: boolean;
  dragging: boolean;
  anchor: { row: number; col: number } | null;
  focus: { row: number; col: number } | null;
} = {
  active: false,
  dragging: false,
  anchor: null,
  focus: null,
};

let scrollRemainder = 0;
const scrollbarState = {
  lastInputAt: 0,
  lastTotal: 0,
  lastOffset: 0,
  lastLen: 0,
};

function updateCanvasCursor() {
  if (!canvas) return;
  canvas.style.cursor = selectionState.dragging || selectionState.active ? "text" : "default";
}

function noteScrollActivity() {
  scrollbarState.lastInputAt = performance.now();
}

let lastRenderState: RenderState | null = null;

function positionToCell(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * currentDpr;
  const y = (event.clientY - rect.top) * currentDpr;
  const col = clamp(Math.floor(x / (gridState.cellW || 1)), 0, (gridState.cols || 1) - 1);
  const row = clamp(Math.floor(y / (gridState.cellH || 1)), 0, (gridState.rows || 1) - 1);
  return { row, col };
}

function normalizeSelectionCell(cell) {
  if (!cell) return cell;
  const rows = lastRenderState?.rows ?? gridState.rows ?? 0;
  const cols = lastRenderState?.cols ?? gridState.cols ?? 0;
  if (!rows || !cols) return cell;
  const row = clamp(cell.row, 0, rows - 1);
  const col = clamp(cell.col, 0, cols - 1);
  const wide = lastRenderState?.wide;
  if (!wide) return { row, col };
  const idx = row * cols + col;
  const flag = wide[idx] ?? 0;
  if (flag === 2) {
    const left = col > 0 ? col - 1 : col;
    return { row, col: left };
  }
  if (flag === 3 && row > 0) {
    const prevRow = row - 1;
    for (let c = cols - 1; c >= 0; c -= 1) {
      const f = wide[prevRow * cols + c] ?? 0;
      if (f !== 2 && f !== 3) return { row: prevRow, col: c };
    }
  }
  return { row, col };
}

function floatsToRgb(color: number[]): [number, number, number] {
  return [
    Math.round((color[0] ?? 0) * 255),
    Math.round((color[1] ?? 0) * 255),
    Math.round((color[2] ?? 0) * 255),
  ];
}

inputHandler = createInputHandler({
  getCursorPosition: () => lastCursorForCpr,
  sendReply: (data) => {
    if (ptySocket && ptySocket.readyState === WebSocket.OPEN) {
      ptySocket.send(JSON.stringify({ type: "input", data }));
    }
  },
  positionToCell,
  getDefaultColors: () => ({
    fg: floatsToRgb(defaultFg),
    bg: floatsToRgb(defaultBg),
    cursor: floatsToRgb(cursorFallback),
  }),
});
inputHandler!.setMouseMode("auto");

function clearSelection() {
  selectionState.active = false;
  selectionState.dragging = false;
  selectionState.anchor = null;
  selectionState.focus = null;
  updateCanvasCursor();
  needsRender = true;
}

function setPreedit(text, updateInput = false) {
  imeState.preedit = text || "";
  if (imeInput && updateInput) {
    imeInput.value = imeState.preedit;
  }
  needsRender = true;
}

function updateImePosition(cursor, cellW, cellH) {
  if (!imeInput || !cursor) return;
  const rect = canvas.getBoundingClientRect();
  const scale = currentDpr || 1;
  const x = rect.left + cursor.col * (cellW / scale);
  const y = rect.top + cursor.row * (cellH / scale);
  imeInput.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

function syncImeSelection() {
  if (!imeInput) return;
  const start = imeInput.selectionStart ?? 0;
  const end = imeInput.selectionEnd ?? start;
  imeState.selectionStart = Math.max(0, Math.min(start, imeInput.value.length));
  imeState.selectionEnd = Math.max(imeState.selectionStart, Math.min(end, imeInput.value.length));
}

function setPtyStatus(text) {
  if (ptyStatusEl) ptyStatusEl.textContent = text;
}

function setMouseStatus(text) {
  if (mouseStatusEl) mouseStatusEl.textContent = text;
}

function updateMouseStatus() {
  if (!inputHandler) return;
  const status = inputHandler.getMouseStatus();
  const label = status.active ? `${status.mode} (${status.detail})` : status.mode;
  setMouseStatus(label);
}

function disconnectPty() {
  if (ptySocket) {
    try {
      ptySocket.close();
    } catch {}
  }
  ptySocket = null;
  ptyConnected = false;
  updateMouseStatus();
  setPtyStatus("disconnected");
  if (ptyBtn) ptyBtn.textContent = "Connect PTY";
}

function connectPty() {
  if (ptyConnected) return;
  const url = ptyUrlInput?.value?.trim();
  if (!url) return;
  setPtyStatus("connecting...");
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";

  ws.addEventListener("open", () => {
    ptyConnected = true;
    ptySocket = ws;
    setPtyStatus("connected");
    if (ptyBtn) ptyBtn.textContent = "Disconnect PTY";
    updateMouseStatus();
    if (gridState.cols && gridState.rows) {
      ws.send(JSON.stringify({ type: "resize", cols: gridState.cols, rows: gridState.rows }));
    }
    appendLog("[pty] connected");
  });

  ws.addEventListener("close", () => {
    appendLog("[pty] disconnected");
    disconnectPty();
  });

  ws.addEventListener("error", () => {
    appendLog("[pty] error");
    disconnectPty();
  });

  ws.addEventListener("message", (event) => {
    const handleString = (payload) => {
      try {
        const msg = JSON.parse(payload);
        if (msg && msg.type === "status") {
          appendLog(`[pty] shell ${msg.shell ?? ""}`);
          return true;
        }
        if (msg && msg.type === "error") {
          appendLog(`[pty] error ${msg.message ?? ""}`);
          if (msg.errors) {
            for (const err of msg.errors) appendLog(`[pty] spawn ${err}`);
          }
          disconnectPty();
          return true;
        }
        if (msg && msg.type === "exit") {
          appendLog(`[pty] exit ${msg.code ?? ""}`);
          disconnectPty();
          return true;
        }
      } catch {
        // Not JSON
      }
      return false;
    };

    const payload = event.data;
    if (payload instanceof ArrayBuffer) {
      const text = textDecoder.decode(payload);
      const sanitized = inputHandler.filterOutput(text);
      updateMouseStatus();
      if (sanitized) sendInput(sanitized, "pty");
      return;
    }
    if (payload instanceof Blob) {
      payload.arrayBuffer().then((buf) => {
        const text = textDecoder.decode(buf);
        const sanitized = inputHandler.filterOutput(text);
        updateMouseStatus();
        if (sanitized) sendInput(sanitized, "pty");
      });
      return;
    }
    if (typeof payload === "string") {
      if (handleString(payload)) return;
      const sanitized = inputHandler.filterOutput(payload);
      updateMouseStatus();
      if (sanitized) sendInput(sanitized, "pty");
    }
  });
}

function handleThemeFile(file) {
  if (!file) return;
  file
    .text()
    .then((text) => {
      const theme = parseGhosttyTheme(text);
      applyTheme(theme, file.name || "theme file");
      if (themeSelect) themeSelect.value = "";
    })
    .catch((err) => {
      console.error("theme load failed", err);
      appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
    });
}

function sendKeyInput(text, source = "key") {
  if (!text) return;
  if (ptySocket && ptySocket.readyState === WebSocket.OPEN) {
    const payload = inputHandler.mapKeyForPty(text);
    ptySocket.send(JSON.stringify({ type: "input", data: payload }));
    return;
  }
  sendInput(text, source);
}

function getCprPosition() {
  return lastCursorForCpr;
}

inputHandler.setCursorProvider(getCprPosition);

canvas.addEventListener("pointerdown", (event) => {
  if (inputHandler.sendMouseEvent("down", event)) {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    return;
  }
  if (event.button !== 0) return;
  event.preventDefault();
  const cell = normalizeSelectionCell(positionToCell(event));
  selectionState.active = true;
  selectionState.dragging = true;
  selectionState.anchor = cell;
  selectionState.focus = cell;
  canvas.setPointerCapture?.(event.pointerId);
  updateCanvasCursor();
  needsRender = true;
});

canvas.addEventListener("pointermove", (event) => {
  if (inputHandler.sendMouseEvent("move", event)) {
    event.preventDefault();
    return;
  }
  if (!selectionState.dragging) return;
  event.preventDefault();
  selectionState.focus = normalizeSelectionCell(positionToCell(event));
  updateCanvasCursor();
  needsRender = true;
});

canvas.addEventListener("pointerup", (event) => {
  if (inputHandler.sendMouseEvent("up", event)) {
    event.preventDefault();
    return;
  }
  if (!selectionState.dragging) return;
  event.preventDefault();
  selectionState.dragging = false;
  selectionState.focus = normalizeSelectionCell(positionToCell(event));
  if (
    selectionState.anchor &&
    selectionState.focus &&
    selectionState.anchor.row === selectionState.focus.row &&
    selectionState.anchor.col === selectionState.focus.col
  ) {
    clearSelection();
  } else {
    updateCanvasCursor();
    needsRender = true;
  }
});

canvas.addEventListener("wheel", (event) => {
  const mouseActive = inputHandler.isMouseActive();
  const altScreen = inputHandler.isAltScreen ? inputHandler.isAltScreen() : false;
  if (mouseActive && altScreen && !event.shiftKey) {
    if (inputHandler.sendMouseEvent("wheel", event)) {
      event.preventDefault();
      return;
    }
  }
  if (!wasmReady || !wasmHandle || !gridState.cellH) return;
  const speed = event.shiftKey ? 0.5 : 1.5;
  let lines = 0;
  if (event.deltaMode === 1) {
    lines = event.deltaY;
  } else if (event.deltaMode === 2) {
    lines = event.deltaY * gridState.rows;
  } else {
    lines = event.deltaY / gridState.cellH;
  }
  lines *= speed;
  scrollRemainder += lines;
  const delta = Math.trunc(scrollRemainder);
  scrollRemainder -= delta;
  if (!delta) return;
  wasm.scrollViewport(wasmHandle, delta);
  wasm.renderUpdate(wasmHandle);
  needsRender = true;
  noteScrollActivity();
  event.preventDefault();
});

canvas.addEventListener("contextmenu", (event) => {
  if (inputHandler.isMouseActive()) event.preventDefault();
});

if (imeInput) {
  imeInput.addEventListener("compositionstart", (event) => {
    imeState.composing = true;
    setPreedit(event.data || imeInput.value || "");
    requestAnimationFrame(syncImeSelection);
  });

  imeInput.addEventListener("compositionupdate", (event) => {
    setPreedit(event.data || imeInput.value || "");
    requestAnimationFrame(syncImeSelection);
  });

  imeInput.addEventListener("compositionend", (event) => {
    imeState.composing = false;
    setPreedit("", true);
    imeState.selectionStart = 0;
    imeState.selectionEnd = 0;
    const text = event.data || "";
    if (text) sendKeyInput(text);
    imeInput.value = "";
  });

  imeInput.addEventListener("beforeinput", (event) => {
    if (!wasmReady || !wasmHandle) return;
    if (imeState.composing) return;

    const text = inputHandler.encodeBeforeInput(event);

    if (text) {
      event.preventDefault();
      sendKeyInput(text);
      imeInput.value = "";
    }
  });

  imeInput.addEventListener("input", (event) => {
    if (!wasmReady || !wasmHandle) return;
    if (imeState.composing) return;
    const text = event.data || imeInput.value;
    if (text) {
      sendKeyInput(text);
      imeInput.value = "";
    }
  });

  imeInput.addEventListener("paste", (event) => {
    if (!wasmReady || !wasmHandle) return;
    const text = event.clipboardData?.getData("text/plain") || "";
    if (text) {
      event.preventDefault();
      sendKeyInput(text);
      imeInput.value = "";
    }
  });
}

const fontState: FontManagerState = {
  font: null,
  fonts: [],
  fontSizePx: 0,
  sizeMode: "height",
  fontPickCache: new Map(),
};

const fontConfig = {
  sizePx: 18,
};

const FONT_SCALE_OVERRIDES = [];

const SYMBOL_FONT_HINTS = [/symbols nerd font/i, /noto sans symbols/i];
const NERD_SYMBOL_FONT_HINTS = [/symbols nerd font/i, /nerd fonts symbols/i];

const WIDE_FONT_HINTS = [
  /cjk/i,
  /source han/i,
  /pingfang/i,
  /hiragino/i,
  /yu gothic/i,
  /meiryo/i,
  /yahei/i,
  /ms gothic/i,
  /simhei/i,
  /simsun/i,
  /nanum/i,
  /apple sd gothic/i,
];

function applyFontSize(value) {
  if (!Number.isFinite(value)) return;
  const clamped = Math.max(10, Math.min(64, Math.round(value)));
  if (fontConfig.sizePx === clamped) return;
  fontConfig.sizePx = clamped;
  for (const entry of fontState.fonts) resetFontEntry(entry);
  if (activeState && activeState.glyphAtlases) {
    activeState.glyphAtlases = new Map();
  }
  updateGrid();
  wasm?.renderUpdate?.(wasmHandle);
  needsRender = true;
  appendLog(`[ui] font size ${clamped}px`);
}

function parseCodepointInput(value) {
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

function formatCodepoint(cp) {
  const hex = cp.toString(16).toUpperCase();
  return `U+${hex.padStart(4, "0")}`;
}

function atlasRegionToImageData(atlas, x, y, width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const srcRow = (y + row) * atlas.bitmap.pitch + x;
    const dstRow = row * width * 4;
    for (let col = 0; col < width; col += 1) {
      const alpha = atlas.bitmap.buffer[srcRow + col] ?? 0;
      const dstIdx = dstRow + col * 4;
      rgba[dstIdx] = 255;
      rgba[dstIdx + 1] = 255;
      rgba[dstIdx + 2] = 255;
      rgba[dstIdx + 3] = alpha;
    }
  }
  return new ImageData(rgba, width, height);
}

function dumpAtlasForCodepoint(cp) {
  if (!atlasCanvas || !atlasInfoEl) return;
  if (!activeState || !activeState.device) {
    atlasInfoEl.textContent = "atlas debug unavailable (renderer not ready)";
    return;
  }
  const entryText = String.fromCodePoint(cp);
  const fontIndex = pickFontIndexForText(entryText, 1);
  const entry = fontState.fonts[fontIndex];
  if (!entry?.font) {
    atlasInfoEl.textContent = "font not ready";
    return;
  }
  const glyphId = entry.font.glyphIdForChar(entryText);
  if (!glyphId) {
    atlasInfoEl.textContent = `missing glyph for ${formatCodepoint(cp)}`;
    return;
  }
  const needed = new Set([glyphId]);
  const atlasScale = entry.atlasScale ?? 1;
  ensureAtlasForFont(
    activeState.device,
    activeState,
    entry,
    needed,
    gridState.fontSizePx || fontConfig.sizePx,
    fontIndex,
    atlasScale,
  );
  const atlas = entry.atlas;
  if (!atlas) {
    atlasInfoEl.textContent = "atlas missing";
    return;
  }
  const metrics = atlas.glyphs.get(glyphId);
  if (!metrics) {
    atlasInfoEl.textContent = `glyph not in atlas (${formatCodepoint(cp)})`;
    return;
  }
  const width = Math.max(1, metrics.width);
  const height = Math.max(1, metrics.height);
  atlasCanvas.width = width;
  atlasCanvas.height = height;
  const ctx = atlasCanvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const imageData = atlasRegionToImageData(atlas, metrics.atlasX, metrics.atlasY, width, height);
  ctx.putImageData(imageData, 0, 0);
  atlasInfoEl.textContent = [
    `cp ${formatCodepoint(cp)} glyph ${glyphId}`,
    `font ${fontIndex}: ${entry.label ?? "unknown"}`,
    `atlas ${atlas.bitmap.width}x${atlas.bitmap.rows} pad ${isSymbolFont(entry) ? SYMBOL_ATLAS_PADDING : ATLAS_PADDING}`,
    `glyph ${metrics.width}x${metrics.height} bearing ${metrics.bearingX},${metrics.bearingY}`,
  ].join("\n");
}

// Debug helper: diagnose why a codepoint might not be rendering
function diagnoseCodepoint(cp: number): void {
  console.group(`Diagnosing codepoint ${formatCodepoint(cp)}`);

  // Check if it's a nerd symbol
  const isNerd = isNerdSymbolCodepoint(cp);
  const isSymbol = isSymbolCp(cp);
  console.log(`isNerdSymbolCodepoint: ${isNerd}, isSymbolCp: ${isSymbol}`);

  // Check fonts
  console.log(`Total fonts loaded: ${fontState.fonts.length}`);
  fontState.fonts.forEach((entry, idx) => {
    if (!entry?.font) {
      console.log(`  Font ${idx}: not loaded`);
      return;
    }
    const label = entry.label || "unknown";
    const isSym = isSymbolFont(entry);
    const text = String.fromCodePoint(cp);
    const hasGlyph = fontHasGlyph(entry.font, text);
    const glyphId = entry.font.glyphIdForChar(text);
    console.log(`  Font ${idx}: "${label}" isSymbolFont=${isSym} hasGlyph=${hasGlyph} glyphId=${glyphId}`);
  });

  // Check which font would be picked
  const text = String.fromCodePoint(cp);
  const pickedIndex = pickFontIndexForText(text, 1);
  const pickedEntry = fontState.fonts[pickedIndex];
  console.log(`Picked font index: ${pickedIndex} (${pickedEntry?.label || "none"})`);

  // Check shaping
  if (pickedEntry?.font) {
    const shaped = shapeClusterWithFont(pickedEntry, text);
    console.log(`Shaped glyphs: ${shaped.glyphs.length}, advance: ${shaped.advance}`);
    shaped.glyphs.forEach((g, i) => {
      console.log(`  Glyph ${i}: id=${g.glyphId} xAdvance=${g.xAdvance} xOffset=${g.xOffset} yOffset=${g.yOffset}`);
    });
  }

  // Check constraint
  const constraint = getNerdConstraint(cp);
  console.log(`Nerd constraint:`, constraint || "none");

  console.groupEnd();
}

// Expose diagnostic to window for debugging
(window as any).diagnoseCodepoint = diagnoseCodepoint;

function assetUrl(path) {
  // Dev server expects /playground/public/* paths
  let normalized = path;
  if (normalized.startsWith("./public/")) {
    normalized = `/playground/public/${normalized.slice("./public/".length)}`;
  } else if (!normalized.startsWith("/playground/public/") && !normalized.startsWith("/")) {
    normalized = `/playground/public/${normalized}`;
  }
  return new URL(normalized, window.location.origin).toString();
}

const fallbackFontSources = [
  {
    name: "Symbols Nerd Font Mono",
    url: assetUrl("./public/fonts/SymbolsNerdFontMono-Regular.ttf"),
    matchers: ["symbols nerd font mono", "symbols nerd font", "nerd fonts symbols"],
  },
  {
    name: "Noto Sans Symbols 2",
    url: assetUrl("./public/fonts/NotoSansSymbols2-Regular.ttf"),
    matchers: ["noto sans symbols 2", "noto sans symbols"],
  },
  {
    name: "Noto Sans CJK",
    url: assetUrl("./public/fonts/NotoSansCJK-Regular.ttc"),
    matchers: [
      "noto sans cjk",
      "source han sans",
      "pingfang",
      "hiragino",
      "yu gothic",
      "meiryo",
      "microsoft yahei",
      "ms gothic",
      "simhei",
      "simsun",
      "apple sd gothic",
      "nanum",
    ],
  },
];

const gridState = {
  cols: 0,
  rows: 0,
  cellW: 0,
  cellH: 0,
  fontSizePx: 0,
  scale: 1,
  lineHeight: 0,
  baselineOffset: 0,
  yPad: 0,
};

let fontPromise: Promise<void> | null = null;
let fontError: Error | null = null;

function log(msg) {
  logEl.textContent = msg;
  appendLog(`[ui] ${msg}`);
}

function shouldSuppressWasmLog(text) {
  for (const filter of WASM_LOG_FILTERS) {
    if (filter.re.test(text)) {
      if (!wasmLogNotes.has(filter.note)) {
        wasmLogNotes.add(filter.note);
        appendLog(filter.note);
      }
      return true;
    }
  }
  return false;
}

function appendLog(line) {
  const timestamp = new Date().toISOString().slice(11, 23);
  logBuffer.push(`${timestamp} ${line}`);
  if (logBuffer.length > LOG_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_LIMIT);
  }
  if (logDumpEl) {
    logDumpEl.value = logBuffer.join("\n");
    logDumpEl.scrollTop = logDumpEl.scrollHeight;
  }
}

function applyTheme(theme, sourceLabel = "theme") {
  if (!theme) return;

  if (theme.colors.background) {
    defaultBg = colorToFloats(theme.colors.background, 1);
  }
  if (theme.colors.foreground) {
    defaultFg = colorToFloats(theme.colors.foreground, 1);
  }
  if (theme.colors.selectionBackground) {
    selectionColor = colorToFloats(theme.colors.selectionBackground);
  }
  if (theme.colors.cursor) {
    cursorFallback = colorToFloats(theme.colors.cursor, 1);
  }

  activeTheme = theme;

  if (wasmReady && wasm && wasmHandle) {
    const fg = theme.colors.foreground ? colorToRgbU32(theme.colors.foreground) : 0xffffffff;
    const bg = theme.colors.background ? colorToRgbU32(theme.colors.background) : 0xffffffff;
    const cursor = theme.colors.cursor ? colorToRgbU32(theme.colors.cursor) : 0xffffffff;
    if (wasm.setDefaultColors) {
      wasm.setDefaultColors(wasmHandle, fg, bg, cursor);
    }

    const palette = theme.colors.palette;
    let maxIndex = -1;
    for (let i = palette.length - 1; i >= 0; i -= 1) {
      if (palette[i]) {
        maxIndex = i;
        break;
      }
    }
    if (maxIndex >= 0 && wasm.setPalette) {
      const count = maxIndex + 1;
      const bytes = new Uint8Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const color = palette[i];
        if (!color) continue;
        const base = i * 3;
        bytes[base] = color.r & 0xff;
        bytes[base + 1] = color.g & 0xff;
        bytes[base + 2] = color.b & 0xff;
      }
      wasm.setPalette(wasmHandle, bytes, count);
    }

    wasm.renderUpdate(wasmHandle);
  }

  needsRender = true;
  appendLog(`[ui] theme applied (${sourceLabel})`);
}

function resetTheme() {
  defaultBg = [...DEFAULT_BG_BASE];
  defaultFg = [...DEFAULT_FG_BASE];
  selectionColor = [...SELECTION_BASE];
  cursorFallback = [...CURSOR_BASE];
  activeTheme = null;

  if (wasmReady && wasm && wasmHandle) {
    const fg = 0xffffff;
    const bg = 0x000000;
    const cursor = 0xffffff;
    if (wasm.setDefaultColors) {
      wasm.setDefaultColors(wasmHandle, fg, bg, cursor);
    }
    if (wasm.resetPalette) {
      wasm.resetPalette(wasmHandle);
    }
    wasm.renderUpdate(wasmHandle);
  }

  needsRender = true;
  appendLog("[ui] theme reset (default)");
}

let themeManifestLoaded = false;
let defaultThemeApplied = false;

function populateThemeSelect(names) {
  if (!themeSelect) return;
  const existing = new Set();
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
      if (!defaultThemeApplied && !activeTheme && data.themes.includes(DEFAULT_THEME_NAME)) {
        defaultThemeApplied = true;
        if (themeSelect) themeSelect.value = DEFAULT_THEME_NAME;
        await loadThemeByName(DEFAULT_THEME_NAME, "default theme");
      }
    }
  } catch (err) {
    appendLog(`[ui] theme manifest failed: ${err?.message ?? err}`);
  }
}

function replaceCanvas(): void {
  const parent = canvas.parentElement;
  if (!parent) return;
  const oldWidth = canvas.width;
  const oldHeight = canvas.height;
  const newCanvas = document.createElement("canvas");
  newCanvas.id = canvas.id;
  newCanvas.className = canvas.className;
  newCanvas.style.cssText = canvas.style.cssText;
  parent.replaceChild(newCanvas, canvas);
  canvas = newCanvas;
  // Force layout reflow
  void canvas.offsetWidth;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  canvas.width = w;
  canvas.height = h;
  currentDpr = dpr;
  console.log(`[replaceCanvas] old=${oldWidth}x${oldHeight} css=${rect.width.toFixed(0)}x${rect.height.toFixed(0)} new=${w}x${h} dpr=${dpr}`);
  currentContextType = null;
  // Clear glyph atlases from font entries (they were for old context)
  for (const entry of fontState.fonts) {
    if (entry) {
      entry.atlas = null;
      entry.glyphIds = new Set();
      entry.fontSizePx = 0;
    }
  }
  // Clear atlas state from activeState
  if (activeState && activeState.glyphAtlases) {
    activeState.glyphAtlases.clear();
  }
}

function updateSize(force = false) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
  const nextHeight = Math.max(1, Math.floor(rect.height * dpr));
  const sizeChanged = nextWidth !== canvas.width || nextHeight !== canvas.height || dpr !== currentDpr;
  if (!sizeChanged && !force) return;
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  dprEl.textContent = dpr.toFixed(2);
  sizeEl.textContent = `${canvas.width}x${canvas.height}`;
  currentDpr = dpr;
  resizeState.active = true;
  resizeState.lastAt = performance.now();
  const metrics = computeCellMetrics();
  if (metrics?.cellW && metrics?.cellH) {
    resizeState.cols = Math.max(1, Math.floor(canvas.width / metrics.cellW));
    resizeState.rows = Math.max(1, Math.floor(canvas.height / metrics.cellH));
  }

  if (backend === "webgpu" && activeState && activeState.context) {
    activeState.context.configure({
      device: activeState.device,
      format: activeState.format,
      alphaMode: "opaque",
    });
  }

  updateGrid();
  needsRender = true;
}

function scheduleSizeUpdate() {
  if (sizeRaf) cancelAnimationFrame(sizeRaf);
  sizeRaf = requestAnimationFrame(() => {
    sizeRaf = 0;
    updateSize();
  });
}

window.addEventListener("resize", scheduleSizeUpdate);

if ("ResizeObserver" in window) {
  const ro = new ResizeObserver(() => scheduleSizeUpdate());
  ro.observe(document.body);
}

window.addEventListener("load", scheduleSizeUpdate);

function decodeRGBA(bytes, index) {
  const offset = index * 4;
  const r = (bytes[offset] ?? 0) / 255;
  const g = (bytes[offset + 1] ?? 0) / 255;
  const b = (bytes[offset + 2] ?? 0) / 255;
  const a = (bytes[offset + 3] ?? 0) / 255;
  return [r, g, b, a];
}

function decodePackedRGBA(color) {
  return [
    (color & 0xff) / 255,
    ((color >>> 8) & 0xff) / 255,
    ((color >>> 16) & 0xff) / 255,
    ((color >>> 24) & 0xff) / 255,
  ];
}

async function tryFetchFontBuffer(url) {
  try {
    console.log("[font] Fetching:", url);
    const response = await fetch(url);
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log("[font] Loaded:", url, "size:", buffer.byteLength);
      return buffer;
    }
    console.warn("[font] Fetch failed:", url, response.status, response.statusText);
  } catch (err) {
    console.warn("[font] Fetch error:", url, err);
  }
  return null;
}

async function tryLocalFontBuffer(matchers) {
  if (!("queryLocalFonts" in navigator)) return null;
  try {
    const fonts = await navigator.queryLocalFonts();
    const match = fonts.find((font) => {
      const name = `${font.family ?? ""} ${font.fullName ?? ""} ${font.postscriptName ?? ""}`.toLowerCase();
      return matchers.some((matcher) => name.includes(matcher));
    });
    if (match) {
      const blob = await match.blob();
      return blob.arrayBuffer();
    }
  } catch (err) {
    console.warn("queryLocalFonts failed", err);
  }
  return null;
}

async function loadFontBuffer() {
  const nerdLocal = await tryLocalFontBuffer([
    "jetbrainsmono nerd font",
    "jetbrains mono nerd font",
    "fira code nerd font",
    "fira code nerd",
    "hack nerd font",
    "meslo lgm nerd font",
    "monaspace nerd font",
    "nerd font mono",
  ]);
  if (nerdLocal) return nerdLocal;
  const buffer = await tryFetchFontBuffer(
    assetUrl("./public/fonts/JetBrainsMono-Regular.ttf"),
  );
  if (buffer) return buffer;
  const local = await tryLocalFontBuffer(["jetbrains mono"]);
  if (local) return local;
  throw new Error("Unable to load JetBrains Mono font.");
}

async function loadFallbackFontBuffers() {
  const results: { name: string; buffer: ArrayBuffer }[] = [];
  for (const source of fallbackFontSources) {
    const buffer = await tryFetchFontBuffer(source.url);
    if (buffer) {
      results.push({ name: source.name, buffer });
      continue;
    }
    if (source.matchers && source.matchers.length) {
      const local = await tryLocalFontBuffer(source.matchers);
      if (local) results.push({ name: source.name, buffer: local });
    }
  }
  return results;
}

async function ensureFont() {
  if (fontState.font || fontPromise) return fontPromise;
  fontPromise = (async () => {
    try {
      const buffer = await loadFontBuffer();
      const primaryFont = await Font.loadAsync(buffer);
      const entries = [createFontEntry(primaryFont, "primary")];
      const fallbackBuffers = await loadFallbackFontBuffers();
      for (const fallback of fallbackBuffers) {
        try {
          const collection = Font.collection(fallback.buffer);
          if (collection) {
            const names = collection.names();
            for (const info of names) {
              try {
                const face = collection.get(info.index);
                // Use font metadata if available, but prefer configured name for symbol fonts
                const metadataLabel =
                  info.fullName ||
                  info.family ||
                  info.postScriptName ||
                  "";
                // Include both configured name and metadata to ensure symbol font detection works
                const label = metadataLabel
                  ? `${fallback.name} (${metadataLabel})`
                  : `${fallback.name} ${info.index}`;
                entries.push(createFontEntry(face, label));
              } catch (err) {
                console.warn(`fallback face load failed (${fallback.name} ${info.index})`, err);
              }
            }
          } else {
            const fbFont = await Font.loadAsync(fallback.buffer);
            entries.push(createFontEntry(fbFont, fallback.name));
          }
        } catch (err) {
          console.warn(`fallback font load failed (${fallback.name})`, err);
        }
      }
      fontState.fonts = entries;
      fontState.font = entries[0].font;
      fontState.fontSizePx = 0;
      fontState.fontPickCache.clear();
      if (activeState && activeState.glyphAtlases) {
        activeState.glyphAtlases = new Map();
      }
      fontError = null;
      // Log loaded fonts and their symbol font status
      console.log("[font] Font entries loaded:");
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const sym = isSymbolFont(entry);
        const nerd = isNerdSymbolFont(entry);
        console.log(`  [${i}] ${entry.label} - symbol:${sym} nerd:${nerd}`);
      }
      if (entries.length > 1) {
        log(`font loaded (+${entries.length - 1} fallback)`);
      } else {
        log("font loaded");
      }
      updateGrid();
    } catch (err) {
      fontError = err;
      console.error("font load error", err);
      log("font load failed");
    }
  })();
  return fontPromise;
}

function shapeClusterWithFont(entry, text) {
  const cached = entry.glyphCache.get(text);
  if (cached) return cached;
  const buffer = new UnicodeBuffer();
  buffer.addStr(text);
  const glyphBuffer = shape(entry.font, buffer);
  const glyphs = glyphBufferToShapedGlyphs(glyphBuffer);
  const advance = glyphs.reduce((sum, g) => sum + g.xAdvance, 0);
  const shaped = { glyphs, advance };
  entry.glyphCache.set(text, shaped);
  return shaped;
}

function fontHasGlyph(font, ch) {
  const glyphId = font.glyphIdForChar(ch);
  return glyphId !== undefined && glyphId !== null && glyphId !== 0;
}

function pickFontIndexForText(text, expectedSpan = 1) {
  if (!fontState.fonts.length) return 0;
  const cacheKey = `${expectedSpan}:${text}`;
  const cached = fontState.fontPickCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const chars = Array.from(text);
  const primary = fontState.fonts[0];
  const primaryHeight = primary?.font ? fontHeightUnits(primary.font) : 0;
  const primaryAdvance = primary ? fontAdvanceUnits(primary) : 0;
  const primaryRatio =
    primaryHeight > 0 ? primaryAdvance / primaryHeight : 0.5;
  const targetRatio = primaryRatio * expectedSpan;
  const firstCp = text.codePointAt(0) ?? 0;
  const nerdSymbol = isNerdSymbolCodepoint(firstCp);
  const preferSymbol = nerdSymbol || isSymbolCp(firstCp);

  if (nerdSymbol) {
    const symbolIndex = fontState.fonts.findIndex((entry) => isSymbolFont(entry));
    if (symbolIndex >= 0) {
      const entry = fontState.fonts[symbolIndex];
      if (entry?.font) {
        let ok = true;
        for (const ch of chars) {
          if (!fontHasGlyph(entry.font, ch)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          fontState.fontPickCache.set(cacheKey, symbolIndex);
          return symbolIndex;
        } else {
          console.warn(`[font] Nerd symbol U+${firstCp.toString(16).toUpperCase()} not found in symbol font ${entry.label}`);
        }
      }
    } else {
      console.warn(`[font] No symbol font found for nerd symbol U+${firstCp.toString(16).toUpperCase()}`);
    }
  }

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < fontState.fonts.length; i += 1) {
    const entry = fontState.fonts[i];
    if (!entry?.font) continue;
    let ok = true;
    for (const ch of chars) {
      if (!fontHasGlyph(entry.font, ch)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const height = fontHeightUnits(entry.font);
    const advance = shapeClusterWithFont(entry, text).advance;
    const ratio = height > 0 ? advance / height : targetRatio;
    let score = Math.abs(ratio - targetRatio);
    if (preferSymbol && isSymbolFont(entry)) score *= nerdSymbol ? 0.2 : 0.6;
    if (!preferSymbol && isSymbolFont(entry)) score *= 1.4;
    if (nerdSymbol && !isSymbolFont(entry)) score *= 2.0;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  fontState.fontPickCache.set(cacheKey, bestIndex);
  return bestIndex;
}

function computeCellMetrics() {
  const primary = fontState.fonts[0];
  if (!primary) return null;
  const fontSizePx = Math.max(1, Math.round(fontConfig.sizePx * currentDpr));
  const scale = primary.font.scaleForSize(fontSizePx, fontState.sizeMode);
  const glyphId = primary.font.glyphIdForChar("M");
  const advanceUnits =
    glyphId !== undefined && glyphId !== null
      ? primary.font.advanceWidth(glyphId)
      : shapeClusterWithFont(primary, "M").advance;
  const cellW = Math.max(1, Math.round(advanceUnits * scale));
  const lineHeight = fontHeightUnits(primary.font) * scale;
  const cellH = Math.max(1, Math.round(lineHeight));
  const baselineOffset = primary.font.ascender * scale;
  const yPad = Math.max(0, (cellH - lineHeight) * 0.5);
  return { cellW, cellH, fontSizePx, scale, lineHeight, baselineOffset, yPad };
}

function updateGrid() {
  if (!fontState.fonts.length) return;
  const metrics = computeCellMetrics();
  if (!metrics) return;
  const cols = Math.max(1, Math.floor(canvas.width / metrics.cellW));
  const rows = Math.max(1, Math.floor(canvas.height / metrics.cellH));
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return;
  if (gridEl) gridEl.textContent = `${cols}x${rows}`;
  if (cellEl) cellEl.textContent = `${Math.round(metrics.cellW)}x${Math.round(metrics.cellH)}`;
  const changed =
    cols !== gridState.cols ||
    rows !== gridState.rows ||
    metrics.fontSizePx !== gridState.fontSizePx ||
    metrics.cellW !== gridState.cellW ||
    metrics.cellH !== gridState.cellH;

  if (metrics.fontSizePx !== gridState.fontSizePx) {
    for (const entry of fontState.fonts) resetFontEntry(entry);
    if (activeState && activeState.glyphAtlases) {
      activeState.glyphAtlases = new Map();
    }
  }

  Object.assign(gridState, metrics, { cols, rows });

  if (changed && wasmReady && wasm && wasmHandle) {
    wasm.resize(wasmHandle, cols, rows);
    wasm.renderUpdate(wasmHandle);
    lastWasmUpdate = performance.now();
    needsRender = true;
  }

  if (changed && ptySocket && ptySocket.readyState === WebSocket.OPEN) {
    ptySocket.send(JSON.stringify({ type: "resize", cols, rows }));
  }
}

function ensureAtlasForFont(device, state, entry, neededGlyphIds, fontSizePx, fontIndex, atlasScale) {
  if (!entry || !entry.font) return false;
  const scaleOverride = fontRasterScale(entry, fontIndex);
  const effectiveFontSizePx = Math.max(
    1,
    Math.round(fontSizePx * (atlasScale || 1) * scaleOverride),
  );
  let needsRebuild =
    !entry.atlas ||
    entry.fontSizePx !== effectiveFontSizePx ||
    entry.atlasScale !== (atlasScale || 1);

  if (!needsRebuild) {
    for (const glyphId of neededGlyphIds) {
      if (!entry.glyphIds.has(glyphId)) {
        needsRebuild = true;
        break;
      }
    }
  }

  if (!needsRebuild) return false;

  const union = new Set(entry.glyphIds);
  for (const glyphId of neededGlyphIds) union.add(glyphId);

  const useHinting = fontIndex === 0 && !isSymbolFont(entry);
  const isSymbol = isSymbolFont(entry);
  const atlasPadding = isSymbol ? Math.max(ATLAS_PADDING, SYMBOL_ATLAS_PADDING) : ATLAS_PADDING;
  const atlasMaxSize = isSymbol ? SYMBOL_ATLAS_MAX_SIZE : 2048;
  const atlas = buildAtlas(entry.font, [...union], {
    fontSize: effectiveFontSizePx,
    sizeMode: fontState.sizeMode,
    padding: atlasPadding,
    pixelMode: PixelMode.Gray,
    hinting: useHinting,
    maxWidth: atlasMaxSize,
    maxHeight: atlasMaxSize,
  });

  entry.atlas = atlas;
  entry.glyphIds = union;
  entry.fontSizePx = effectiveFontSizePx;
  entry.atlasScale = atlasScale || 1;

  const rgba = atlasToRGBA(atlas);
  // Avoid halo bleed on symbol atlases; keep padding clean.
  const atlasCanvas = document.createElement("canvas");
  atlasCanvas.width = atlas.bitmap.width;
  atlasCanvas.height = atlas.bitmap.rows;
  const ctx = atlasCanvas.getContext("2d");
  const imageData = new ImageData(
    new Uint8ClampedArray(rgba),
    atlas.bitmap.width,
    atlas.bitmap.rows,
  );
  ctx.putImageData(imageData, 0, 0);

  const texture = device.createTexture({
    size: [atlas.bitmap.width, atlas.bitmap.rows, 1],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: atlasCanvas },
    { texture },
    [atlas.bitmap.width, atlas.bitmap.rows],
  );

  const scaleHint = atlasScale ?? 1;
  const symbolAtlas = isSymbolFont(entry);
  const preferNearest = fontIndex === 0 || symbolAtlas || scaleHint >= 0.99;
  const sampler = device.createSampler({
    magFilter: preferNearest ? "nearest" : "linear",
    minFilter: preferNearest ? "nearest" : "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  const bindGroup = device.createBindGroup({
    layout: state.glyphPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: state.uniformBuffer } },
      { binding: 1, resource: sampler },
      { binding: 2, resource: texture.createView() },
    ],
  });

  if (!state.glyphAtlases) state.glyphAtlases = new Map();
  const inset = symbolAtlas ? 0.5 : preferNearest ? 0.5 : 1.0;
  state.glyphAtlases.set(fontIndex, {
    texture,
    sampler,
    bindGroup,
    width: atlas.bitmap.width,
    height: atlas.bitmap.rows,
    inset,
  });

  return true;
}

function selectionForRow(row, cols) {
  if (!selectionState.active || !selectionState.anchor || !selectionState.focus) return null;
  const a = selectionState.anchor;
  const f = selectionState.focus;
  const forward = f.row > a.row || (f.row === a.row && f.col >= a.col);
  const start = forward ? a : f;
  const end = forward ? f : a;
  if (start.row === end.row && row === start.row) {
    const left = Math.min(start.col, end.col);
    const right = Math.max(start.col, end.col) + 1;
    return { start: clamp(left, 0, cols), end: clamp(right, 0, cols) };
  }
  if (row < start.row || row > end.row) return null;
  if (row === start.row) {
    return { start: clamp(start.col, 0, cols), end: cols };
  }
  if (row === end.row) {
    return { start: 0, end: clamp(end.col + 1, 0, cols) };
  }
  return { start: 0, end: cols };
}

function getCellText(render, idx) {
  const cp = render.codepoints[idx];
  if (!cp) return " ";
  let text = String.fromCodePoint(cp);
  if (render.graphemeLen && render.graphemeOffset && render.graphemeBuffer) {
    const extra = render.graphemeLen[idx] ?? 0;
    if (extra > 0) {
      const start = render.graphemeOffset[idx] ?? 0;
      const cps = [cp];
      for (let j = 0; j < extra; j += 1) {
        const extraCp = render.graphemeBuffer[start + j];
        if (extraCp) cps.push(extraCp);
      }
      text = String.fromCodePoint(...cps);
    }
  }
  return text;
}

function getSelectionText() {
  if (!selectionState.active || !selectionState.anchor || !selectionState.focus) return "";
  if (!lastRenderState) return "";
  const { rows, cols } = lastRenderState;
  if (!rows || !cols) return "";

  const a = selectionState.anchor;
  const f = selectionState.focus;
  const forward = f.row > a.row || (f.row === a.row && f.col >= a.col);
  const startRow = forward ? a.row : f.row;
  const endRow = forward ? f.row : a.row;

  const lines = [];
  for (let row = startRow; row <= endRow; row += 1) {
    const range = selectionForRow(row, cols);
    if (!range) continue;
    let line = "";
    for (let col = range.start; col < range.end; col += 1) {
      const idx = row * cols + col;
      line += getCellText(lastRenderState, idx);
    }
    line = line.replace(/[ \t]+$/g, "");
    lines.push(line);
  }
  return lines.join("\n");
}


function getRenderState() {
  if (!wasmReady || !wasm || !wasmHandle) return null;
  return wasm.getRenderState(wasmHandle);
}

function tickWebGPU(state) {
  const { device, context } = state;

  if (fontError) {
    termDebug.textContent = `Font error: ${fontError.message}`;
  }

  updateGrid();

  const render = getRenderState();
  if (!render || !fontState.font) {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: defaultBg[0], g: defaultBg[1], b: defaultBg[2], a: defaultBg[3] },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.end();
    device.queue.submit([encoder.finish()]);
    return;
  }

  lastRenderState = render;

  const {
    rows,
    cols,
    cellCount,
    codepoints,
    wide,
    fgBytes,
    bgBytes,
    ulBytes,
    ulStyle,
    graphemeOffset,
    graphemeLen,
    graphemeBuffer,
    selectionStart,
    selectionEnd,
    cursor,
  } = render;

  if (!codepoints || !fgBytes) return;

  if (termSizeEl) termSizeEl.textContent = `${cols}x${rows}`;
  if (cursorPosEl && cursor) {
    cursorPosEl.textContent = `${cursor.col},${cursor.row}`;
    lastCursorForCpr = { row: cursor.row + 1, col: cursor.col + 1 };
  }
  if (dbgEl && wasmExports && wasmHandle) {
    const cx = wasmExports.wterm_debug_cursor_x ? wasmExports.wterm_debug_cursor_x(wasmHandle) : 0;
    const cy = wasmExports.wterm_debug_cursor_y ? wasmExports.wterm_debug_cursor_y(wasmHandle) : 0;
    const sl = wasmExports.wterm_debug_scroll_left ? wasmExports.wterm_debug_scroll_left(wasmHandle) : 0;
    const sr = wasmExports.wterm_debug_scroll_right ? wasmExports.wterm_debug_scroll_right(wasmHandle) : 0;
    const tc = wasmExports.wterm_debug_term_cols ? wasmExports.wterm_debug_term_cols(wasmHandle) : 0;
    const tr = wasmExports.wterm_debug_term_rows ? wasmExports.wterm_debug_term_rows(wasmHandle) : 0;
    const pc = wasmExports.wterm_debug_page_cols ? wasmExports.wterm_debug_page_cols(wasmHandle) : 0;
    const pr = wasmExports.wterm_debug_page_rows ? wasmExports.wterm_debug_page_rows(wasmHandle) : 0;
    dbgEl.textContent = `${cx},${cy} | ${sl}-${sr} | t:${tc}x${tr} p:${pc}x${pr}`;
  }

  const cellW = gridState.cellW || canvas.width / cols;
  const cellH = gridState.cellH || canvas.height / rows;
  const fontSizePx = gridState.fontSizePx || Math.max(1, Math.round(cellH));
  const primaryEntry = fontState.fonts[0];
  const primaryScale =
    gridState.scale || fontState.font.scaleForSize(fontSizePx, fontState.sizeMode);
  const lineHeight = gridState.lineHeight || fontHeightUnits(fontState.font) * primaryScale;
  const baselineOffset = gridState.baselineOffset || fontState.font.ascender * primaryScale;
  const yPad = gridState.yPad ?? (cellH - lineHeight) / 2;
  const post = fontState.font.post;
  const underlinePosition = post?.underlinePosition ?? Math.round(-fontState.font.upem * 0.08);
  const underlineThickness = post?.underlineThickness ?? Math.round(fontState.font.upem * 0.05);
  const underlineOffsetPx = underlinePosition * primaryScale;
  const underlineThicknessPx = Math.max(1, Math.round(underlineThickness * primaryScale));

  const bgData = [];
  const selectionData = [];
  const underlineData = [];
  const cursorData = [];
  const fgRectData = [];
  const overlayData = [];
  const glyphDataByFont = new Map();
  const glyphQueueByFont = new Map();
  const overlayGlyphDataByFont = new Map();
  const overlayGlyphQueueByFont = new Map();
  const neededGlyphIdsByFont = new Map();
  const baseScaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font) return primaryScale;
    if (idx === 0) return primaryScale;
    return entry.font.scaleForSize(fontSizePx, fontState.sizeMode) * fontScaleOverride(entry);
  });

  const scaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font) return primaryScale;
    if (idx === 0) return primaryScale;
    const baseScale = baseScaleByFont[idx] ?? primaryScale;
    const baseHeightPx = fontHeightUnits(entry.font) * baseScale;
    const targetHeightPx = lineHeight;
    const heightAdjust = baseHeightPx > 0 ? Math.min(1, targetHeightPx / baseHeightPx) : 1;
    const advanceUnits = fontAdvanceUnits(entry);
    const maxSpan = fontMaxCellSpan(entry);
    const widthPx = advanceUnits * baseScale;
    const widthAdjust = widthPx > 0 ? Math.min(1, (cellW * maxSpan) / widthPx) : 1;
    return baseScale * Math.min(heightAdjust, widthAdjust);
  });

  const bitmapScaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font || idx === 0) return 1;
    const baseScale = baseScaleByFont[idx] ?? 0;
    if (baseScale <= 0) return 1;
    const targetScale = scaleByFont[idx] ?? baseScale;
    return Math.min(1, targetScale / baseScale);
  });

  const baselineAdjustByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font || idx === 0 || !primaryEntry?.font) return 0;
    const scale = scaleByFont[idx] ?? primaryScale;
    return primaryEntry.font.ascender * primaryScale - entry.font.ascender * scale;
  });

  const nerdMetrics = {
    cellWidth: cellW,
    cellHeight: cellH,
    faceWidth: cellW,
    faceHeight: lineHeight,
    faceY: Math.max(0, (cellH - lineHeight) * 0.5),
    iconHeight: lineHeight,
    iconHeightSingle: lineHeight * 0.8,
  };

  const getGlyphQueue = (fontIndex) => {
    if (!glyphQueueByFont.has(fontIndex)) glyphQueueByFont.set(fontIndex, []);
    return glyphQueueByFont.get(fontIndex);
  };
  const getOverlayGlyphQueue = (fontIndex) => {
    if (!overlayGlyphQueueByFont.has(fontIndex)) overlayGlyphQueueByFont.set(fontIndex, []);
    return overlayGlyphQueueByFont.get(fontIndex);
  };
  const getGlyphSet = (fontIndex) => {
    if (!neededGlyphIdsByFont.has(fontIndex)) neededGlyphIdsByFont.set(fontIndex, new Set());
    return neededGlyphIdsByFont.get(fontIndex);
  };
  const getGlyphData = (map, fontIndex) => {
    if (!map.has(fontIndex)) map.set(fontIndex, []);
    return map.get(fontIndex);
  };

  for (let row = 0; row < rows; row += 1) {
    const rowY = row * cellH;
    const baseY = rowY + yPad + baselineOffset;
    let selStart = selectionStart ? selectionStart[row] : -1;
    let selEnd = selectionEnd ? selectionEnd[row] : -1;
    const localSel = selectionForRow(row, cols);
    if (localSel) {
      selStart = localSel.start;
      selEnd = localSel.end;
    }
    if (selStart >= 0 && selEnd > selStart) {
      const start = Math.max(0, selStart);
      const end = Math.min(cols, selEnd);
      pushRect(
        selectionData,
        start * cellW,
        rowY,
        (end - start) * cellW,
        cellH,
        selectionColor,
      );
    }

    for (let col = 0; col < cols; col += 1) {
      const idx = row * cols + col;
      const x = col * cellW;

      if (bgBytes) {
        const bg = decodeRGBA(bgBytes, idx);
        if (bg[3] > 0) pushRect(bgData, x, rowY, cellW, cellH, bg);
      }

      if (ulStyle && ulBytes && ulStyle[idx] > 0) {
        const ul = decodeRGBA(ulBytes, idx);
        if (ul[3] > 0) {
          const style = ulStyle[idx];
          const thickness = underlineThicknessPx;
          const underlineY = clamp(
            baseY + underlineOffsetPx,
            rowY + 1,
            rowY + cellH - thickness - 1,
          );
          pushRect(underlineData, x, underlineY, cellW, thickness, ul);
          if (style === 2) {
            const gap = Math.max(1, Math.round(thickness * 0.6));
            pushRect(underlineData, x, underlineY + thickness + gap, cellW, thickness, ul);
          }
        }
      }

      const wideFlag = wide ? wide[idx] : 0;
      if (wideFlag === 2 || wideFlag === 3) continue;

      const cp = codepoints[idx];
      if (!cp) continue;

      let text = String.fromCodePoint(cp);
      if (graphemeLen && graphemeOffset && graphemeBuffer) {
        const extra = graphemeLen[idx] ?? 0;
        if (extra > 0) {
          const start = graphemeOffset[idx] ?? 0;
          const cps = [cp];
          for (let j = 0; j < extra; j += 1) {
            const extraCp = graphemeBuffer[start + j];
            if (extraCp) cps.push(extraCp);
          }
          text = String.fromCodePoint(...cps);
        }
      }

      const fg = decodeRGBA(fgBytes, idx);

      if (isBlockElement(cp)) {
        if (drawBlockElement(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }

      if (isBoxDrawing(cp)) {
        if (drawBoxDrawing(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }

      if (isBraille(cp)) {
        if (drawBraille(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }

      if (isPowerline(cp)) {
        if (drawPowerline(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }

      if (text.trim() === "") continue;

      const baseSpan = wideFlag === 1 ? 2 : 1;
      const fontIndex = pickFontIndexForText(text, baseSpan);
      const fontEntry = fontState.fonts[fontIndex] ?? fontState.fonts[0];
      const shaped = shapeClusterWithFont(fontEntry, text);
      if (!shaped.glyphs.length) continue;
      const glyphSet = getGlyphSet(fontIndex);
      for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);

      const fontScale = scaleByFont[fontIndex] ?? primaryScale;
      let cellSpan = baseSpan;
      const symbolLike = isSymbolCp(cp);
      let constraintWidth = baseSpan;
      let forceFit = false;
      let glyphWidthPx = 0;
      if (symbolLike) {
        if (baseSpan === 1) {
          if (col === cols - 1) {
            constraintWidth = 1;
          } else if (col > 0) {
            const prevCp = codepoints[idx - 1];
            if (isSymbolCp(prevCp) && !isGraphicsElement(prevCp)) {
              constraintWidth = 1;
            }
          }
          if (constraintWidth === 1) {
            const nextCp = codepoints[idx + 1];
            if (isSpaceCp(nextCp)) constraintWidth = 2;
          }
          cellSpan = constraintWidth;
        }
        if (shaped.glyphs.length === 1) {
          const glyphId = shaped.glyphs[0].glyphId;
          const widthUnits = glyphWidthUnits(fontEntry, glyphId);
          if (widthUnits > 0) {
            glyphWidthPx = widthUnits * fontScale;
          }
        }
        if (!glyphWidthPx) {
          glyphWidthPx = shaped.advance * fontScale;
        }
        if (glyphWidthPx > cellW * cellSpan * 1.05) {
          forceFit = true;
        }
      }
      const cellWidthPx = cellW * cellSpan;
      const xPad = 0;

      getGlyphQueue(fontIndex).push({
        x,
        baseY,
        xPad,
        fg,
        shaped,
        fontIndex,
        scale: fontScale,
        cellWidth: cellWidthPx,
        symbolLike,
        constraintWidth,
        forceFit,
        glyphWidthPx,
        cp,
      });
    }
  }

  if (cursor && imeState.preedit) {
    const preeditText = imeState.preedit;
    const preeditFontIndex = pickFontIndexForText(preeditText, 1);
    const preeditEntry = fontState.fonts[preeditFontIndex] ?? fontState.fonts[0];
    const shaped = shapeClusterWithFont(preeditEntry, preeditText);
    const glyphSet = getGlyphSet(preeditFontIndex);
    for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);
    const baseY = cursor.row * cellH + yPad + baselineOffset;
    const x = cursor.col * cellW;
    const preeditScale = scaleByFont[preeditFontIndex] ?? primaryScale;
    const advancePx = shaped.advance * preeditScale;
    const widthPx = Math.max(cellW, advancePx);
    const rowY = cursor.row * cellH;
    pushRect(bgData, x, cursor.row * cellH, widthPx, cellH, PREEDIT_BG);
    const thickness = underlineThicknessPx;
    const underlineBaseY = clamp(
      baseY + underlineOffsetPx,
      cursor.row * cellH + 1,
      cursor.row * cellH + cellH - thickness - 1,
    );
    pushRect(
      underlineData,
      x,
      underlineBaseY,
      widthPx,
      thickness,
      PREEDIT_UL,
    );
    const selStart = imeState.selectionStart || 0;
    const selEnd = imeState.selectionEnd || 0;
    if (selEnd > selStart) {
      const leftWidth =
        shapeClusterWithFont(preeditEntry, preeditText.slice(0, selStart)).advance *
        preeditScale;
      const selWidth =
        shapeClusterWithFont(preeditEntry, preeditText.slice(selStart, selEnd)).advance *
        preeditScale;
      pushRect(bgData, x + leftWidth, rowY, selWidth, cellH, PREEDIT_ACTIVE_BG);
      pushRect(
        underlineData,
        x + leftWidth,
        underlineBaseY,
        selWidth,
        thickness,
        PREEDIT_UL,
      );
    } else {
      const caretWidth = Math.max(1, Math.floor(cellW * 0.1));
      const caretX =
        x +
        shapeClusterWithFont(preeditEntry, preeditText.slice(0, selStart)).advance *
          preeditScale;
      pushRect(cursorData, caretX, rowY + 2, caretWidth, cellH - 4, PREEDIT_CARET);
    }
    getGlyphQueue(preeditFontIndex).push({
      x,
      baseY,
      xPad: 0,
      fg: PREEDIT_FG,
      shaped,
      fontIndex: preeditFontIndex,
      scale: preeditScale,
      cellWidth: cellW,
      symbolLike: false,
    });
  }

  const resizeAge = performance.now() - resizeState.lastAt;
  if (
    resizeState.cols > 0 &&
    resizeState.rows > 0 &&
    resizeAge >= 0 &&
    resizeAge < RESIZE_OVERLAY_HOLD_MS + RESIZE_OVERLAY_FADE_MS
  ) {
    const fade =
      resizeAge <= RESIZE_OVERLAY_HOLD_MS
        ? 1
        : 1 - (resizeAge - RESIZE_OVERLAY_HOLD_MS) / RESIZE_OVERLAY_FADE_MS;
    const alpha = clamp(fade, 0, 1);
    if (alpha > 0.01) {
      const overlayText = `${resizeState.cols}x${resizeState.rows}`;
      const overlayEntry = fontState.fonts[0];
      if (overlayEntry?.font) {
        const shaped = shapeClusterWithFont(overlayEntry, overlayText);
        const glyphSet = getGlyphSet(0);
        for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);
        const textWidth = shaped.advance * primaryScale;
        const padX = Math.max(8, cellW * 0.6);
        const padY = Math.max(6, cellH * 0.4);
        const boxW = textWidth + padX * 2;
        const boxH = lineHeight + padY * 2;
        const boxX = (canvas.width - boxW) * 0.5;
        const boxY = (canvas.height - boxH) * 0.5;
        pushRectBox(overlayData, boxX, boxY, boxW, boxH, [0, 0, 0, 0.6 * alpha]);
        pushRectBox(overlayData, boxX, boxY, boxW, 1, [1, 1, 1, 0.12 * alpha]);
        const textRowY = boxY + (boxH - lineHeight) * 0.5;
        const baseY = textRowY + yPad + baselineOffset;
        getOverlayGlyphQueue(0).push({
          x: boxX + padX,
          baseY,
          xPad: 0,
          fg: [1, 1, 1, alpha],
          shaped,
          fontIndex: 0,
          scale: primaryScale,
          cellWidth: textWidth,
          symbolLike: false,
        });
      }
    }
  }

  for (const [fontIndex, neededSet] of neededGlyphIdsByFont.entries()) {
    const entry = fontState.fonts[fontIndex];
    if (!entry) continue;
    const atlasScale = bitmapScaleByFont[fontIndex] ?? 1;
    ensureAtlasForFont(device, state, entry, neededSet, fontSizePx, fontIndex, atlasScale);
  }

  const emitGlyphs = (queueByFont, targetMap) => {
    for (const [fontIndex, queue] of queueByFont.entries()) {
      const entry = fontState.fonts[fontIndex];
      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!entry || !entry.atlas || !atlasState) continue;
      const atlas = entry.atlas;
      const atlasW = atlas.bitmap.width;
      const atlasH = atlas.bitmap.rows;
      const uvInset = atlasState.inset || 0;
      const glyphData = getGlyphData(targetMap, fontIndex);
      for (const item of queue) {
        let penX = 0;
        const scale = item.scale ?? primaryScale;
        const maxWidth = item.cellWidth ?? cellW;
        const maxHeight = cellH;
        const symbolLike = item.symbolLike;
        let itemScale = scale;
        if (item.forceFit && item.glyphWidthPx && maxWidth > 0) {
          const fit = maxWidth / item.glyphWidthPx;
          if (fit > 0 && fit < 1) itemScale = scale * fit;
        }
        if (!symbolLike) {
          const advancePx = item.shaped.advance * scale;
          if (advancePx > maxWidth && advancePx > 0) {
            itemScale = scale * (maxWidth / advancePx);
          }
        }
        const scaleFactor = scale > 0 ? itemScale / scale : 1;
        for (const glyph of item.shaped.glyphs) {
          const metrics = atlas.glyphs.get(glyph.glyphId);
          if (!metrics) continue;
          let bitmapScale = scaleFactor;
          if (fontIndex > 0 && !symbolLike) {
            const widthScale = maxWidth > 0 ? maxWidth / metrics.width : 1;
            const heightScale = maxHeight > 0 ? maxHeight / metrics.height : 1;
            const clampScale = Math.min(1, widthScale, heightScale);
            bitmapScale *= clampScale;
          }
          const baselineAdjust = baselineAdjustByFont[fontIndex] ?? 0;
          let gw = metrics.width * bitmapScale;
          let gh = metrics.height * bitmapScale;
          const symbolFont = symbolLike && isSymbolFont(entry);
          if (symbolLike) {
            const fitScale =
              gw > 0 && gh > 0
                ? Math.min(1, maxWidth / gw, maxHeight / gh)
                : 1;
            if (fitScale < 1) {
              bitmapScale *= fitScale;
              gw *= fitScale;
              gh *= fitScale;
            }
            gw = Math.round(gw);
            gh = Math.round(gh);
          }
          let x =
            item.x +
            item.xPad +
            (penX + glyph.xOffset) * itemScale +
            metrics.bearingX * bitmapScale;
          if (
            fontIndex > 0 &&
            item.shaped.glyphs.length === 1 &&
            !symbolLike &&
            maxWidth <= cellW * 1.05
          ) {
            const center = item.x + (maxWidth - gw) * 0.5;
            x = center;
          }
          const minX = item.x;
          const maxX = item.x + maxWidth;
          if (x < minX) x = minX;
          if (x + gw > maxX) x = Math.max(minX, maxX - gw);

          let y =
            item.baseY +
            baselineAdjust -
            metrics.bearingY * bitmapScale -
            glyph.yOffset * itemScale;
          let constrained = false;
          if (symbolFont && item.cp) {
            const constraint = getNerdConstraint(item.cp);
            if (constraint) {
              const rowY = item.baseY - yPad - baselineOffset;
              const constraintWidth = Math.max(
                1,
                item.constraintWidth ?? Math.round(maxWidth / cellW),
              );
              const adjusted = constrainGlyphBox(
                {
                  x: x - item.x,
                  y: y - rowY,
                  width: gw,
                  height: gh,
                },
                constraint,
                nerdMetrics,
                constraintWidth,
              );
              x = item.x + adjusted.x;
              y = rowY + adjusted.y;
              gw = adjusted.width;
              gh = adjusted.height;
              constrained = true;
            }
          }
          if (!constrained && symbolFont && item.shaped.glyphs.length === 1) {
            x = item.x + (maxWidth - gw) * 0.5;
          }
          if (!constrained && symbolLike && !symbolFont) {
            const rowY = item.baseY - yPad - baselineOffset;
            y = rowY + (cellH - gh) * 0.5;
          }
          const px = Math.round(x);
          const py = Math.round(y);
          const insetX = Math.min(uvInset, (metrics.width - 1) * 0.5);
          const insetY = Math.min(uvInset, (metrics.height - 1) * 0.5);
          const u0 = (metrics.atlasX + insetX) / atlasW;
          const v0 = (metrics.atlasY + insetY) / atlasH;
          const u1 = (metrics.atlasX + metrics.width - insetX) / atlasW;
          const v1 = (metrics.atlasY + metrics.height - insetY) / atlasH;
          glyphData.push(
            px,
            py,
            gw,
            gh,
            u0,
            v0,
            u1,
            v1,
            item.fg[0],
            item.fg[1],
            item.fg[2],
            item.fg[3],
          );
          penX += glyph.xAdvance;
        }
      }
    }
  };

  emitGlyphs(glyphQueueByFont, glyphDataByFont);
  emitGlyphs(overlayGlyphQueueByFont, overlayGlyphDataByFont);

  if (cursor && cursor.visible) {
    const isBlinking = cursor.blinking || FORCE_CURSOR_BLINK;
    const blinkVisible =
      !isBlinking || Math.floor(performance.now() / CURSOR_BLINK_MS) % 2 === 0;
    if (blinkVisible) {
      let cursorCol = cursor.col;
      let cursorRow = cursor.row;
      if (wasmExports?.wterm_debug_cursor_x && wasmExports?.wterm_debug_cursor_y && wasmHandle) {
        const ax = wasmExports.wterm_debug_cursor_x(wasmHandle);
        const ay = wasmExports.wterm_debug_cursor_y(wasmHandle);
        if (Number.isFinite(ax) && Number.isFinite(ay)) {
          cursorCol = ax;
          cursorRow = ay;
        }
      }
      let cursorWidth = cellW;
      if (cursor.wideTail && cursorCol > 0) {
        cursorCol -= 1;
        cursorWidth = cellW * 2;
      }
      if (cursorRow < rows && cursorCol < cols) {
        const x = cursorCol * cellW;
        const y = cursorRow * cellH;
        const cursorColor = cursor.color ? decodePackedRGBA(cursor.color) : cursorFallback;
        updateImePosition({ row: cursorRow, col: cursorCol }, cellW, cellH);
        if (cursor.style === 1) {
          const width = Math.max(2, Math.floor(cellW * 0.15));
          pushRect(cursorData, x, y, width, cellH, cursorColor);
        } else if (cursor.style === 2) {
          const height = Math.max(2, Math.floor(cellH * 0.12));
          pushRect(cursorData, x, y + cellH - height, cursorWidth, height, cursorColor);
        } else if (cursor.style === 3) {
          const thickness = Math.max(1, Math.floor(cellH * 0.08));
          pushRect(cursorData, x, y, cursorWidth, thickness, cursorColor);
          pushRect(cursorData, x, y + cellH - thickness, cursorWidth, thickness, cursorColor);
          pushRect(cursorData, x, y, thickness, cellH, cursorColor);
          pushRect(cursorData, x + cursorWidth - thickness, y, thickness, cellH, cursorColor);
        } else {
          pushRect(cursorData, x, y, cursorWidth, cellH, cursorColor);
        }
      }
    }
  }

  if (wasmExports && wasmHandle && wasmExports.wterm_scrollbar_total) {
    const total = wasmExports.wterm_scrollbar_total(wasmHandle) || 0;
    const offset = wasmExports.wterm_scrollbar_offset
      ? wasmExports.wterm_scrollbar_offset(wasmHandle)
      : 0;
    const len = wasmExports.wterm_scrollbar_len
      ? wasmExports.wterm_scrollbar_len(wasmHandle)
      : rows;
    if (
      total !== scrollbarState.lastTotal ||
      offset !== scrollbarState.lastOffset ||
      len !== scrollbarState.lastLen
    ) {
      scrollbarState.lastTotal = total;
      scrollbarState.lastOffset = offset;
      scrollbarState.lastLen = len;
      noteScrollActivity();
    }
    if (total > len && len > 0) {
      const now = performance.now();
      const since = now - scrollbarState.lastInputAt;
      const fadeDelay = 600;
      const fadeDuration = 700;
      let alpha = 0;
      if (offset > 0) {
        alpha = 0.65;
      } else if (since < fadeDelay) {
        alpha = 0.5;
      } else if (since < fadeDelay + fadeDuration) {
        alpha = 0.5 * (1 - (since - fadeDelay) / fadeDuration);
      }
      if (alpha > 0.01) {
        const trackH = rows * cellH;
        const scrollbarWidth = Math.max(2, Math.round(cellW * 0.12));
        const margin = Math.max(2, Math.round(cellW * 0.2));
        const trackX = canvas.width - margin - scrollbarWidth;
        const trackY = 0;
        const denom = Math.max(1, total - len);
        const thumbH = Math.max(cellH * 1.5, Math.round(trackH * (len / total)));
        const thumbY = Math.round((offset / denom) * (trackH - thumbH));
        const thumbColor = [1, 1, 1, alpha * 0.35];
        const trackColor = [1, 1, 1, alpha * 0.08];
        pushRectBox(overlayData, trackX, trackY, scrollbarWidth, trackH, trackColor);
        pushRectBox(overlayData, trackX, thumbY, scrollbarWidth, thumbH, thumbColor);
      }
    }
  }

  const uniforms = new Float32Array([canvas.width, canvas.height, 0, 0]);
  device.queue.writeBuffer(state.uniformBuffer, 0, uniforms);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: defaultBg[0], g: defaultBg[1], b: defaultBg[2], a: defaultBg[3] },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  pass.setVertexBuffer(0, state.vertexBuffer);
  const drawRects = (data) => {
    if (!data.length) return;
    const rectArray = new Float32Array(data);
    ensureInstanceBuffer(state, "rect", rectArray.byteLength);
    device.queue.writeBuffer(state.rectInstanceBuffer, 0, rectArray);
    pass.setPipeline(state.rectPipeline);
    pass.setBindGroup(0, state.rectBindGroup);
    pass.setVertexBuffer(1, state.rectInstanceBuffer);
    pass.draw(6, data.length / 8, 0, 0);
  };

  drawRects(bgData);
  drawRects(selectionData);
  drawRects(underlineData);
  drawRects(fgRectData);

  for (const [fontIndex, glyphData] of glyphDataByFont.entries()) {
    if (!glyphData.length) continue;
    const atlasState = state.glyphAtlases?.get(fontIndex);
    if (!atlasState) continue;
    const glyphArray = new Float32Array(glyphData);
    ensureInstanceBuffer(state, "glyph", glyphArray.byteLength);
    device.queue.writeBuffer(state.glyphInstanceBuffer, 0, glyphArray);
    pass.setPipeline(state.glyphPipeline);
    pass.setBindGroup(0, atlasState.bindGroup);
    pass.setVertexBuffer(1, state.glyphInstanceBuffer);
    pass.draw(6, glyphData.length / 12, 0, 0);
  }

  drawRects(cursorData);
  drawRects(overlayData);

  for (const [fontIndex, glyphData] of overlayGlyphDataByFont.entries()) {
    if (!glyphData.length) continue;
    const atlasState = state.glyphAtlases?.get(fontIndex);
    if (!atlasState) continue;
    const glyphArray = new Float32Array(glyphData);
    ensureInstanceBuffer(state, "glyph", glyphArray.byteLength);
    device.queue.writeBuffer(state.glyphInstanceBuffer, 0, glyphArray);
    pass.setPipeline(state.glyphPipeline);
    pass.setBindGroup(0, atlasState.bindGroup);
    pass.setVertexBuffer(1, state.glyphInstanceBuffer);
    pass.draw(6, glyphData.length / 12, 0, 0);
  }

  pass.end();
  device.queue.submit([encoder.finish()]);
}

function tickWebGL(state: WebGLState) {
  const { gl } = state;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(defaultBg[0], defaultBg[1], defaultBg[2], defaultBg[3]);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (fontError) {
    if (termDebug) termDebug.textContent = `Font error: ${fontError.message}`;
  }

  updateGrid();

  const render = getRenderState();
  if (!render || !fontState.font) return;

  lastRenderState = render;

  const {
    rows,
    cols,
    cellCount,
    codepoints,
    wide,
    fgBytes,
    bgBytes,
    ulBytes,
    ulStyle,
    graphemeOffset,
    graphemeLen,
    graphemeBuffer,
    selectionStart,
    selectionEnd,
    cursor,
  } = render;

  if (!codepoints || !fgBytes) return;

  if (termSizeEl) termSizeEl.textContent = `${cols}x${rows}`;
  if (cursorPosEl && cursor) {
    cursorPosEl.textContent = `${cursor.col},${cursor.row}`;
    lastCursorForCpr = { row: cursor.row + 1, col: cursor.col + 1 };
  }

  const cellW = gridState.cellW || canvas.width / cols;
  const cellH = gridState.cellH || canvas.height / rows;
  const fontSizePx = gridState.fontSizePx || Math.max(1, Math.round(cellH));
  const primaryEntry = fontState.fonts[0];
  const primaryScale =
    gridState.scale || fontState.font.scaleForSize(fontSizePx, fontState.sizeMode);
  const lineHeight = gridState.lineHeight || fontHeightUnits(fontState.font) * primaryScale;
  const baselineOffset = gridState.baselineOffset || fontState.font.ascender * primaryScale;
  const yPad = gridState.yPad ?? (cellH - lineHeight) / 2;
  const post = fontState.font.post;
  const underlinePosition = post?.underlinePosition ?? Math.round(-fontState.font.upem * 0.08);
  const underlineThickness = post?.underlineThickness ?? Math.round(fontState.font.upem * 0.05);
  const underlineOffsetPx = underlinePosition * primaryScale;
  const underlineThicknessPx = Math.max(1, Math.round(underlineThickness * primaryScale));

  const bgData: number[] = [];
  const selectionData: number[] = [];
  const underlineData: number[] = [];
  const cursorData: number[] = [];
  const fgRectData: number[] = [];
  const overlayData: number[] = [];
  const glyphDataByFont = new Map<number, number[]>();
  const glyphQueueByFont = new Map<number, any[]>();
  const neededGlyphIdsByFont = new Map<number, Set<number>>();

  const baseScaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font) return primaryScale;
    if (idx === 0) return primaryScale;
    return entry.font.scaleForSize(fontSizePx, fontState.sizeMode) * fontScaleOverride(entry);
  });

  const scaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font) return primaryScale;
    if (idx === 0) return primaryScale;
    const baseScale = baseScaleByFont[idx] ?? primaryScale;
    const baseHeightPx = fontHeightUnits(entry.font) * baseScale;
    const targetHeightPx = lineHeight;
    const heightAdjust = baseHeightPx > 0 ? Math.min(1, targetHeightPx / baseHeightPx) : 1;
    const advanceUnits = fontAdvanceUnits(entry);
    const maxSpan = fontMaxCellSpan(entry);
    const widthPx = advanceUnits * baseScale;
    const widthAdjust = widthPx > 0 ? Math.min(1, (cellW * maxSpan) / widthPx) : 1;
    return baseScale * Math.min(heightAdjust, widthAdjust);
  });

  const bitmapScaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font || idx === 0) return 1;
    const baseScale = baseScaleByFont[idx] ?? 0;
    if (baseScale <= 0) return 1;
    const targetScale = scaleByFont[idx] ?? baseScale;
    return Math.min(1, targetScale / baseScale);
  });

  const baselineAdjustByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font || idx === 0 || !primaryEntry?.font) return 0;
    const scale = scaleByFont[idx] ?? primaryScale;
    return primaryEntry.font.ascender * primaryScale - entry.font.ascender * scale;
  });

  const nerdMetrics = {
    cellWidth: cellW,
    cellHeight: cellH,
    faceWidth: cellW,
    faceHeight: lineHeight,
    faceY: Math.max(0, (cellH - lineHeight) * 0.5),
    iconHeight: lineHeight,
    iconHeightSingle: lineHeight * 0.8,
  };

  const getGlyphQueue = (fontIndex: number) => {
    if (!glyphQueueByFont.has(fontIndex)) glyphQueueByFont.set(fontIndex, []);
    return glyphQueueByFont.get(fontIndex)!;
  };
  const getGlyphSet = (fontIndex: number) => {
    if (!neededGlyphIdsByFont.has(fontIndex)) neededGlyphIdsByFont.set(fontIndex, new Set());
    return neededGlyphIdsByFont.get(fontIndex)!;
  };
  const getGlyphData = (map: Map<number, number[]>, fontIndex: number) => {
    if (!map.has(fontIndex)) map.set(fontIndex, []);
    return map.get(fontIndex)!;
  };

  for (let row = 0; row < rows; row += 1) {
    const rowY = row * cellH;
    const baseY = rowY + yPad + baselineOffset;
    let selStart = selectionStart ? selectionStart[row] : -1;
    let selEnd = selectionEnd ? selectionEnd[row] : -1;
    const localSel = selectionForRow(row, cols);
    if (localSel) {
      selStart = localSel.start;
      selEnd = localSel.end;
    }
    if (selStart >= 0 && selEnd > selStart) {
      const start = Math.max(0, selStart);
      const end = Math.min(cols, selEnd);
      pushRect(selectionData, start * cellW, rowY, (end - start) * cellW, cellH, selectionColor);
    }

    for (let col = 0; col < cols; col += 1) {
      const idx = row * cols + col;
      const x = col * cellW;

      if (bgBytes) {
        const bg = decodeRGBA(bgBytes, idx);
        if (bg[3] > 0) pushRect(bgData, x, rowY, cellW, cellH, bg);
      }

      if (ulStyle && ulBytes && ulStyle[idx] > 0) {
        const ul = decodeRGBA(ulBytes, idx);
        if (ul[3] > 0) {
          const style = ulStyle[idx];
          const thickness = underlineThicknessPx;
          const underlineY = clamp(baseY + underlineOffsetPx, rowY + 1, rowY + cellH - thickness - 1);
          pushRect(underlineData, x, underlineY, cellW, thickness, ul);
          if (style === 2) {
            const gap = Math.max(1, Math.round(thickness * 0.6));
            pushRect(underlineData, x, underlineY + thickness + gap, cellW, thickness, ul);
          }
        }
      }

      const wideFlag = wide ? wide[idx] : 0;
      if (wideFlag === 2 || wideFlag === 3) continue;

      const cp = codepoints[idx];
      if (!cp) continue;

      let text = String.fromCodePoint(cp);
      if (graphemeLen && graphemeOffset && graphemeBuffer) {
        const extra = graphemeLen[idx] ?? 0;
        if (extra > 0) {
          const start = graphemeOffset[idx] ?? 0;
          const cps = [cp];
          for (let j = 0; j < extra; j += 1) {
            const extraCp = graphemeBuffer[start + j];
            if (extraCp) cps.push(extraCp);
          }
          text = String.fromCodePoint(...cps);
        }
      }

      const fg = decodeRGBA(fgBytes, idx);

      if (isBlockElement(cp)) {
        if (drawBlockElement(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }
      if (isBoxDrawing(cp)) {
        if (drawBoxDrawing(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }
      if (isBraille(cp)) {
        if (drawBraille(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }
      if (isPowerline(cp)) {
        if (drawPowerline(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }

      if (text.trim() === "") continue;

      const baseSpan = wideFlag === 1 ? 2 : 1;
      const fontIndex = pickFontIndexForText(text, baseSpan);
      const fontEntry = fontState.fonts[fontIndex] ?? fontState.fonts[0];
      const shaped = shapeClusterWithFont(fontEntry, text);
      if (!shaped.glyphs.length) continue;
      const glyphSet = getGlyphSet(fontIndex);
      for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);

      const fontScale = scaleByFont[fontIndex] ?? primaryScale;
      let cellSpan = baseSpan;
      const symbolLike = isSymbolCp(cp);
      let constraintWidth = baseSpan;
      let forceFit = false;
      let glyphWidthPx = 0;
      if (symbolLike) {
        if (baseSpan === 1) {
          if (col === cols - 1) {
            constraintWidth = 1;
          } else if (col > 0) {
            const prevCp = codepoints[idx - 1];
            if (isSymbolCp(prevCp) && !isGraphicsElement(prevCp)) {
              constraintWidth = 1;
            }
          }
          if (constraintWidth === 1) {
            const nextCp = codepoints[idx + 1];
            if (isSpaceCp(nextCp)) constraintWidth = 2;
          }
          cellSpan = constraintWidth;
        }
        if (shaped.glyphs.length === 1) {
          const glyphId = shaped.glyphs[0].glyphId;
          const widthUnits = glyphWidthUnits(fontEntry, glyphId);
          if (widthUnits > 0) {
            glyphWidthPx = widthUnits * fontScale;
          }
        }
        if (!glyphWidthPx) {
          glyphWidthPx = shaped.advance * fontScale;
        }
        if (glyphWidthPx > cellW * cellSpan * 1.05) {
          forceFit = true;
        }
      }
      const cellWidthPx = cellW * cellSpan;
      const xPad = 0;

      getGlyphQueue(fontIndex).push({
        x,
        baseY,
        xPad,
        fg,
        shaped,
        fontIndex,
        scale: fontScale,
        cellWidth: cellWidthPx,
        symbolLike,
        constraintWidth,
        forceFit,
        glyphWidthPx,
        cp,
      });
    }
  }

  // Cursor
  if (cursor && cursor.visible) {
    const { col, row, shape: cursorShape, color: cursorColor } = cursor;
    const isBlinking = cursor.blinking || FORCE_CURSOR_BLINK;
    const blinkVisible = !isBlinking || Math.floor(performance.now() / CURSOR_BLINK_MS) % 2 === 0;
    if (blinkVisible) {
      const cx = col * cellW;
      const cy = row * cellH;
      const cc = cursorColor ? decodeRGBA(cursorColor, 0) : cursorFallback;
      if (cursorShape === 0 || cursorShape === 1) {
        pushRect(cursorData, cx, cy, cellW, cellH, cc);
      } else if (cursorShape === 2) {
        const barWidth = Math.max(1, Math.round(cellW * 0.1));
        pushRect(cursorData, cx, cy, barWidth, cellH, cc);
      } else if (cursorShape === 3) {
        const ulHeight = Math.max(1, Math.round(cellH * 0.1));
        pushRect(cursorData, cx, cy + cellH - ulHeight, cellW, ulHeight, cc);
      }
    }
  }

  // Update glyph atlases for WebGL
  for (const [fontIndex, neededIds] of neededGlyphIdsByFont.entries()) {
    const fontEntry = fontState.fonts[fontIndex];
    if (!fontEntry?.font) continue;
    let atlasState = state.glyphAtlases.get(fontIndex);

    // Use bitmap scale for symbol fonts (matches WebGPU)
    const bitmapScale = bitmapScaleByFont[fontIndex] ?? 1;
    const scaleOverride = fontScaleOverride(fontEntry);
    const effectiveFontSizePx = Math.max(1, Math.round(fontSizePx * bitmapScale * scaleOverride));

    let needsRebuild = !atlasState || !fontEntry.atlas || fontEntry.fontSizePx !== effectiveFontSizePx || fontEntry.atlasScale !== bitmapScale;
    if (!needsRebuild) {
      for (const glyphId of neededIds) {
        if (!fontEntry.glyphIds.has(glyphId)) {
          needsRebuild = true;
          break;
        }
      }
    }

    if (needsRebuild) {
      const union = new Set(fontEntry.glyphIds);
      for (const glyphId of neededIds) union.add(glyphId);
      if (union.size === 0) continue;

      const useHinting = fontIndex === 0 && !isSymbolFont(fontEntry);
      const isSymbol = isSymbolFont(fontEntry);
      const atlasPadding = isSymbol ? Math.max(ATLAS_PADDING, SYMBOL_ATLAS_PADDING) : ATLAS_PADDING;
      const atlasMaxSize = isSymbol ? SYMBOL_ATLAS_MAX_SIZE : 2048;

      const atlas = buildAtlas(fontEntry.font, [...union], {
        fontSize: effectiveFontSizePx,
        sizeMode: fontState.sizeMode,
        padding: atlasPadding,
        pixelMode: PixelMode.Gray,
        hinting: useHinting,
        maxWidth: atlasMaxSize,
        maxHeight: atlasMaxSize,
      });
      if (!atlas || !atlas.bitmap?.width || !atlas.bitmap?.rows) continue;

      const rgba = atlasToRGBA(atlas);
      if (!rgba) continue;

      if (atlasState) {
        gl.deleteTexture(atlasState.texture);
      }

      const texture = gl.createTexture();
      if (!texture) continue;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, atlas.bitmap.width, atlas.bitmap.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
      const preferNearest = fontIndex === 0 || isSymbol;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, preferNearest ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, preferNearest ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      atlasState = {
        texture,
        width: atlas.bitmap.width,
        height: atlas.bitmap.rows,
        inset: atlas.inset,
      };
      state.glyphAtlases.set(fontIndex, atlasState);

      fontEntry.atlas = atlas;
      fontEntry.glyphIds = union;
      fontEntry.fontSizePx = effectiveFontSizePx;
      fontEntry.atlasScale = bitmapScale;
    }
  }

  // Build glyph instance data
  for (const [fontIndex, queue] of glyphQueueByFont.entries()) {
    const fontEntry = fontState.fonts[fontIndex];
    if (!fontEntry?.font || !fontEntry.atlas) continue;
    const atlasState = state.glyphAtlases.get(fontIndex);
    if (!atlasState) continue;
    const { atlas } = fontEntry;
    const atlasW = atlasState.width;
    const atlasH = atlasState.height;
    const uvInset = atlasState.inset || 0;
    const glyphData = getGlyphData(glyphDataByFont, fontIndex);
    const baselineAdjust = baselineAdjustByFont[fontIndex] ?? 0;

    const symbolFont = isSymbolFont(fontEntry);

    for (const item of queue) {
      const { x, baseY, xPad, fg, shaped, scale, cellWidth, symbolLike, constraintWidth, forceFit, glyphWidthPx, cp } = item;

      // Get nerd font constraint if this is a symbol font rendering a symbol-like codepoint
      let constraint: NerdConstraint | null = null;
      if (symbolFont && symbolLike && cp) {
        constraint = getNerdConstraint(cp);
      }

      // Atlas is built at pixel size, so use atlasScale (1) not font scale
      const renderScale = fontEntry.atlasScale ?? 1;

      for (const glyph of shaped.glyphs) {
        const { glyphId, xOffset, yOffset, xAdvance } = glyph;
        const entry = atlas.glyphs.get(glyphId);
        if (!entry) continue;

        // Compute initial glyph dimensions using atlasScale (glyphs are already at pixel size)
        let gx = x + xPad + (entry.bearingX + xOffset) * renderScale;
        let gy = baseY + baselineAdjust - (entry.bearingY + yOffset) * renderScale;
        let gw = entry.width * renderScale;
        let gh = entry.height * renderScale;

        // Apply nerd font constraint if present
        let constrained = false;
        if (constraint) {
          const rowY = baseY - yPad - baselineOffset;
          const adjusted = constrainGlyphBox(
            { x: gx - x, y: gy - rowY, width: gw, height: gh },
            constraint,
            nerdMetrics,
            constraintWidth,
          );
          gx = x + adjusted.x;
          gy = rowY + adjusted.y;
          gw = adjusted.width;
          gh = adjusted.height;
          constrained = true;
        }

        // Center single-glyph symbols horizontally if not constrained
        if (!constrained && symbolFont && shaped.glyphs.length === 1) {
          gx = x + xPad + (cellWidth - gw) * 0.5;
        }

        // Center symbol-like glyphs from non-symbol fonts vertically
        if (!constrained && symbolLike && !symbolFont) {
          const rowY = baseY - yPad - baselineOffset;
          gy = rowY + (cellH - gh) * 0.5;
        }

        // Round pixel positions for sharper rendering
        const px = Math.round(gx);
        const py = Math.round(gy);

        // Apply UV inset for proper texture sampling (matches WebGPU)
        const insetX = Math.min(uvInset, (entry.width - 1) * 0.5);
        const insetY = Math.min(uvInset, (entry.height - 1) * 0.5);
        const u0 = (entry.atlasX + insetX) / atlasW;
        const v0 = (entry.atlasY + insetY) / atlasH;
        const u1 = (entry.atlasX + entry.width - insetX) / atlasW;
        const v1 = (entry.atlasY + entry.height - insetY) / atlasH;

        glyphData.push(px, py, gw, gh, u0, v0, u1, v1, fg[0], fg[1], fg[2], fg[3]);
      }
    }
  }

  // Draw helper for rects
  const drawRects = (data: number[]) => {
    if (!data.length) return;
    const rectArray = new Float32Array(data);
    ensureGLInstanceBuffer(state, "rect", rectArray.byteLength);
    gl.bindVertexArray(state.rectVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.rectInstanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, rectArray);
    gl.useProgram(state.rectProgram);
    gl.uniform2f(state.rectResolutionLoc, canvas.width, canvas.height);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.length / 8);
    gl.bindVertexArray(null);
  };

  // Draw helper for glyphs
  const drawGlyphs = (fontIndex: number, data: number[]) => {
    if (!data.length) return;
    const atlasState = state.glyphAtlases.get(fontIndex);
    if (!atlasState) return;
    const glyphArray = new Float32Array(data);
    ensureGLInstanceBuffer(state, "glyph", glyphArray.byteLength);
    gl.bindVertexArray(state.glyphVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.glyphInstanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, glyphArray);
    gl.useProgram(state.glyphProgram);
    gl.uniform2f(state.glyphResolutionLoc, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasState.texture);
    gl.uniform1i(state.glyphAtlasLoc, 0);
    // Use premultiplied alpha blend mode (shader outputs premultiplied colors)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.length / 12);
    // Restore standard blend mode for rects
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(null);
  };

  drawRects(bgData);
  drawRects(selectionData);
  drawRects(underlineData);
  drawRects(fgRectData);

  for (const [fontIndex, glyphData] of glyphDataByFont.entries()) {
    drawGlyphs(fontIndex, glyphData);
  }

  drawRects(cursorData);
  drawRects(overlayData);
}

function updateFps() {
  frameCount += 1;
  const now = performance.now();
  if (now - lastFpsTime >= 500) {
    const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
    fpsEl.textContent = `${fps}`;
    frameCount = 0;
    lastFpsTime = now;
  }
}

function loop(state) {
  if (!paused) {
    const now = performance.now();
    if (now >= nextBlinkTime) {
      nextBlinkTime = now + CURSOR_BLINK_MS;
      needsRender = true;
    }
    const renderBudget = now - lastRenderTime >= 1000 / 30;
    if (needsRender && renderBudget) {
      if (backend === "webgpu") tickWebGPU(state);
      if (backend === "webgl2") tickWebGL(state);
      lastRenderTime = now;
      needsRender = false;
    }
    updateFps();
  }
  rafId = requestAnimationFrame(() => loop(state));
}

async function initWasm() {
  if (wasmReady && wasm) return wasm;
  const instance = await loadWtermWasm({
    log: (text) => {
      if (shouldSuppressWasmLog(text)) return;
      console.log(`[wasm] ${text}`);
      appendLog(`[wasm] ${text}`);
    },
  });
  wasm = instance;
  wasmExports = instance.exports;
  wasmReady = true;
  return instance;
}

function writeToWasm(handle, text) {
  if (!wasm) return;
  wasm.write(handle, text);
}

function normalizeNewlines(text) {
  return text.replace(/\r?\n/g, "\r\n");
}

function sendInput(text, source = "program") {
  if (!wasmReady || !wasm || !wasmHandle) return;
  if (!text) return;
  const normalized = normalizeNewlines(text);
  if (source === "key" && inputDebugEl) {
    const bytes = textEncoder.encode(normalized);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
    inputDebugEl.textContent = `${hex} (${bytes.length})`;
  }
  if (source === "key") {
    let before = "";
    if (wasmExports?.wterm_debug_cursor_x && wasmExports?.wterm_debug_cursor_y) {
      const bx = wasmExports.wterm_debug_cursor_x(wasmHandle);
      const by = wasmExports.wterm_debug_cursor_y(wasmHandle);
      before = ` cursor=${bx},${by}`;
    }
    appendLog(`[key] ${JSON.stringify(normalized)}${before}`);
  }
  if (source === "key" && selectionState.active) {
    clearSelection();
  }
  writeToWasm(wasmHandle, normalized);
  wasm.renderUpdate(wasmHandle);
  if (source === "key" && wasmExports?.wterm_debug_cursor_x && wasmExports?.wterm_debug_cursor_y) {
    const ax = wasmExports.wterm_debug_cursor_x(wasmHandle);
    const ay = wasmExports.wterm_debug_cursor_y(wasmHandle);
    appendLog(`[key] after cursor=${ax},${ay}`);
  }
  lastWasmUpdate = performance.now();
  needsRender = true;
}

async function copySelectionToClipboard() {
  const text = getSelectionText();
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    appendLog("[ui] selection copied");
    return true;
  } catch (err) {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand("copy");
      appendLog("[ui] selection copied (fallback)");
      return true;
    } catch (copyErr) {
      appendLog(`[ui] copy failed: ${copyErr?.message ?? copyErr}`);
    } finally {
      document.body.removeChild(temp);
    }
  }
  return false;
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      sendKeyInput(text);
      return true;
    }
  } catch (err) {
    appendLog(`[ui] paste failed: ${err?.message ?? err}`);
  }
  return false;
}

function clearScreen() {
  sendInput("\x1b[2J\x1b[H");
}

function joinLines(lines) {
  return lines.join("\r\n");
}

function demoBasic() {
  const lines = [
    "wterm demo: basics",
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
    "     │  mono renderer   │",
    "     └────────────────────┘",
    "",
  ];
  return `\x1b[2J\x1b[H${joinLines(lines)}`;
}

function demoPalette() {
  const lines = ["wterm demo: palette", ""];
  const blocks = [];
  for (let i = 0; i < 16; i += 1) {
    blocks.push(`\x1b[48;5;${i}m  \x1b[0m`);
  }
  lines.push(`Base 16: ${blocks.join(" ")}`);

  lines.push("");
  for (let row = 0; row < 6; row += 1) {
    const rowBlocks = [];
    for (let col = 0; col < 12; col += 1) {
      const idx = 16 + row * 12 + col;
      rowBlocks.push(`\x1b[48;5;${idx}m  \x1b[0m`);
    }
    lines.push(rowBlocks.join(""));
  }

  lines.push("");
  const gray = [];
  for (let i = 232; i <= 255; i += 1) {
    gray.push(`\x1b[48;5;${i}m \x1b[0m`);
  }
  lines.push(`Grayscale: ${gray.join("")}`);
  lines.push("");
  return `\x1b[2J\x1b[H${joinLines(lines)}`;
}

function demoUnicode() {
  const lines = [
    "wterm demo: unicode",
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

function stopDemo() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = 0;
  }
}

function startAnimationDemo() {
  stopDemo();
  clearScreen();
  const start = performance.now();
  let tick = 0;
  demoTimer = window.setInterval(() => {
    const now = performance.now();
    const elapsed = (now - start) / 1000;
    const spinner = ["|", "/", "-", "\\"][tick % 4];
    const cols = gridState.cols || 80;
    const barWidth = Math.max(10, Math.min(60, cols - 20));
    const phase = (Math.sin(elapsed * 1.6) + 1) * 0.5;
    const fill = Math.floor(barWidth * phase);
    const bar = "█".repeat(fill) + " ".repeat(Math.max(0, barWidth - fill));

    const lines = [
      `wterm demo: animation ${spinner}`,
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
    sendInput(`\x1b[H\x1b[J${joinLines(lines)}`);
    tick += 1;
  }, 80);
}

function runDemo(kind) {
  stopDemo();
  switch (kind) {
    case "palette":
      sendInput(demoPalette());
      break;
    case "unicode":
      sendInput(demoUnicode());
      break;
    case "anim":
      startAnimationDemo();
      break;
    case "basic":
    default:
      sendInput(demoBasic());
      break;
  }
}

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (
    target &&
    target !== imeInput &&
    ["BUTTON", "SELECT", "INPUT", "TEXTAREA"].includes(target.tagName)
  ) {
    return;
  }
  if (target === imeInput) {
    if (imeState.composing || event.isComposing) return;
    if (!event.ctrlKey && !event.metaKey && event.key.length === 1) return;
    if (["Backspace", "Enter"].includes(event.key)) return;
  }
  if (!wasmReady || !wasmHandle) return;

  const key = event.key?.toLowerCase?.() ?? "";
  const wantsCopy =
    (event.metaKey || event.ctrlKey) && !event.altKey && (key === "c" || (event.shiftKey && key === "c"));
  const wantsPaste =
    (event.metaKey || event.ctrlKey) && !event.altKey && (key === "v" || (event.shiftKey && key === "v"));

  if (wantsCopy && selectionState.active) {
    event.preventDefault();
    copySelectionToClipboard();
    return;
  }
  if (wantsPaste) {
    event.preventDefault();
    pasteFromClipboard();
    return;
  }

  const seq = inputHandler.encodeKeyEvent(event);
  if (seq) {
    event.preventDefault();
    sendKeyInput(seq);
  }
});

async function initWasmHarness() {
  try {
    const instance = await initWasm();
    if (wasmHandle) {
      instance.destroy(wasmHandle);
      wasmHandle = 0;
    }
    updateGrid();
    const cols = gridState.cols || 80;
    const rows = gridState.rows || 24;
    const maxScrollback = 2000;
    wasmHandle = instance.create(cols, rows, maxScrollback);
    if (!wasmHandle) {
      throw new Error("wterm_create returned 0");
    }
    if (activeTheme) {
      applyTheme(activeTheme, activeTheme.name ?? "cached theme");
    }
    const sample = [
      "wterm wasm online",
      "WebGPU/WebGL harness still running.",
      "Sample output:",
      "> The quick brown fox jumps over the lazy dog.",
      "> 1234567890 !@#$%^&*()",
      "",
    ].join("\r\n");
    writeToWasm(wasmHandle, sample);
    instance.renderUpdate(wasmHandle);
    lastWasmUpdate = performance.now();
    needsRender = true;
  } catch (err) {
    console.error(`wterm error: ${err.message}`);
  }
}

async function init() {
  cancelAnimationFrame(rafId);
  updateSize();

  log("initializing...");
  loadThemeManifest();
  await ensureFont();
  updateGrid();
  const wasmPromise = initWasmHarness();

  // Try WebGPU first (unless WebGL2 is explicitly preferred)
  if (preferredRenderer !== "webgl2") {
    if (currentContextType === "webgl2") {
      replaceCanvas();
    }
    const gpuState = await initWebGPU(canvas);
    if (gpuState) {
      backend = "webgpu";
      currentContextType = "webgpu";
      if (backendEl) backendEl.textContent = "webgpu";
      log("webgpu ready");
      activeState = gpuState;
      // Force full size/grid sync after context creation
      updateSize(true);
      console.log(`[init webgpu] canvas=${canvas.width}x${canvas.height} grid=${gridState.cols}x${gridState.rows}`);
      loop(gpuState);
      await wasmPromise;
      return;
    }
  }

  // Try WebGL2 (unless WebGPU is explicitly required)
  if (preferredRenderer !== "webgpu") {
    if (currentContextType === "webgpu") {
      replaceCanvas();
    }
    const glState = initWebGL(canvas);
    if (glState) {
      backend = "webgl2";
      currentContextType = "webgl2";
      if (backendEl) backendEl.textContent = "webgl2";
      log("webgl2 ready");
      activeState = glState;
      // Force full size/grid sync after context creation
      updateSize(true);
      console.log(`[init webgl2] canvas=${canvas.width}x${canvas.height} grid=${gridState.cols}x${gridState.rows}`);
      loop(glState);
      await wasmPromise;
      return;
    }
  }

  backend = "none";
  if (backendEl) backendEl.textContent = "none";
  log("no GPU backend available");
  activeState = null;
  await wasmPromise;
}

btnInit?.addEventListener("click", () => {
  paused = false;
  stopDemo();
  init();
});

btnPause?.addEventListener("click", () => {
  paused = !paused;
  if (btnPause) btnPause.textContent = paused ? "Resume" : "Pause";
});

btnClear?.addEventListener("click", () => {
  stopDemo();
  clearScreen();
});

btnRunDemo?.addEventListener("click", () => {
  runDemo(demoSelect?.value ?? "basic");
});

ptyBtn?.addEventListener("click", () => {
  if (ptyConnected) {
    disconnectPty();
  } else {
    connectPty();
  }
});

rendererSelect?.addEventListener("change", () => {
  const value = rendererSelect.value;
  if (value === "auto" || value === "webgpu" || value === "webgl2") {
    preferredRenderer = value;
    init();
  }
});

if (themeFileInput) {
  themeFileInput.addEventListener("change", () => {
    const file = themeFileInput?.files?.[0];
    handleThemeFile(file);
  });
}

async function loadThemeByName(name, sourceLabel = name) {
  try {
    const url = assetUrl(`./public/themes/${encodeURIComponent(name)}`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`theme ${resp.status}`);
    const text = await resp.text();
    const theme = parseGhosttyTheme(text);
    applyTheme(theme, sourceLabel);
    return true;
  } catch (err) {
    appendLog(`[ui] theme load failed: ${err?.message ?? err}`);
    return false;
  }
}

if (themeSelect) {
  themeSelect.addEventListener("change", async () => {
    const name = themeSelect.value;
    if (!name) {
      resetTheme();
      return;
    }
    await loadThemeByName(name);
  });
}

if (mouseModeEl) {
  mouseModeEl.addEventListener("change", () => {
    const value = mouseModeEl.value;
    inputHandler.setMouseMode(value);
    updateMouseStatus();
  });
}

if (fontSizeInput) {
  fontSizeInput.addEventListener("change", () => {
    const value = Number(fontSizeInput.value);
    applyFontSize(value);
  });
  fontSizeInput.addEventListener("input", () => {
    const value = Number(fontSizeInput.value);
    if (Number.isFinite(value)) applyFontSize(value);
  });
}

if (btnCopyLog) {
  btnCopyLog.addEventListener("click", async () => {
    const text = logDumpEl ? logDumpEl.value : "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      appendLog("[ui] logs copied");
    } catch (err) {
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
    dumpAtlasForCodepoint(cp);
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
    dumpAtlasForCodepoint(cp);
  });
}

loadThemeManifest();

init();
setPtyStatus("disconnected");
if (mouseModeEl) mouseModeEl.value = inputHandler.getMouseStatus().mode;
if (fontSizeInput) fontSizeInput.value = `${fontConfig.sizePx}`;
updateMouseStatus();

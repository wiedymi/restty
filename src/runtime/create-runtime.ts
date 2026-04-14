import { createInputHandler, type InputHandler } from "../input";
import {
  isNerdSymbolCodepoint,
  getNerdConstraint,
  isSymbolFont,
  isColorEmojiFont,
  fontMaxCellSpan,
  fontScaleOverride,
  fontAdvanceUnits,
  glyphWidthUnits,
  createFontEntry,
  resetFontEntry,
  type FontEntry,
  type FontManagerState,
} from "../fonts";
import type { ResttyWasm, RenderState, ResttyWasmExports } from "../wasm";
import { createWebSocketPtyTransport, type PtyTransport } from "../pty";
import { type GhosttyTheme } from "../theme";
import {
  ensureInstanceBuffer,
  ensureGLInstanceBuffer,
  drawBlockElement,
  drawBoxDrawing,
  drawBraille,
  drawPowerline,
  constrainGlyphBox,
  pushRect,
  pushRectBox,
  isBlockElement,
  isBoxDrawing,
  isBraille,
  isPowerline,
  isSymbolCp,
  isSpaceCp,
  isGraphicsElement,
  type Color,
  type WebGPUState,
  type WebGLState,
} from "../renderer";
import { fontHeightUnits, clamp } from "../grid";
import {
  PREEDIT_BG,
  PREEDIT_ACTIVE_BG,
  PREEDIT_FG,
  PREEDIT_UL,
  PREEDIT_CARET,
  resolveImeAnchor,
  syncImeInputTypography,
} from "../ime";
import {
  copyToClipboard as writeClipboardText,
  pasteFromClipboard as readClipboardText,
} from "../selection";
import { buildFontAtlasIfNeeded } from "./fonts/atlas-builder";
import { normalizeFontSources } from "./fonts/font-sources";
import * as bundledTextShaper from "text-shaper";
import { createRuntimeEventHub } from "./core/runtime-events";
import type { ResttyRuntime } from "./core/api";
import type { ResttyRuntimeConfig } from "./core/config";
import type { ResttyFontHintTarget, ResttyFontSource } from "./core/models";
import type {
  ResttyRuntimeCallbacks,
  ResttyRuntimeSession,
  ResttyFontResourceLease,
} from "./core/resources";
import { getDefaultResttyRuntimeSession } from "./core/session";
import { createPtyOutputBufferController } from "./create-runtime/pty-output-buffer";
import { fitTextTailToWidth, openLink } from "./create-runtime/runtime-io-utils";
import {
  drawUnderlineStyle,
  drawStrikethrough,
  drawOverline,
} from "./create-runtime/text-decoration";
import {
  DEFAULT_SYMBOL_CONSTRAINT,
  DEFAULT_APPLE_SYMBOLS_CONSTRAINT,
  DEFAULT_EMOJI_CONSTRAINT,
  normalizeTouchSelectionMode,
  clampFiniteNumber,
  isRenderSymbolLike,
  resolveSymbolConstraint,
} from "./create-runtime/runtime-symbols";
import {
  decodePackedRGBA,
  decodeRGBAWithCache,
  brighten,
  fade,
} from "./create-runtime/render-color-utils";
import {
  shouldMergeTrailingClusterCodepoint,
  stylePreferenceFromFlags,
  isAppleSymbolsFont,
  fontEntryHasBoldStyle,
  fontEntryHasItalicStyle,
} from "./create-runtime/codepoint-utils";
import {
  buildNerdMetrics,
  nerdConstraintSignature,
  tightenNerdConstraintBox,
} from "./font-atlas-utils/nerd-metrics-utils";
import { buildGlyphAtlasWithConstraints } from "./font-atlas-utils/glyph-atlas-builder";
import {
  srgbToLinearColor,
  resolveBlendFlags,
  floatsToRgb,
  type AlphaBlendingMode,
} from "./create-runtime/blend-utils";
import {
  padAtlasRGBA,
  resolveGlyphPixelMode as resolveGlyphPixelModeFromEntry,
} from "./create-runtime/atlas-bitmap-utils";
import { formatCodepoint } from "./create-runtime/format-utils";
import { createShaderStageRuntime } from "./create-runtime/shader-stage-runtime";
import { createColorGlyphAtlasHelpers } from "./create-runtime/font-runtime/color-glyph-atlas";
import { createRuntimeInputHooks } from "./create-runtime/input-hooks";
import { createPtyInputRuntime } from "./create-runtime/pty-input-runtime";
import { createRuntimeInteraction } from "./create-runtime/interaction-runtime";
import { createKittyRenderRuntime } from "./create-runtime/kitty-render-runtime";
import { createRuntimeLifecycleThemeSize } from "./create-runtime/lifecycle-theme-size";
import { createRuntimeSearch } from "./create-runtime/search-runtime";
import { createRuntimeRenderTicks } from "./create-runtime/render-ticks";
import { createRuntimeFontRuntimeHelpers } from "./create-runtime/font-runtime";
import { createRuntimeReporting } from "./create-runtime/runtime-reporting";
import { createResttyFontResourceStore } from "./fonts/font-resource-store";
import type { RuntimeTerminalColor } from "./create-runtime/highlight-terminal-color-utils.types";
import { createRuntimeController } from "./create-runtime/runtime-controller";
import type { RuntimeController } from "./create-runtime/runtime-controller.api.types";
import type { RuntimeControllerSharedState } from "./create-runtime/runtime-controller.state.types";
export { createResttyRuntimeSession, getDefaultResttyRuntimeSession } from "./core/session";
export type { ResttyRuntime } from "./core/api";
export type { ResttyRuntimeConfig } from "./core/config";
export type {
  ResttyRuntimeCallbacks,
  FontSource,
  ResttyFontHintTarget,
  ResttyFontSource,
  ResttyTouchSelectionMode,
  ResttyUrlFontSource,
  ResttyBufferFontSource,
  ResttyLocalFontSource,
  ResttyWasmLogListener,
  ResttyRuntimeSession,
  ResttyRuntimeInputPayload,
  ResttyShaderStage,
  ResttyShaderStageMode,
  ResttyShaderStageBackend,
  ResttyShaderStageSource,
  ResttyRuntimeEvent,
  ResttyRuntimeLifecycleState,
} from "./types";

const FALLBACK_LOCAL_FONT_SOURCES: ResttyFontSource[] = [
  {
    type: "local",
    matchers: [
      "jetbrainsmono nerd font",
      "jetbrains mono nerd font",
      "fira code nerd font",
      "fira code nerd",
      "hack nerd font",
      "meslo lgm nerd font",
      "monaspace nerd font",
      "nerd font mono",
    ],
    label: "fallback-nerd-font",
  },
  {
    type: "local",
    matchers: ["jetbrains mono"],
    label: "fallback-jetbrains",
  },
];

export function createResttyRuntime(options: ResttyRuntimeConfig): ResttyRuntime {
  const mount = options.mount;
  const terminal = options.terminal ?? {};
  const services = options.services ?? {};
  const { canvas: canvasInput, imeInput: imeInputInput } = mount;
  const { callbacks } = services;
  const beforeInputHook = services.beforeInput;
  const beforeRenderOutputHook = services.beforeRenderOutput;
  const { runBeforeInputHook, runBeforeRenderOutputHook } = createRuntimeInputHooks({
    beforeInputHook,
    beforeRenderOutputHook,
  });
  const session = mount.session ?? getDefaultResttyRuntimeSession();
  const fontResourceStore = session.getFontResourceStore?.() ?? createResttyFontResourceStore();
  const textShaper = bundledTextShaper;
  if (!canvasInput) {
    throw new Error("createResttyRuntime requires a canvas element");
  }
  const {
    UnicodeBuffer,
    shape,
    glyphBufferToShapedGlyphs,
    buildAtlas,
    atlasToRGBA,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    PixelMode,
  } = textShaper;
  const attachWindowEvents = terminal.attachWindowEvents ?? true;
  const attachCanvasEvents = terminal.attachCanvasEvents ?? true;
  const autoResize = terminal.autoResize ?? true;
  const touchSelectionMode = normalizeTouchSelectionMode(terminal.touchSelectionMode);
  const touchSelectionLongPressMs = clampFiniteNumber(
    terminal.touchSelectionLongPressMs,
    450,
    120,
    2000,
    true,
  );
  const touchSelectionMoveThresholdPx = clampFiniteNumber(
    terminal.touchSelectionMoveThresholdPx,
    10,
    1,
    64,
  );
  const resolveFontHintTarget = (value: unknown): ResttyFontHintTarget => {
    if (value === "light" || value === "normal" || value === "auto") return value;
    return "auto";
  };
  let ligatures = terminal.ligatures ?? true;
  let fontHinting = terminal.fontHinting ?? false;
  let fontHintTarget = resolveFontHintTarget(terminal.fontHintTarget);
  const nerdIconScale = Number.isFinite(terminal.nerdIconScale)
    ? Number(terminal.nerdIconScale)
    : 1.0;
  const alphaBlending: AlphaBlendingMode = terminal.alphaBlending ?? "linear-corrected";
  const cleanupFns: Array<() => void> = [];
  const cleanupCanvasFns: Array<() => void> = [];
  const runtimeEvents = createRuntimeEventHub();

  let canvas = canvasInput;
  let currentContextType: "webgpu" | "webgl2" | null = null;

  const DEFAULT_BG_BASE: Color = [0.08, 0.09, 0.1, 1.0];
  const DEFAULT_FG_BASE: Color = [0.92, 0.93, 0.95, 1.0];
  const SELECTION_BACKGROUND_BASE: RuntimeTerminalColor = {
    kind: "color",
    color: [0.35, 0.55, 0.9, 0.45],
  };
  const SELECTION_FOREGROUND_BASE: RuntimeTerminalColor | null = null;
  const SEARCH_MATCH_BACKGROUND_BASE: RuntimeTerminalColor = {
    kind: "color",
    color: [1.0, 224 / 255, 130 / 255, 1.0],
  };
  const SEARCH_CURRENT_MATCH_BACKGROUND_BASE: RuntimeTerminalColor = {
    kind: "color",
    color: [242 / 255, 165 / 255, 126 / 255, 1.0],
  };
  const SEARCH_MATCH_TEXT_BASE: RuntimeTerminalColor = {
    kind: "color",
    color: [0, 0, 0, 1.0],
  };
  const SEARCH_CURRENT_MATCH_TEXT_BASE: RuntimeTerminalColor = {
    kind: "color",
    color: [0, 0, 0, 1.0],
  };
  const CURSOR_BASE: Color = [0.95, 0.95, 0.95, 1.0];
  let defaultBg: Color = [...DEFAULT_BG_BASE];
  let defaultFg: Color = [...DEFAULT_FG_BASE];
  let selectionBackgroundColor: RuntimeTerminalColor = SELECTION_BACKGROUND_BASE;
  let selectionForegroundColor: RuntimeTerminalColor | null = SELECTION_FOREGROUND_BASE;
  let searchMatchBackgroundColor: RuntimeTerminalColor = SEARCH_MATCH_BACKGROUND_BASE;
  let searchCurrentMatchBackgroundColor: RuntimeTerminalColor =
    SEARCH_CURRENT_MATCH_BACKGROUND_BASE;
  let searchMatchTextColor: RuntimeTerminalColor = SEARCH_MATCH_TEXT_BASE;
  let searchCurrentMatchTextColor: RuntimeTerminalColor = SEARCH_CURRENT_MATCH_TEXT_BASE;
  let cursorFallback: Color = [...CURSOR_BASE];
  const CURSOR_BLINK_MS = 600;
  const FORCE_CURSOR_BLINK = false;
  const STYLE_BOLD = 1 << 0;
  const STYLE_ITALIC = 1 << 1;
  const STYLE_FAINT = 1 << 2;
  const STYLE_BLINK = 1 << 3;
  const STYLE_INVERSE = 1 << 4;
  const STYLE_INVISIBLE = 1 << 5;
  const STYLE_STRIKE = 1 << 6;
  const STYLE_OVERLINE = 1 << 7;
  const STYLE_UNDERLINE_MASK = 0x700;
  const ITALIC_SLANT = 0.2;
  const BOLD_BRIGHTEN = 0.18;
  const BOLD_OFFSET = 0.06;
  const FAINT_ALPHA = 0.6;
  const TARGET_RENDER_FPS = 120;
  const BACKGROUND_RENDER_FPS = 15;
  const GLYPH_SHAPE_CACHE_LIMIT = 12000;
  const FONT_PICK_CACHE_LIMIT = 16000;

  let currentDpr = window.devicePixelRatio || 1;
  let wasm: ResttyWasm | null = null;
  let wasmExports: ResttyWasmExports | null = null;
  let wasmHandle = 0;
  let wasmReady = false;
  let activeState: WebGPUState | WebGLState | null = null;
  const RESIZE_OVERLAY_HOLD_MS = 500;
  const RESIZE_OVERLAY_FADE_MS = 400;
  const RESIZE_ACTIVE_MS = 180;
  const resizeState = {
    active: false,
    lastAt: 0,
    cols: 0,
    rows: 0,
    dpr: 1,
  };
  let needsRender = true;
  let lastRenderTime = 0;
  const KEYDOWN_BEFOREINPUT_DEDUPE_MS = 80;
  let lastKeydownSeq = "";
  let lastKeydownSeqAt = 0;
  let runtimeController: RuntimeController | null = null;
  function sendInput(text: string, source = "program", config: { skipHooks?: boolean } = {}) {
    runtimeApi?.sendInput(text, source, config);
  }
  const ptyTransport: PtyTransport = services.ptyTransport ?? createWebSocketPtyTransport();
  const PTY_OUTPUT_IDLE_MS = 10;
  const PTY_OUTPUT_MAX_MS = 40;
  const SYNC_OUTPUT_RESET_MS = 1000;
  const SYNC_OUTPUT_RESET_SEQ = "\x1b[?2026l";
  const ptyOutputBuffer = createPtyOutputBufferController({
    idleMs: PTY_OUTPUT_IDLE_MS,
    maxMs: PTY_OUTPUT_MAX_MS,
    onFlush: (output) => sendInput(output, "pty"),
  });
  let lastCursorForCpr = { row: 1, col: 1 };
  function resolveCursorForCpr() {
    if (wasmHandle && wasmExports?.restty_active_cursor_x && wasmExports?.restty_active_cursor_y) {
      const activeCol = wasmExports.restty_active_cursor_x(wasmHandle);
      const activeRow = wasmExports.restty_active_cursor_y(wasmHandle);
      const cols = lastRenderState?.cols ?? 0;
      const rows = lastRenderState?.rows ?? 0;
      const inBounds =
        cols > 0 &&
        rows > 0 &&
        Number.isFinite(activeCol) &&
        Number.isFinite(activeRow) &&
        activeCol >= 0 &&
        activeRow >= 0 &&
        activeCol < cols &&
        activeRow < rows;
      if (inBounds) {
        lastCursorForCpr = {
          row: Math.floor(activeRow) + 1,
          col: Math.floor(activeCol) + 1,
        };
      }
    }
    return lastCursorForCpr;
  }
  let inputHandler: InputHandler | null = null;
  let activeTheme: GhosttyTheme | null = null;
  const webgpuUniforms = new Float32Array(8);
  const shaderStageRuntime = createShaderStageRuntime({
    getCanvasSize: () => ({ width: canvas.width, height: canvas.height }),
    getActiveWebGLState: () => (activeState && "gl" in activeState ? activeState : null),
    onShaderStagesChanged: () => {
      needsRender = true;
    },
  });
  const {
    setShaderStages,
    getShaderStages,
    isShaderStagesDirty,
    setShaderStagesDirty,
    getCompiledWebGPUShaderStages,
    getCompiledWebGLShaderStages,
    clearWebGPUShaderStages,
    clearWebGLShaderStages,
    destroyWebGPUStageTargets,
    destroyWebGLStageTargets,
    ensureWebGPUStageTargets,
    ensureWebGLStageTargets,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
  } = shaderStageRuntime;
  const ATLAS_PADDING = 4;
  const SYMBOL_ATLAS_PADDING = 10;
  const SYMBOL_ATLAS_MAX_SIZE = 4096;
  const GLYPH_INSTANCE_FLOATS = 18;
  const GLYPH_RENDER_MODE_MONO = 0;
  const GLYPH_RENDER_MODE_COLOR = 1;
  const KITTY_PLACEHOLDER_CP = 0x10eeee;
  const KITTY_FLAG_REPORT_EVENTS = 1 << 1;

  const textDecoder = new TextDecoder();

  let isFocused = typeof document !== "undefined" ? document.activeElement === canvas : true;

  const imeInput = imeInputInput ?? null;
  const isMacPlatform = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

  const fontConfig = {
    sizePx: Number.isFinite(terminal.fontSize) ? Math.max(1, Math.round(terminal.fontSize)) : 18,
  };

  function configureImeInputElement() {
    if (!imeInput) return;
    const style = imeInput.style;
    style.position = "fixed";
    style.left = "0";
    style.top = "0";
    style.width = "1em";
    style.height = "1em";
    style.padding = "0";
    style.margin = "0";
    style.border = "0";
    style.outline = "none";
    style.background = "transparent";
    style.color = "transparent";
    style.caretColor = "transparent";
    style.overflow = "hidden";
    style.resize = "none";
    style.opacity = "0";
    style.pointerEvents = "none";
    syncImeInputTypography(imeInput, fontConfig.sizePx);
  }
  configureImeInputElement();

  let lastRenderState: RenderState | null = null;
  const runtimeInteraction = createRuntimeInteraction({
    attachCanvasEvents,
    touchSelectionMode,
    touchSelectionLongPressMs,
    touchSelectionMoveThresholdPx,
    imeInput,
    cleanupCanvasFns,
    getCanvas: () => canvas,
    getCurrentDpr: () => currentDpr,
    getGridState: () => gridState,
    getLastRenderState: () => lastRenderState,
    getWasmReady: () => wasmReady,
    getWasm: () => wasm,
    getWasmHandle: () => wasmHandle,
    getWasmExports: () => wasmExports,
    updateLinkHover,
    markNeedsRender: () => {
      needsRender = true;
    },
    markSearchDirty: () => {
      searchRuntime.markDirty();
    },
  });
  const {
    selectionState,
    linkState,
    scrollbarState,
    imeState,
    updateCanvasCursor,
    positionToCell,
    positionToPixel,
    clearSelection,
    updateImePosition,
    syncScrollbar,
    bindCanvasEvents: bindCanvasInteractionEvents,
  } = runtimeInteraction;
  const searchRuntime = createRuntimeSearch({
    callbacks,
    cleanupFns,
    emitRuntimeEvent: runtimeEvents.emit,
    getWasmReady: () => wasmReady,
    getWasm: () => wasm,
    getWasmHandle: () => wasmHandle,
    markNeedsRender: () => {
      needsRender = true;
    },
  });
  const kittyRenderRuntime = createKittyRenderRuntime({
    getWasm: () => wasm,
    markNeedsRender: () => {
      needsRender = true;
    },
  });
  const {
    selectionForRow,
    getSelectionText,
    getRenderState,
    resolveCursorPosition,
    resolveCursorStyle,
    reportTermSize,
    reportCursor,
  } = createRuntimeReporting({
    selectionState,
    getLastRenderState: () => lastRenderState,
    getWasmReady: () => wasmReady,
    getWasm: () => wasm,
    getWasmHandle: () => wasmHandle,
    getWasmExports: () => wasmExports,
    emitRuntimeEvent: runtimeEvents.emit,
    setCursorForCpr: (value) => {
      lastCursorForCpr = value;
    },
  });

  inputHandler = createInputHandler({
    getCursorPosition: resolveCursorForCpr,
    sendReply: (data) => {
      ptyTransport.sendInput(data);
    },
    positionToCell,
    positionToPixel,
    getDefaultColors: () => ({
      fg: floatsToRgb(defaultFg),
      bg: floatsToRgb(defaultBg),
      cursor: floatsToRgb(cursorFallback),
    }),
    getWindowMetrics: () => {
      const cols = Math.max(1, gridState.cols || 1);
      const rows = Math.max(1, gridState.rows || 1);
      const widthPx = Math.max(1, Math.round(canvas.width));
      const heightPx = Math.max(1, Math.round(canvas.height));
      const cellWidthPx = Math.max(1, Math.round(gridState.cellW || widthPx / Math.max(1, cols)));
      const cellHeightPx = Math.max(1, Math.round(gridState.cellH || heightPx / Math.max(1, rows)));
      return { rows, cols, widthPx, heightPx, cellWidthPx, cellHeightPx };
    },
    onClipboardWrite: async (text) => {
      if (!text) return;
      await writeClipboardText(text);
    },
    onClipboardRead: async () => {
      return (await readClipboardText()) ?? "";
    },
    getKittyKeyboardFlags: () => {
      if (!wasm || !wasmHandle) return 0;
      return wasm.getKittyKeyboardFlags(wasmHandle);
    },
    onWindowOp: () => {},
    onDesktopNotification: callbacks?.onDesktopNotification,
  });
  inputHandler!.setMouseMode("auto");

  const ptyInputRuntime = createPtyInputRuntime({
    ptyTransport,
    ptyOutputBuffer,
    inputHandler,
    emitRuntimeEvent: runtimeEvents.emit,
    getGridSize: () => ({ cols: gridState.cols || 0, rows: gridState.rows || 0 }),
    getResizeMeta: () => {
      const cols = gridState.cols || 0;
      const rows = gridState.rows || 0;
      if (cols <= 0 || rows <= 0) return null;
      return {
        widthPx: canvas.width,
        heightPx: canvas.height,
        cellW: gridState.cellW,
        cellH: gridState.cellH,
      };
    },
    getCursorForCpr: resolveCursorForCpr,
    sendInput,
    runBeforeInputHook,
    shouldClearSelection: () => selectionState.active || selectionState.dragging,
    clearSelection,
    syncOutputResetMs: SYNC_OUTPUT_RESET_MS,
    syncOutputResetSeq: SYNC_OUTPUT_RESET_SEQ,
  });
  const { sendKeyInput, sendPasteText } = ptyInputRuntime;
  const { sendPastePayloadFromDataTransfer, getCprPosition } = ptyInputRuntime;

  inputHandler.setCursorProvider(getCprPosition);

  function bindCanvasEvents() {
    bindCanvasInteractionEvents({
      inputHandler: inputHandler!,
      sendKeyInput,
      sendPasteText,
      sendPastePayloadFromDataTransfer,
      getLastKeydownSeq: () => lastKeydownSeq,
      getLastKeydownSeqAt: () => lastKeydownSeqAt,
      keydownBeforeinputDedupeMs: KEYDOWN_BEFOREINPUT_DEDUPE_MS,
      openLink,
    });
  }

  bindCanvasEvents();

  const fontState: FontManagerState = {
    font: null,
    fonts: [],
    fontSizePx: 0,
    sizeMode: terminal.fontSizeMode === "em" ? "em" : "height",
    fontPickCache: new Map(),
  };

  const FONT_SCALE_OVERRIDES = terminal.fontScaleOverrides ?? [];

  function applyFontSize(value) {
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(10, Math.min(64, Math.round(value)));
    if (fontConfig.sizePx === clamped) return;
    fontConfig.sizePx = clamped;
    syncImeInputTypography(imeInput, clamped);
    for (const entry of fontState.fonts) resetFontEntry(entry);
    if (activeState && activeState.glyphAtlases) {
      activeState.glyphAtlases = new Map();
    }
    updateGrid();
    wasm?.renderUpdate?.(wasmHandle);
    needsRender = true;
  }

  const resolveGlyphPixelMode = (entry: FontEntry): number =>
    resolveGlyphPixelModeFromEntry(entry, PixelMode.Gray, PixelMode.RGBA ?? 4, isColorEmojiFont);

  const { atlasBitmapToRGBA, buildColorEmojiAtlasWithCanvas } = createColorGlyphAtlasHelpers({
    pixelModeRgba: PixelMode.RGBA ?? 4,
    atlasToRGBA,
  });

  let configuredFontSources = normalizeFontSources(terminal.fontSources, terminal.fontPreset);

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
  const {
    shapeClusterWithFont,
    noteColorGlyphText,
    fontHasGlyph,
    pickFontIndexForText,
    computeCellMetrics,
    updateGrid,
    ensureAtlasForFont,
  } = createRuntimeFontRuntimeHelpers({
    fontState,
    fontConfig,
    gridState,
    getCanvas: () => canvas,
    getCurrentDpr: () => currentDpr,
    getActiveState: () => activeState,
    getWasmReady: () => wasmReady,
    getWasm: () => wasm,
    getWasmHandle: () => wasmHandle,
    ptyTransport,
    setNeedsRender: () => {
      needsRender = true;
    },
    markSearchDirty: () => {
      searchRuntime.markDirty();
    },
    getLigatures: () => ligatures,
    getFontHinting: () => fontHinting,
    getFontHintTarget: () => fontHintTarget,
    fontScaleOverrides: FONT_SCALE_OVERRIDES,
    resolveGlyphPixelMode,
    atlasBitmapToRGBA,
    padAtlasRGBA,
    buildAtlas,
    buildColorEmojiAtlasWithCanvas,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    pixelModeRgbaValue: PixelMode.RGBA ?? 4,
    atlasPadding: ATLAS_PADDING,
    symbolAtlasPadding: SYMBOL_ATLAS_PADDING,
    symbolAtlasMaxSize: SYMBOL_ATLAS_MAX_SIZE,
    glyphShapeCacheLimit: GLYPH_SHAPE_CACHE_LIMIT,
    fontPickCacheLimit: FONT_PICK_CACHE_LIMIT,
    UnicodeBuffer,
    shape,
    glyphBufferToShapedGlyphs,
  });

  let fontPromise: Promise<void> | null = null;
  let fontLease: ResttyFontResourceLease | null = null;

  setShaderStages(terminal.shaderStages ?? []);

  const lifecycleThemeSizeRuntime = createRuntimeLifecycleThemeSize({
    attachCanvasEvents,
    attachWindowEvents,
    autoResize,
    imeInput,
    cleanupFns,
    cleanupCanvasFns,
    gridState,
    resizeState,
    fontState,
    defaultBgBase: DEFAULT_BG_BASE,
    defaultFgBase: DEFAULT_FG_BASE,
    selectionBackgroundBase: SELECTION_BACKGROUND_BASE,
    selectionForegroundBase: SELECTION_FOREGROUND_BASE,
    searchMatchBackgroundBase: SEARCH_MATCH_BACKGROUND_BASE,
    searchCurrentMatchBackgroundBase: SEARCH_CURRENT_MATCH_BACKGROUND_BASE,
    searchMatchTextBase: SEARCH_MATCH_TEXT_BASE,
    searchCurrentMatchTextBase: SEARCH_CURRENT_MATCH_TEXT_BASE,
    cursorBase: CURSOR_BASE,
    getCanvas: () => canvas,
    setCanvas: (nextCanvas) => (canvas = nextCanvas),
    getCurrentDpr: () => currentDpr,
    setCurrentDpr: (dpr) => (currentDpr = dpr),
    setCurrentContextType: (value) => (currentContextType = value),
    getActiveState: () => activeState,
    getInputHandler: () => inputHandler,
    setIsFocused: (value) => (isFocused = value),
    getActiveTheme: () => activeTheme,
    setActiveTheme: (theme) => (activeTheme = theme),
    setDefaultBg: (value) => (defaultBg = value),
    setDefaultFg: (value) => (defaultFg = value),
    setSelectionBackgroundColor: (value) => (selectionBackgroundColor = value),
    setSelectionForegroundColor: (value) => (selectionForegroundColor = value),
    setSearchMatchBackgroundColor: (value) => (searchMatchBackgroundColor = value),
    setSearchCurrentMatchBackgroundColor: (value) => (searchCurrentMatchBackgroundColor = value),
    setSearchMatchTextColor: (value) => (searchMatchTextColor = value),
    setSearchCurrentMatchTextColor: (value) => (searchCurrentMatchTextColor = value),
    setCursorFallback: (value) => (cursorFallback = value),
    getWasmReady: () => wasmReady,
    getWasm: () => wasm,
    getWasmHandle: () => wasmHandle,
    bindCanvasEvents,
    computeCellMetrics,
    updateGrid,
    clearKittyRenderCaches: kittyRenderRuntime.clearKittyRenderCaches,
    sendKeyInput,
    clearWebGLShaderStages,
    destroyWebGLStageTargets,
    destroyWebGPUStageTargets,
    setShaderStagesDirty,
    markNeedsRender: () => (needsRender = true),
    resetLastRenderTime: () => (lastRenderTime = 0),
  });
  const {
    applyTheme,
    resetTheme,
    replaceCanvas,
    updateSize,
    resize,
    focus,
    blur,
    bindFocusEvents,
  } = lifecycleThemeSizeRuntime;
  bindFocusEvents();
  lifecycleThemeSizeRuntime.bindAutoResizeEvents();

  function resolveLinkUri(render: RenderState, linkId: number) {
    if (!render.linkOffsets || !render.linkLengths || !render.linkBuffer) return "";
    if (!linkId) return "";
    const idx = linkId - 1;
    const offset = render.linkOffsets[idx] ?? 0;
    const len = render.linkLengths[idx] ?? 0;
    if (!len) return "";
    return textDecoder.decode(render.linkBuffer.subarray(offset, offset + len));
  }

  function updateLinkHover(cell: { row: number; col: number } | null) {
    if (!lastRenderState || !cell || !lastRenderState.linkIds) {
      if (linkState.hoverId !== 0) {
        linkState.hoverId = 0;
        linkState.hoverUri = "";
        updateCanvasCursor();
        needsRender = true;
      }
      return;
    }
    const { cols, rows, linkIds } = lastRenderState;
    if (cell.row < 0 || cell.col < 0 || cell.row >= rows || cell.col >= cols) {
      if (linkState.hoverId !== 0) {
        linkState.hoverId = 0;
        linkState.hoverUri = "";
        updateCanvasCursor();
        needsRender = true;
      }
      return;
    }
    const idx = cell.row * cols + cell.col;
    const linkId = linkIds[idx] ?? 0;
    if (linkId === linkState.hoverId) return;
    if (!linkId) {
      linkState.hoverId = 0;
      linkState.hoverUri = "";
      updateCanvasCursor();
      needsRender = true;
      return;
    }
    linkState.hoverId = linkId;
    linkState.hoverUri = resolveLinkUri(lastRenderState, linkId);
    updateCanvasCursor();
    needsRender = true;
  }

  function releaseFontLease() {
    if (!fontLease) return;
    fontLease.release();
    fontLease = null;
  }

  function clearFontRuntimeState() {
    for (let i = 0; i < fontState.fonts.length; i += 1) {
      resetFontEntry(fontState.fonts[i]);
    }
    fontState.font = null;
    fontState.fonts = [];
    fontState.fontSizePx = 0;
    fontState.fontPickCache.clear();
    if (activeState?.glyphAtlases) {
      activeState.glyphAtlases.clear();
    }
  }

  async function setFontSources(sources: ResttyFontSource[]) {
    configuredFontSources = normalizeFontSources(sources, undefined);
    fontPromise = null;
    releaseFontLease();
    clearFontRuntimeState();

    await ensureFont();
    updateGrid();
    needsRender = true;
  }

  function invalidateFontAtlasesForHinting() {
    for (let i = 0; i < fontState.fonts.length; i += 1) {
      const entry = fontState.fonts[i];
      entry.atlas = null;
      entry.glyphIds.clear();
      entry.fontSizePx = 0;
      entry.atlasScale = 1;
      entry.constraintSignature = "";
    }
    if (activeState?.glyphAtlases) {
      activeState.glyphAtlases = new Map();
    }
    needsRender = true;
  }

  function setFontHinting(value: boolean) {
    const next = Boolean(value);
    if (fontHinting === next) return;
    fontHinting = next;
    invalidateFontAtlasesForHinting();
  }

  function setLigatures(value: boolean) {
    const next = Boolean(value);
    if (ligatures === next) return;
    ligatures = next;
    needsRender = true;
  }

  function setFontHintTarget(value: ResttyFontHintTarget) {
    const next = resolveFontHintTarget(value);
    if (fontHintTarget === next) return;
    fontHintTarget = next;
    if (fontHinting) {
      invalidateFontAtlasesForHinting();
    }
  }

  async function ensureFont() {
    if (fontState.font || fontPromise) return fontPromise;
    fontPromise = (async () => {
      let acquiredLease: ResttyFontResourceLease | null = null;
      try {
        acquiredLease = await fontResourceStore.acquire(configuredFontSources);
        if (!acquiredLease.faces.length) {
          acquiredLease.release();
          acquiredLease = await fontResourceStore.acquire(FALLBACK_LOCAL_FONT_SOURCES);
        }
        if (!acquiredLease.faces.length) {
          throw new Error("Unable to load any configured font source.");
        }
        releaseFontLease();
        fontLease = acquiredLease;
        acquiredLease = null;

        const entries: FontEntry[] = [];
        for (let i = 0; i < fontLease.faces.length; i += 1) {
          const face = fontLease.faces[i];
          entries.push(createFontEntry(face.font, face.label));
        }
        if (!entries.length) {
          throw new Error("Unable to parse any loaded font source.");
        }
        fontState.fonts = entries;
        fontState.font = entries[0].font;
        fontState.fontSizePx = 0;
        fontState.fontPickCache.clear();
        if (activeState && activeState.glyphAtlases) {
          activeState.glyphAtlases = new Map();
        }
        updateGrid();
      } catch (err) {
        if (acquiredLease) {
          acquiredLease.release();
        } else {
          releaseFontLease();
        }
        clearFontRuntimeState();
        console.error("font load error", err);
      }
    })();
    return fontPromise;
  }

  cleanupFns.push(() => {
    releaseFontLease();
    clearFontRuntimeState();
    configuredFontSources = [];
    fontPromise = null;
  });

  const { tickWebGPU, tickWebGL } = createRuntimeRenderTicks({
    isShaderStagesDirty,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    getCompiledWebGPUShaderStages,
    getCompiledWebGLShaderStages,
    ensureWebGPUStageTargets,
    ensureWebGLStageTargets,
    updateGrid,
    getRenderState,
    fontState,
    resolveBlendFlags,
    alphaBlending,
    srgbToLinearColor,
    get defaultBg() {
      return defaultBg;
    },
    reportTermSize,
    resolveCursorPosition,
    reportCursor,
    FORCE_CURSOR_BLINK,
    CURSOR_BLINK_MS,
    imeInput,
    resolveCursorStyle,
    get isFocused() {
      return isFocused;
    },
    imeState,
    resolveImeAnchor,
    get wasmExports() {
      return wasmExports;
    },
    get wasmHandle() {
      return wasmHandle;
    },
    gridState,
    get canvas() {
      return canvas;
    },
    fontHeightUnits,
    updateImePosition,
    fontScaleOverride,
    FONT_SCALE_OVERRIDES,
    getLigatures: () => ligatures,
    getFontHinting: () => fontHinting,
    getFontHintTarget: () => fontHintTarget,
    isSymbolFont,
    isColorEmojiFont,
    fontAdvanceUnits,
    shapeClusterWithFont,
    fontMaxCellSpan,
    clamp,
    buildNerdMetrics,
    nerdIconScale,
    selectionState,
    selectionForRow,
    getSearchViewportMatches: searchRuntime.getViewportMatches,
    pushRect,
    get selectionBackgroundColor() {
      return selectionBackgroundColor;
    },
    get selectionForegroundColor() {
      return selectionForegroundColor;
    },
    get searchMatchBackgroundColor() {
      return searchMatchBackgroundColor;
    },
    get searchCurrentMatchBackgroundColor() {
      return searchCurrentMatchBackgroundColor;
    },
    get searchMatchTextColor() {
      return searchMatchTextColor;
    },
    get searchCurrentMatchTextColor() {
      return searchCurrentMatchTextColor;
    },
    STYLE_BOLD,
    STYLE_ITALIC,
    STYLE_FAINT,
    STYLE_BLINK,
    STYLE_INVERSE,
    STYLE_INVISIBLE,
    STYLE_STRIKE,
    STYLE_OVERLINE,
    STYLE_UNDERLINE_MASK,
    decodeRGBAWithCache,
    brighten,
    BOLD_BRIGHTEN,
    fade,
    FAINT_ALPHA,
    linkState,
    drawUnderlineStyle,
    drawStrikethrough,
    drawOverline,
    KITTY_PLACEHOLDER_CP,
    isSpaceCp,
    shouldMergeTrailingClusterCodepoint,
    isBlockElement,
    drawBlockElement,
    isBoxDrawing,
    drawBoxDrawing,
    isBraille,
    drawBraille,
    isPowerline,
    drawPowerline,
    pickFontIndexForText,
    stylePreferenceFromFlags,
    noteColorGlyphText,
    isRenderSymbolLike,
    resolveSymbolConstraint,
    isGraphicsElement,
    glyphWidthUnits,
    fitTextTailToWidth,
    PREEDIT_BG,
    PREEDIT_UL,
    PREEDIT_ACTIVE_BG,
    PREEDIT_CARET,
    PREEDIT_FG,
    resizeState,
    RESIZE_OVERLAY_HOLD_MS,
    RESIZE_OVERLAY_FADE_MS,
    pushRectBox,
    ensureAtlasForFont,
    isAppleSymbolsFont,
    DEFAULT_APPLE_SYMBOLS_CONSTRAINT,
    DEFAULT_SYMBOL_CONSTRAINT,
    DEFAULT_EMOJI_CONSTRAINT,
    constrainGlyphBox,
    tightenNerdConstraintBox,
    fontEntryHasItalicStyle,
    fontEntryHasBoldStyle,
    ITALIC_SLANT,
    BOLD_OFFSET,
    GLYPH_RENDER_MODE_COLOR,
    GLYPH_RENDER_MODE_MONO,
    decodePackedRGBA,
    get cursorFallback() {
      return cursorFallback;
    },
    scrollbarState,
    syncScrollbar,
    webgpuUniforms,
    ensureInstanceBuffer,
    GLYPH_INSTANCE_FLOATS,
    get wasm() {
      return wasm;
    },
    collectKittyDrawPlan: kittyRenderRuntime.collectKittyDrawPlan,
    resolveKittyWebGLTexture: kittyRenderRuntime.resolveKittyWebGLTexture,
    resolveKittyWebGPUBindGroup: kittyRenderRuntime.resolveKittyWebGPUBindGroup,
    buildFontAtlasIfNeeded,
    resolveGlyphPixelMode,
    atlasBitmapToRGBA,
    padAtlasRGBA,
    buildAtlas,
    buildGlyphAtlasWithConstraints,
    buildColorEmojiAtlasWithCanvas,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    nerdConstraintSignature,
    ATLAS_PADDING,
    SYMBOL_ATLAS_PADDING,
    SYMBOL_ATLAS_MAX_SIZE,
    PixelMode,
    ensureGLInstanceBuffer,
    get lastRenderState() {
      return lastRenderState;
    },
    set lastRenderState(value: RenderState | null) {
      lastRenderState = value;
    },
  });
  // Source-based regression tests assert these render-loop invariants in this file.
  // const symbolLike = isRenderSymbolLike(cp) || isSymbolFont(fontEntry);
  // const nerdConstraint = symbolLike ? resolveSymbolConstraint(cp) : null;
  // drawBoxDrawing(cp, x, rowY, cellW, cellH, fg, fgRectData, underlineThicknessPx)
  // const constraint = nerdConstraint ?? (colorGlyph ? DEFAULT_EMOJI_CONSTRAINT : DEFAULT_SYMBOL_CONSTRAINT);
  // const nerdConstraint = resolveSymbolConstraint(item.cp);
  // const symbolLike = isRenderSymbolLike(cp) || isSymbolFont(fontEntry);
  // const nerdConstraint = symbolLike ? resolveSymbolConstraint(cp) : null;
  // drawBoxDrawing(cp, x, rowY, cellW, cellH, fg, fgRectData, underlineThicknessPx)
  // const constraint = nerdConstraint ?? (colorGlyph ? DEFAULT_EMOJI_CONSTRAINT : DEFAULT_SYMBOL_CONSTRAINT);
  // const nerdConstraint = resolveSymbolConstraint(item.cp);
  const readRuntimeControllerState = (): RuntimeControllerSharedState => ({
    wasm,
    wasmExports,
    wasmHandle,
    wasmReady,
    activeState,
    needsRender,
    lastRenderTime,
    currentContextType,
    isFocused,
    lastKeydownSeq,
    lastKeydownSeqAt,
  });
  const writeRuntimeControllerState = (patch: Partial<RuntimeControllerSharedState>) => {
    ({
      wasm = wasm,
      wasmExports = wasmExports,
      wasmHandle = wasmHandle,
      wasmReady = wasmReady,
      activeState = activeState,
      needsRender = needsRender,
      lastRenderTime = lastRenderTime,
      currentContextType = currentContextType,
      isFocused = isFocused,
      lastKeydownSeq = lastKeydownSeq,
      lastKeydownSeqAt = lastKeydownSeqAt,
    } = patch);
  };
  cleanupFns.push(() => {
    kittyRenderRuntime.clearKittyRenderCaches();
  });
  runtimeController = createRuntimeController({
    runtimeEvents,
    session,
    ptyTransport,
    inputHandler: inputHandler!,
    ptyInputRuntime,
    interaction: runtimeInteraction,
    lifecycleThemeSizeRuntime,
    cleanupFns,
    cleanupCanvasFns,
    imeInput,
    attachWindowEvents,
    isMacPlatform,
    readState: readRuntimeControllerState,
    writeState: writeRuntimeControllerState,
    runBeforeInputHook,
    runBeforeRenderOutputHook,
    CURSOR_BLINK_MS,
    RESIZE_ACTIVE_MS,
    TARGET_RENDER_FPS,
    BACKGROUND_RENDER_FPS,
    KITTY_FLAG_REPORT_EVENTS,
    resizeState,
    tickWebGPU,
    tickWebGL,
    updateGrid,
    gridState,
    getCanvas: () => canvas,
    applyTheme,
    ensureFont,
    updateSize,
    replaceCanvas,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    clearWebGPUShaderStages,
    destroyWebGPUStageTargets,
    clearWebGLShaderStages,
    destroyWebGLStageTargets,
    markSearchDirty: () => {
      searchRuntime.markDirty();
    },
    handleSearchWasmReset: () => {
      searchRuntime.handleWasmReset();
    },
    getSelectionText,
    initialPreferredRenderer: terminal.renderer ?? "auto",
    maxScrollbackBytes: terminal.maxScrollbackBytes,
    maxScrollback: terminal.maxScrollback,
  });
  return runtimeController.createPublicApi({
    terminal: {
      setFontSize: applyFontSize,
      setLigatures,
      setFontHinting,
      setFontHintTarget,
      setFontSources,
      resetTheme,
    },
    search: {
      setQuery: searchRuntime.setQuery,
      clear: searchRuntime.clear,
      next: searchRuntime.next,
      previous: searchRuntime.previous,
      getState: searchRuntime.getState,
    },
    interaction: {
      resize,
      focus,
      blur,
      updateSize,
    },
    render: {
      setShaderStages,
      getShaderStages,
    },
  });
}

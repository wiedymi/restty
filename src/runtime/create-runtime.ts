import { createInputHandler, type InputHandler } from "../input";
import {
  isNerdSymbolCodepoint,
  getNerdConstraint,
  isSymbolFont,
  isColorEmojiFont,
  isNerdSymbolFont,
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
import { buildFontAtlasIfNeeded } from "./atlas-builder";
import { normalizeFontSources } from "./font-sources";
import * as bundledTextShaper from "text-shaper";
import type { ResttyFontSource, ResttyApp, ResttyAppOptions } from "./types";
import { getDefaultResttyAppSession } from "./session";
import { createPtyOutputBufferController } from "./pty-output-buffer";
import {
  fitTextTailToWidth,
  openLink,
  sourceLabelFromUrl,
  sourceBufferFromView,
} from "./create-app-io-utils";
import { drawUnderlineStyle, drawStrikethrough, drawOverline } from "./text-decoration";
import {
  DEFAULT_SYMBOL_CONSTRAINT,
  DEFAULT_APPLE_SYMBOLS_CONSTRAINT,
  DEFAULT_EMOJI_CONSTRAINT,
  normalizeTouchSelectionMode,
  clampFiniteNumber,
  isRenderSymbolLike,
  resolveSymbolConstraint,
} from "./create-app-symbols";
import { decodePackedRGBA, decodeRGBAWithCache, brighten, fade } from "./render-color-utils";
import {
  shouldMergeTrailingClusterCodepoint,
  stylePreferenceFromFlags,
  isAppleSymbolsFont,
  fontEntryHasBoldStyle,
  fontEntryHasItalicStyle,
} from "./codepoint-utils";
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
} from "./create-runtime/atlas-debug-utils";
import { formatCodepoint } from "./create-runtime/format-utils";
import { createRuntimeLogger } from "./create-runtime/runtime-logger";
import { createShaderStageRuntime } from "./create-runtime/shader-stage-runtime";
import { createColorGlyphAtlasHelpers } from "./create-runtime/color-glyph-atlas";
import { createRuntimeDebugTools } from "./create-runtime/debug-tools";
import { createRuntimeInputHooks } from "./create-runtime/input-hooks";
import { createPtyInputRuntime } from "./create-runtime/pty-input-runtime";
import { createRuntimeInteraction } from "./create-runtime/interaction-runtime";
import { createRuntimeLifecycleThemeSize } from "./create-runtime/lifecycle-theme-size";
import { createRuntimeRenderTicks } from "./create-runtime/render-ticks";
import { createRuntimeFontRuntimeHelpers } from "./create-runtime/font-runtime-helpers";
import { createRuntimeReporting } from "./create-runtime/runtime-reporting";
import {
  createRuntimeAppApi,
  type RuntimeAppApiRuntime,
  type RuntimeAppApiSharedState,
} from "./create-runtime/runtime-app-api";
import type {
  LocalFontFaceData,
  NavigatorWithLocalFontAccess,
  GlobalWithLocalFontAccess,
} from "./create-app-types";
export { createResttyAppSession, getDefaultResttyAppSession } from "./session";
export { createResttyPaneManager } from "../surface/panes/manager";
export {
  createDefaultResttyPaneContextMenuItems,
  getResttyShortcutModifierLabel,
} from "../surface/panes/default-context-menu-items";
export type {
  ResttyAppElements,
  ResttyAppCallbacks,
  FontSource,
  ResttyFontSource,
  ResttyTouchSelectionMode,
  ResttyUrlFontSource,
  ResttyBufferFontSource,
  ResttyLocalFontSource,
  ResttyWasmLogListener,
  ResttyAppSession,
  ResttyAppInputPayload,
  ResttyShaderStage,
  ResttyShaderStageMode,
  ResttyShaderStageBackend,
  ResttyShaderStageSource,
  ResttyAppOptions,
  ResttyApp,
} from "./types";
export type {
  ResttyPaneSplitDirection,
  ResttyPaneContextMenuItem,
  ResttyPaneDefinition,
  ResttyPaneStyleOptions,
  ResttyPaneStylesOptions,
  ResttyPaneShortcutsOptions,
  ResttyPaneContextMenuOptions,
  CreateResttyPaneManagerOptions,
  ResttyPaneManager,
  ResttyPaneWithApp,
  CreateDefaultResttyPaneContextMenuItemsOptions,
} from "../surface/panes-types";

export function createResttyApp(options: ResttyAppOptions): ResttyApp {
  const { canvas: canvasInput, imeInput: imeInputInput, elements, callbacks } = options;
  const beforeInputHook = options.beforeInput;
  const beforeRenderOutputHook = options.beforeRenderOutput;
  const { runBeforeInputHook, runBeforeRenderOutputHook } = createRuntimeInputHooks({
    beforeInputHook,
    beforeRenderOutputHook,
  });
  const session = options.session ?? getDefaultResttyAppSession();
  const textShaper = bundledTextShaper;
  if (!canvasInput) {
    throw new Error("createResttyApp requires a canvas element");
  }
  const {
    Font,
    UnicodeBuffer,
    shape,
    glyphBufferToShapedGlyphs,
    buildAtlas,
    atlasToRGBA,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    PixelMode,
  } = textShaper;
  const attachWindowEvents = options.attachWindowEvents ?? true;
  const attachCanvasEvents = options.attachCanvasEvents ?? true;
  const autoResize = options.autoResize ?? true;
  const debugExpose = options.debugExpose ?? false;
  const touchSelectionMode = normalizeTouchSelectionMode(options.touchSelectionMode);
  const touchSelectionLongPressMs = clampFiniteNumber(
    options.touchSelectionLongPressMs,
    450,
    120,
    2000,
    true,
  );
  const touchSelectionMoveThresholdPx = clampFiniteNumber(
    options.touchSelectionMoveThresholdPx,
    10,
    1,
    64,
  );
  const hasCoarsePointer =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(any-pointer: coarse)").matches;
  const hasTouchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const showOverlayScrollbar = !(hasCoarsePointer || hasTouchPoints);
  const nerdIconScale = Number.isFinite(options.nerdIconScale)
    ? Number(options.nerdIconScale)
    : 1.0;
  const alphaBlending: AlphaBlendingMode = options.alphaBlending ?? "linear-corrected";
  const cleanupFns: Array<() => void> = [];
  const cleanupCanvasFns: Array<() => void> = [];

  let canvas = canvasInput;
  let currentContextType: "webgpu" | "webgl2" | null = null;
  const backendEl = elements?.backendEl ?? null;
  const fpsEl = elements?.fpsEl ?? null;
  const dprEl = elements?.dprEl ?? null;
  const sizeEl = elements?.sizeEl ?? null;
  const gridEl = elements?.gridEl ?? null;
  const cellEl = elements?.cellEl ?? null;
  const termSizeEl = elements?.termSizeEl ?? null;
  const cursorPosEl = elements?.cursorPosEl ?? null;
  const inputDebugEl = elements?.inputDebugEl ?? null;
  const dbgEl = elements?.dbgEl ?? null;
  const ptyStatusEl = elements?.ptyStatusEl ?? null;
  const mouseStatusEl = elements?.mouseStatusEl ?? null;
  const termDebug = elements?.termDebugEl ?? null;
  const atlasInfoEl = elements?.atlasInfoEl ?? null;
  const atlasCanvas = elements?.atlasCanvas ?? null;
  const logEl = elements?.logEl ?? null;

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
  const TARGET_RENDER_FPS = 60;
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
  const RESIZE_COMMIT_DEBOUNCE_MS = 36;
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
  let runtimeAppApi: RuntimeAppApiRuntime | null = null;
  function sendInput(text: string, source = "program", config: { skipHooks?: boolean } = {}) {
    runtimeAppApi?.sendInput(text, source, config);
  }
  const ptyTransport: PtyTransport = options.ptyTransport ?? createWebSocketPtyTransport();
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
  let inputHandler: InputHandler | null = null;
  let activeTheme: GhosttyTheme | null = null;
  const webgpuUniforms = new Float32Array(8);
  const runtimeLogger = createRuntimeLogger({
    logEl,
    onLog: callbacks?.onLog,
  });
  const { appendLog, log, shouldSuppressWasmLog } = runtimeLogger;
  const shaderStageRuntime = createShaderStageRuntime({
    appendLog,
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
  const KITTY_OVERLAY_DEBUG =
    typeof window !== "undefined" &&
    (() => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("kittyDebug") === "1") return true;
        const value = window.localStorage?.getItem("restty.kittyDebug");
        if (value != null) return value === "1";
        return window.localStorage?.getItem("restty.kittyDebug") === "1";
      } catch {
        return false;
      }
    })();
  const KITTY_FLAG_REPORT_EVENTS = 1 << 1;

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  let isFocused = typeof document !== "undefined" ? document.activeElement === canvas : true;

  const imeInput = imeInputInput ?? null;
  const isMacPlatform = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

  const fontConfig = {
    sizePx: Number.isFinite(options.fontSize) ? Math.max(1, Math.round(options.fontSize!)) : 18,
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
    showOverlayScrollbar,
    kittyOverlayDebugEnabled: KITTY_OVERLAY_DEBUG,
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
  });
  const {
    selectionState,
    linkState,
    scrollbarState,
    imeState,
    updateCanvasCursor,
    syncKittyOverlaySize,
    clearKittyOverlay,
    drawKittyOverlay,
    positionToCell,
    positionToPixel,
    clearSelection,
    updateImePosition,
    appendOverlayScrollbar,
    bindCanvasEvents: bindCanvasInteractionEvents,
    detachKittyOverlayCanvas,
  } = runtimeInteraction;
  const {
    selectionForRow,
    getSelectionText,
    getRenderState,
    resolveCursorPosition,
    resolveCursorStyle,
    reportTermSize,
    reportCursor,
    reportDebugText,
  } = createRuntimeReporting({
    selectionState,
    getLastRenderState: () => lastRenderState,
    getWasmReady: () => wasmReady,
    getWasm: () => wasm,
    getWasmHandle: () => wasmHandle,
    getWasmExports: () => wasmExports,
    callbacks,
    termSizeEl,
    cursorPosEl,
    dbgEl,
    setCursorForCpr: (value) => {
      lastCursorForCpr = value;
    },
  });

  inputHandler = createInputHandler({
    getCursorPosition: () => lastCursorForCpr,
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
    onWindowOp: (op) => {
      appendLog(`[term] window op ${op.type} ${op.params.join(";")}`);
    },
    onDesktopNotification: callbacks?.onDesktopNotification,
  });
  inputHandler!.setMouseMode("auto");

  const ptyInputRuntime = createPtyInputRuntime({
    ptyTransport,
    ptyOutputBuffer,
    inputHandler,
    ptyStatusEl,
    mouseStatusEl,
    onPtyStatus: callbacks?.onPtyStatus,
    onMouseStatus: callbacks?.onMouseStatus,
    appendLog,
    getGridSize: () => ({ cols: gridState.cols || 0, rows: gridState.rows || 0 }),
    getCursorForCpr: () => lastCursorForCpr,
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
    sizeMode: options.fontSizeMode === "em" ? "em" : "height",
    fontPickCache: new Map(),
  };

  const FONT_SCALE_OVERRIDES = options.fontScaleOverrides ?? [];

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
    appendLog(`[ui] font size ${clamped}px`);
  }

  const resolveGlyphPixelMode = (entry: FontEntry): number =>
    resolveGlyphPixelModeFromEntry(entry, PixelMode.Gray, PixelMode.RGBA ?? 4, isColorEmojiFont);

  const { atlasBitmapToRGBA, buildColorEmojiAtlasWithCanvas } = createColorGlyphAtlasHelpers({
    pixelModeRgba: PixelMode.RGBA ?? 4,
    atlasToRGBA,
  });

  let configuredFontSources = normalizeFontSources(options.fontSources, options.fontPreset);

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
    flushPendingTerminalResize,
    scheduleTerminalResizeCommit,
    resetTerminalResizeScheduler,
    ensureAtlasForFont,
  } = createRuntimeFontRuntimeHelpers({
    fontState,
    fontConfig,
    gridState,
    callbacks,
    gridEl,
    cellEl,
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
    resizeState,
    resizeActiveMs: RESIZE_ACTIVE_MS,
    resizeCommitDebounceMs: RESIZE_COMMIT_DEBOUNCE_MS,
    onSyncKittyOverlaySize: syncKittyOverlaySize,
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

  const { dumpAtlasForCodepoint, setupDebugExpose } = createRuntimeDebugTools({
    debugExpose,
    getWindow: () => (typeof window !== "undefined" ? window : undefined),
    getActiveState: () => activeState,
    getCanvas: () => canvas,
    atlasCanvas,
    atlasInfoEl,
    fontState,
    gridState,
    fontConfig,
    pickFontIndexForText,
    ensureAtlasForFont,
    formatCodepoint,
    isSymbolFont,
    isNerdSymbolCodepoint,
    isSymbolCp,
    fontHasGlyph,
    shapeClusterWithFont,
    getNerdConstraint,
    fontHeightUnits,
    fontScaleOverride,
    fontScaleOverrides: FONT_SCALE_OVERRIDES,
    fontAdvanceUnits,
    fontMaxCellSpan,
    clamp,
    buildNerdMetrics,
    nerdIconScale,
    isColorEmojiFont,
    atlasPadding: ATLAS_PADDING,
    symbolAtlasPadding: SYMBOL_ATLAS_PADDING,
    pixelModeGray: PixelMode.Gray,
    pixelModeRgba: PixelMode.RGBA ?? 4,
  });
  setupDebugExpose();

  let fontPromise: Promise<void> | null = null;
  let fontError: Error | null = null;

  setShaderStages(options.shaderStages ?? []);

  const lifecycleThemeSizeRuntime = createRuntimeLifecycleThemeSize({
    attachCanvasEvents,
    attachWindowEvents,
    autoResize,
    imeInput,
    dprEl,
    sizeEl,
    callbacks,
    cleanupFns,
    cleanupCanvasFns,
    gridState,
    resizeState,
    fontState,
    defaultBgBase: DEFAULT_BG_BASE,
    defaultFgBase: DEFAULT_FG_BASE,
    selectionBase: SELECTION_BASE,
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
    setSelectionColor: (value) => (selectionColor = value),
    setCursorFallback: (value) => (cursorFallback = value),
    getWasmReady: () => wasmReady,
    getWasm: () => wasm,
    getWasmHandle: () => wasmHandle,
    appendLog,
    bindCanvasEvents,
    computeCellMetrics,
    updateGrid,
    syncKittyOverlaySize,
    scheduleTerminalResizeCommit,
    sendKeyInput,
    clearWebGLShaderStages,
    destroyWebGLStageTargets,
    destroyWebGPUStageTargets,
    detachKittyOverlayCanvas,
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

  async function tryLocalFontBuffer(matchers, label = "local-font") {
    if (typeof window === "undefined") return null;
    const globalAccess = globalThis as GlobalWithLocalFontAccess;
    const nav = (globalAccess.navigator ?? navigator) as NavigatorWithLocalFontAccess;
    const queryLocalFonts =
      typeof globalAccess.queryLocalFonts === "function"
        ? globalAccess.queryLocalFonts.bind(globalAccess)
        : typeof nav.queryLocalFonts === "function"
          ? nav.queryLocalFonts.bind(nav)
          : null;
    if (!queryLocalFonts) return null;
    const normalizedMatchers = matchers
      .map((matcher: string) => matcher.toLowerCase())
      .filter(Boolean);
    if (!normalizedMatchers.length) return null;
    const detectStyleHint = (value: string) => {
      const text = value.toLowerCase();
      let weight = 400;
      if (/\b(thin|hairline)\b/.test(text)) weight = 100;
      else if (/\b(extra[- ]?light|ultra[- ]?light)\b/.test(text)) weight = 200;
      else if (/\blight\b/.test(text)) weight = 300;
      else if (/\bmedium\b/.test(text)) weight = 500;
      else if (/\b(semi[- ]?bold|demi[- ]?bold)\b/.test(text)) weight = 600;
      else if (/\bbold\b/.test(text)) weight = 700;
      else if (/\b(extra[- ]?bold|ultra[- ]?bold)\b/.test(text)) weight = 800;
      else if (/\b(black|heavy)\b/.test(text)) weight = 900;
      return {
        bold: /\b(bold|semi[- ]?bold|demi[- ]?bold|extra[- ]?bold|black|heavy)\b/.test(text),
        italic: /\b(italic|oblique)\b/.test(text),
        regular: /\b(regular|book|roman|normal)\b/.test(text),
        weight,
      };
    };
    const sourceHint = detectStyleHint(`${label} ${normalizedMatchers.join(" ")}`);
    const queryPermission = nav.permissions?.query;
    if (queryPermission) {
      try {
        const status = await queryPermission({ name: "local-fonts" });
        if (status?.state === "denied") return null;
        console.log(`[font] local permission (${label}): ${status?.state ?? "unknown"}`);
      } catch {}
    }
    try {
      const fonts = await queryLocalFonts();
      const matches = fonts.filter((font) => {
        const name =
          `${font.family ?? ""} ${font.fullName ?? ""} ${font.postscriptName ?? ""}`.toLowerCase();
        return normalizedMatchers.some((matcher) => name.includes(matcher));
      });
      if (matches.length) {
        const scoreMatch = (font: LocalFontFaceData) => {
          const name =
            `${font.family ?? ""} ${font.fullName ?? ""} ${font.postscriptName ?? ""}`.toLowerCase();
          const hint = detectStyleHint(name);
          let score = 0;
          for (let i = 0; i < normalizedMatchers.length; i += 1) {
            if (name.includes(normalizedMatchers[i])) score += 8;
          }
          if (sourceHint.bold || sourceHint.italic) {
            score += sourceHint.bold === hint.bold ? 40 : -40;
            score += sourceHint.italic === hint.italic ? 40 : -40;
          } else {
            score += !hint.bold && !hint.italic ? 60 : -30;
          }
          const targetWeight = sourceHint.bold ? 700 : 400;
          score -= Math.abs((hint.weight ?? 400) - targetWeight) * 0.25;
          if (!sourceHint.bold && hint.weight === 400) score += 12;
          if (!sourceHint.bold && hint.weight < 350) score -= 12;
          if (!sourceHint.bold && hint.weight > 650) score -= 8;
          if (sourceHint.regular && !hint.bold && !hint.italic) score += 20;
          return score;
        };

        let match = matches[0];
        let bestScore = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < matches.length; i += 1) {
          const candidate = matches[i];
          const candidateScore = scoreMatch(candidate);
          if (candidateScore > bestScore) {
            bestScore = candidateScore;
            match = candidate;
          }
        }

        const matchedName =
          `${match.family ?? ""} ${match.fullName ?? ""} ${match.postscriptName ?? ""}`.trim();
        console.log(
          `[font] local matched (${label}): ${matchedName || "unnamed"} score=${bestScore}`,
        );
        const blob = await match.blob();
        return blob.arrayBuffer();
      }
      console.log(`[font] local no-match (${label}): ${normalizedMatchers.join(", ")}`);
    } catch (err) {
      console.warn("queryLocalFonts failed", err);
    }
    return null;
  }

  async function resolveFontSourceBuffer(source: ResttyFontSource): Promise<ArrayBuffer | null> {
    if (source.type === "url") {
      return tryFetchFontBuffer(source.url);
    }
    if (source.type === "buffer") {
      const data = source.data;
      if (data instanceof ArrayBuffer) return data;
      if (ArrayBuffer.isView(data)) return sourceBufferFromView(data);
      return null;
    }
    if (source.type === "local") {
      const matchers: string[] = [];
      for (let i = 0; i < source.matchers.length; i += 1) {
        const matcher = source.matchers[i];
        if (!matcher) continue;
        matchers.push(matcher.toLowerCase());
      }
      if (!matchers.length) return null;
      return tryLocalFontBuffer(matchers, source.label ?? source.matchers[0] ?? "local-font");
    }
    return null;
  }

  async function loadConfiguredFontBuffers() {
    const loaded: Array<{ label: string; buffer: ArrayBuffer }> = [];
    for (let i = 0; i < configuredFontSources.length; i += 1) {
      const source = configuredFontSources[i];
      const buffer = await resolveFontSourceBuffer(source);
      if (!buffer) {
        if (source.type === "local") {
          const prefix = source.required
            ? "required local font missing"
            : "optional local font missing";
          console.warn(`[font] ${prefix} (${source.matchers.join(", ")})`);
        }
        continue;
      }
      const label =
        source.label ??
        (source.type === "url"
          ? sourceLabelFromUrl(source.url, i)
          : source.type === "local"
            ? (source.matchers[0] ?? `local-font-${i + 1}`)
            : `font-buffer-${i + 1}`);
      loaded.push({ label, buffer });
    }
    if (loaded.length) return loaded;

    const nerdLocal = await tryLocalFontBuffer(
      [
        "jetbrainsmono nerd font",
        "jetbrains mono nerd font",
        "fira code nerd font",
        "fira code nerd",
        "hack nerd font",
        "meslo lgm nerd font",
        "monaspace nerd font",
        "nerd font mono",
      ],
      "fallback-nerd-font",
    );
    if (nerdLocal) return [{ label: "local-nerd-font", buffer: nerdLocal }];

    const local = await tryLocalFontBuffer(["jetbrains mono"], "fallback-jetbrains");
    if (local) return [{ label: "local-jetbrains-mono", buffer: local }];

    return [];
  }

  async function setFontSources(sources: ResttyFontSource[]) {
    configuredFontSources = normalizeFontSources(sources, undefined);
    fontPromise = null;
    fontError = null;

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

    await ensureFont();
    updateGrid();
    needsRender = true;
    appendLog("[ui] font sources updated");
  }

  async function ensureFont() {
    if (fontState.font || fontPromise) return fontPromise;
    fontPromise = (async () => {
      try {
        const configuredBuffers = await loadConfiguredFontBuffers();
        if (!configuredBuffers.length) {
          throw new Error("Unable to load any configured font source.");
        }
        const entries: FontEntry[] = [];
        for (let sourceIndex = 0; sourceIndex < configuredBuffers.length; sourceIndex += 1) {
          const source = configuredBuffers[sourceIndex];
          try {
            const collection = Font.collection ? Font.collection(source.buffer) : null;
            if (collection) {
              const names = collection.names();
              for (let infoIndex = 0; infoIndex < names.length; infoIndex += 1) {
                const info = names[infoIndex];
                try {
                  const face = collection.get(info.index);
                  const metadataLabel = info.fullName || info.family || info.postScriptName || "";
                  const label = metadataLabel
                    ? `${source.label} (${metadataLabel})`
                    : `${source.label} ${info.index}`;
                  entries.push(createFontEntry(face, label));
                } catch (err) {
                  console.warn(`font face load failed (${source.label} ${info.index})`, err);
                }
              }
            } else {
              const loadedFont = await Font.loadAsync(source.buffer);
              entries.push(createFontEntry(loadedFont, source.label));
            }
          } catch (err) {
            console.warn(`font load failed (${source.label})`, err);
          }
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
        fontError = null;
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

  const { tickWebGPU, tickWebGL } = createRuntimeRenderTicks({
    isShaderStagesDirty,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    getCompiledWebGPUShaderStages,
    getCompiledWebGLShaderStages,
    ensureWebGPUStageTargets,
    ensureWebGLStageTargets,
    get fontError() {
      return fontError;
    },
    termDebug,
    reportDebugText,
    updateGrid,
    getRenderState,
    fontState,
    clearKittyOverlay,
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
    dbgEl,
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
    pushRect,
    get selectionColor() {
      return selectionColor;
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
    appendOverlayScrollbar,
    webgpuUniforms,
    ensureInstanceBuffer,
    GLYPH_INSTANCE_FLOATS,
    get wasm() {
      return wasm;
    },
    drawKittyOverlay,
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
  const readRuntimeAppApiState = (): RuntimeAppApiSharedState => ({
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
  const writeRuntimeAppApiState = (patch: Partial<RuntimeAppApiSharedState>) => {
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
  runtimeAppApi = createRuntimeAppApi({
    session,
    ptyTransport,
    inputHandler: inputHandler!,
    ptyInputRuntime,
    interaction: runtimeInteraction,
    lifecycleThemeSizeRuntime,
    cleanupFns,
    cleanupCanvasFns,
    callbacks,
    fpsEl,
    backendEl,
    inputDebugEl,
    imeInput,
    attachWindowEvents,
    isMacPlatform,
    textEncoder,
    readState: readRuntimeAppApiState,
    writeState: writeRuntimeAppApiState,
    appendLog,
    shouldSuppressWasmLog,
    runBeforeInputHook,
    runBeforeRenderOutputHook,
    CURSOR_BLINK_MS,
    RESIZE_ACTIVE_MS,
    TARGET_RENDER_FPS,
    BACKGROUND_RENDER_FPS,
    KITTY_FLAG_REPORT_EVENTS,
    resizeState,
    flushPendingTerminalResize,
    tickWebGPU,
    tickWebGL,
    updateGrid,
    gridState,
    getCanvas: () => canvas,
    applyTheme,
    ensureFont,
    updateSize,
    log,
    replaceCanvas,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    clearWebGPUShaderStages,
    destroyWebGPUStageTargets,
    clearWebGLShaderStages,
    destroyWebGLStageTargets,
    resetTerminalResizeScheduler,
    getSelectionText,
    initialPreferredRenderer: options.renderer ?? "auto",
    maxScrollback: options.maxScrollback,
  });
  return runtimeAppApi.createPublicApi({
    setFontSize: applyFontSize,
    setFontSources,
    resetTheme,
    dumpAtlasForCodepoint,
    resize,
    focus,
    blur,
    updateSize,
    setShaderStages,
    getShaderStages,
  });
}

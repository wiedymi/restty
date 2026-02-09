import { createInputHandler, type InputHandler, type MouseMode } from "../input";
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
  type NerdConstraint,
} from "../fonts";
import type {
  ResttyWasm,
  RenderState,
  CursorInfo,
  KittyPlacement,
  ResttyWasmExports,
} from "../wasm";
import { createWebSocketPtyTransport, type PtyTransport } from "../pty";
import { colorToFloats, colorToRgbU32, type GhosttyTheme } from "../theme";
import {
  initWebGPU,
  initWebGL,
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
import { PREEDIT_BG, PREEDIT_ACTIVE_BG, PREEDIT_FG, PREEDIT_UL, PREEDIT_CARET } from "../ime";
import {
  buildFontAtlasIfNeeded,
  type GlyphConstraintMeta,
  type AtlasConstraintContext,
} from "./atlas-builder";
import {
  readPastePayloadFromDataTransfer,
} from "./clipboard-paste";
import { normalizeFontSources } from "./font-sources";
import * as bundledTextShaper from "text-shaper";
import type {
  ResttyFontSource,
  ResttyApp,
  ResttyAppOptions,
  ResttyTouchSelectionMode,
} from "./types";
import { getDefaultResttyAppSession } from "./session";
export { createResttyAppSession, getDefaultResttyAppSession } from "./session";
export {
  createResttyPaneManager,
  createDefaultResttyPaneContextMenuItems,
  getResttyShortcutModifierLabel,
} from "./panes";
export { Restty } from "./restty";
export { RESTTY_PLUGIN_API_VERSION } from "./restty";
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
} from "./panes";
export type {
  ResttyOptions,
  ResttyPluginApiRange,
  ResttyPlugin,
  ResttyPluginCleanup,
  ResttyPluginContext,
  ResttyPluginDisposable,
  ResttyPluginEvents,
  ResttyPluginInfo,
  ResttyPluginRequires,
  ResttyInputInterceptor,
  ResttyInputInterceptorPayload,
  ResttyInterceptorOptions,
  ResttyLifecycleHook,
  ResttyLifecycleHookPayload,
  ResttyPluginLoadResult,
  ResttyPluginLoadStatus,
  ResttyPluginManifestEntry,
  ResttyPluginRegistry,
  ResttyPluginRegistryEntry,
  ResttyRenderHook,
  ResttyRenderHookPayload,
  ResttyOutputInterceptor,
  ResttyOutputInterceptorPayload,
} from "./restty";

function normalizeTouchSelectionMode(
  value: ResttyTouchSelectionMode | undefined,
): ResttyTouchSelectionMode {
  if (value === "drag" || value === "long-press" || value === "off") return value;
  return "long-press";
}

function clampFiniteNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  round = false,
): number {
  if (!Number.isFinite(value)) return fallback;
  const numeric = round ? Math.round(value as number) : Number(value);
  return Math.min(max, Math.max(min, numeric));
}

function isRenderSymbolLike(cp: number): boolean {
  return isSymbolCp(cp) || isRendererSymbolFallbackRange(cp);
}

function resolveSymbolConstraint(cp: number): NerdConstraint | null {
  return getNerdConstraint(cp);
}

const RENDERER_SYMBOL_FALLBACK_RANGES: ReadonlyArray<readonly [number, number]> = [
  // Miscellaneous Technical: includes symbols like ⏎/⏵ used by prompts.
  [0x2300, 0x23ff],
  // Geometric Shapes: includes boxed/dot indicators often used in prompts.
  [0x25a0, 0x25ff],
  // Misc Symbols and Arrows: additional modern prompt icon block.
  [0x2b00, 0x2bff],
];

function isRendererSymbolFallbackRange(cp: number): boolean {
  for (let i = 0; i < RENDERER_SYMBOL_FALLBACK_RANGES.length; i += 1) {
    const [start, end] = RENDERER_SYMBOL_FALLBACK_RANGES[i];
    if (cp >= start && cp <= end) return true;
  }
  return false;
}

const DEFAULT_SYMBOL_CONSTRAINT: NerdConstraint = {
  // For non-Nerd symbol-like glyphs in fallback fonts, center inside the cell
  // to reduce baseline drift caused by mismatched font metrics.
  size: "fit",
  align_horizontal: "center",
  align_vertical: "center",
  max_constraint_width: 1,
};

const DEFAULT_APPLE_SYMBOLS_CONSTRAINT: NerdConstraint = {
  // Apple Symbols tends to render UI arrows/icons smaller than terminal-native
  // output. Use cover for closer parity.
  size: "cover",
  align_horizontal: "center",
  align_vertical: "center",
  max_constraint_width: 1,
};

const DEFAULT_EMOJI_CONSTRAINT: NerdConstraint = {
  // Match Ghostty's emoji treatment: maximize size, preserve aspect, center.
  size: "cover",
  align_horizontal: "center",
  align_vertical: "center",
  pad_left: 0.025,
  pad_right: 0.025,
};

type LocalFontsPermissionDescriptor = PermissionDescriptor & { name: "local-fonts" };
type LocalFontFaceData = {
  family?: string;
  fullName?: string;
  postscriptName?: string;
  blob: () => Promise<Blob>;
};
type NavigatorWithLocalFontAccess = Navigator & {
  queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  permissions?: {
    query?: (permissionDesc: LocalFontsPermissionDescriptor) => Promise<PermissionStatus>;
  };
};
type GlobalWithLocalFontAccess = typeof globalThis & {
  queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  navigator?: NavigatorWithLocalFontAccess;
};

type ResttyDebugWindow = Window &
  typeof globalThis & {
    diagnoseCodepoint?: (cp: number) => void;
    dumpGlyphMetrics?: (cp: number) => { fontIndex: number; glyphId: number } | null;
    dumpAtlasRegion?: (
      fontIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => Promise<ImageData | null>;
    dumpGlyphRender?: (cp: number, constraintWidth?: number) => Promise<unknown>;
  };

export function createResttyApp(options: ResttyAppOptions): ResttyApp {
  const { canvas: canvasInput, imeInput: imeInputInput, elements, callbacks } = options;
  const beforeInputHook = options.beforeInput;
  const beforeRenderOutputHook = options.beforeRenderOutput;
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
  const alphaBlending = options.alphaBlending ?? "linear-corrected";
  const srgbChannelToLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const srgbToLinearColor = (color: Color): Color => [
    srgbChannelToLinear(color[0]),
    srgbChannelToLinear(color[1]),
    srgbChannelToLinear(color[2]),
    color[3],
  ];
  const resolveBlendFlags = (
    backendType: "webgpu" | "webgl2",
    state?: { srgbSwapchain?: boolean },
  ) => {
    if (alphaBlending === "native") {
      return { useLinearBlending: false, useLinearCorrection: false };
    }
    if (backendType === "webgl2") {
      return { useLinearBlending: false, useLinearCorrection: false };
    }
    if (backendType === "webgpu" && !state?.srgbSwapchain) {
      return { useLinearBlending: false, useLinearCorrection: false };
    }
    return {
      useLinearBlending: true,
      useLinearCorrection: alphaBlending === "linear-corrected",
    };
  };
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
  const OVERLAY_SCROLLBAR_WIDTH_CSS_PX = 7;
  const OVERLAY_SCROLLBAR_MARGIN_CSS_PX = 4;
  const OVERLAY_SCROLLBAR_INSET_Y_CSS_PX = 2;
  const OVERLAY_SCROLLBAR_MIN_THUMB_CSS_PX = 28;
  const OVERLAY_SCROLLBAR_CAP_SUPERSAMPLE = 8;

  let paused = false;
  let backend = "none";
  let preferredRenderer: "auto" | "webgpu" | "webgl2" = options.renderer ?? "auto";
  let rafId = 0;
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentDpr = window.devicePixelRatio || 1;
  let wasm: ResttyWasm | null = null;
  let wasmExports: ResttyWasmExports | null = null;
  let wasmHandle = 0;
  let wasmReady = false;
  let activeState: WebGPUState | WebGLState | null = null;
  let sizeRaf = 0;
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
  let resizeWasActive = false;
  let pendingTerminalResize: { cols: number; rows: number } | null = null;
  let terminalResizeTimer = 0;
  const KEYDOWN_BEFOREINPUT_DEDUPE_MS = 80;
  let lastKeydownSeq = "";
  let lastKeydownSeqAt = 0;
  let nextBlinkTime = performance.now() + CURSOR_BLINK_MS;
  const ptyTransport: PtyTransport = options.ptyTransport ?? createWebSocketPtyTransport();
  const PTY_OUTPUT_IDLE_MS = 10;
  const PTY_OUTPUT_MAX_MS = 40;
  const SYNC_OUTPUT_RESET_MS = 1000;
  const SYNC_OUTPUT_RESET_SEQ = "\x1b[?2026l";
  let ptyOutputBuffer = "";
  let ptyOutputIdleTimer = 0;
  let ptyOutputMaxTimer = 0;
  let syncOutputResetTimer = 0;
  let lastCursorForCpr = { row: 1, col: 1 };
  let inputHandler: InputHandler | null = null;
  let activeTheme: GhosttyTheme | null = null;
  let lastReportedPtyStatus = "";
  let lastReportedMouseStatus = "";
  let lastReportedTermCols = -1;
  let lastReportedTermRows = -1;
  let lastReportedCursorCol = -1;
  let lastReportedCursorRow = -1;
  let lastReportedDebugText = "";
  const webgpuUniforms = new Float32Array(8);
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
  const SYMBOL_ATLAS_PADDING = 10;
  const SYMBOL_ATLAS_MAX_SIZE = 4096;
  const GLYPH_INSTANCE_FLOATS = 18;
  const GLYPH_RENDER_MODE_MONO = 0;
  const GLYPH_RENDER_MODE_COLOR = 1;
  const KITTY_FMT_GRAY = 1;
  const KITTY_FMT_GRAY_ALPHA = 2;
  const KITTY_FMT_RGB = 3;
  const KITTY_FMT_RGBA = 4;
  const KITTY_FMT_PNG = 100;
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

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  const COLOR_EMOJI_FONT_STACK =
    '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","EmojiOne Color","Twemoji Mozilla",sans-serif';
  let colorGlyphCanvas: HTMLCanvasElement | null = null;
  let colorGlyphCtx: CanvasRenderingContext2D | null = null;
  let kittyOverlayCanvas: HTMLCanvasElement | null = null;
  let kittyOverlayCtx: CanvasRenderingContext2D | null = null;

  type KittyDecodedImage = {
    key: string;
    width: number;
    height: number;
    source: CanvasImageSource;
  };
  const kittyImageCache = new Map<number, KittyDecodedImage>();
  const kittyDecodePending = new Set<string>();
  let kittyOverlayDebugLastSig = "";
  let kittyOverlayLastHash = -1;

  let isFocused = typeof document !== "undefined" ? document.activeElement === canvas : true;

  const imeInput = imeInputInput ?? null;
  const isMacPlatform = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const imeState = {
    composing: false,
    preedit: "",
    selectionStart: 0,
    selectionEnd: 0,
  };

  function configureImeInputElement() {
    if (!imeInput) return;
    const style = imeInput.style;
    style.position = "fixed";
    style.left = "0";
    style.top = "0";
    style.width = "1px";
    style.height = "1px";
    style.opacity = "0";
    style.pointerEvents = "none";
  }
  configureImeInputElement();

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

  const touchSelectionState: {
    pendingPointerId: number | null;
    activePointerId: number | null;
    panPointerId: number | null;
    pendingCell: { row: number; col: number } | null;
    pendingStartedAt: number;
    pendingStartX: number;
    pendingStartY: number;
    panLastY: number;
    pendingTimer: number;
  } = {
    pendingPointerId: null,
    activePointerId: null,
    panPointerId: null,
    pendingCell: null,
    pendingStartedAt: 0,
    pendingStartX: 0,
    pendingStartY: 0,
    panLastY: 0,
    pendingTimer: 0,
  };

  const desktopSelectionState: {
    pendingPointerId: number | null;
    pendingCell: { row: number; col: number } | null;
    startedWithActiveSelection: boolean;
  } = {
    pendingPointerId: null,
    pendingCell: null,
    startedWithActiveSelection: false,
  };

  const linkState = {
    hoverId: 0,
    hoverUri: "",
  };

  let scrollRemainder = 0;
  const scrollbarState = {
    lastInputAt: 0,
    lastTotal: 0,
    lastOffset: 0,
    lastLen: 0,
  };
  const scrollbarDragState = {
    pointerId: null as number | null,
    thumbGrabRatio: 0.5,
  };
  const KITTY_FLAG_REPORT_EVENTS = 1 << 1;

  function updateCanvasCursor() {
    if (!canvas) return;
    canvas.style.cursor = "text";
  }

  function isTouchPointer(event: PointerEvent) {
    return event.pointerType === "touch";
  }

  function clearPendingTouchSelection() {
    if (touchSelectionState.pendingTimer) {
      clearTimeout(touchSelectionState.pendingTimer);
      touchSelectionState.pendingTimer = 0;
    }
    touchSelectionState.pendingPointerId = null;
    touchSelectionState.pendingCell = null;
    touchSelectionState.pendingStartedAt = 0;
  }

  function clearPendingDesktopSelection() {
    desktopSelectionState.pendingPointerId = null;
    desktopSelectionState.pendingCell = null;
    desktopSelectionState.startedWithActiveSelection = false;
  }

  function tryActivatePendingTouchSelection(pointerId: number) {
    if (touchSelectionMode !== "long-press") return false;
    if (touchSelectionState.pendingPointerId !== pointerId || !touchSelectionState.pendingCell) {
      return false;
    }
    if (performance.now() - touchSelectionState.pendingStartedAt < touchSelectionLongPressMs) {
      return false;
    }
    const pendingCell = touchSelectionState.pendingCell;
    clearPendingTouchSelection();
    beginSelectionDrag(pendingCell, pointerId);
    return true;
  }

  function beginSelectionDrag(cell: { row: number; col: number }, pointerId: number) {
    clearPendingDesktopSelection();
    selectionState.active = true;
    selectionState.dragging = true;
    selectionState.anchor = cell;
    selectionState.focus = cell;
    touchSelectionState.activePointerId = pointerId;
    touchSelectionState.panPointerId = null;
    canvas.setPointerCapture?.(pointerId);
    updateCanvasCursor();
    needsRender = true;
  }

  function noteScrollActivity() {
    scrollbarState.lastInputAt = performance.now();
  }

  function getViewportScrollOffset() {
    if (!wasmHandle || !wasmExports?.restty_scrollbar_offset) return 0;
    return wasmExports.restty_scrollbar_offset(wasmHandle) || 0;
  }

  function shiftSelectionByRows(deltaRows: number) {
    if (!deltaRows) return;
    if (!selectionState.active && !selectionState.dragging) return;
    if (!selectionState.anchor || !selectionState.focus) return;
    const maxAbs = Math.max(1024, (gridState.rows || 24) * 128);
    selectionState.anchor = {
      row: clamp(selectionState.anchor.row + deltaRows, -maxAbs, maxAbs),
      col: selectionState.anchor.col,
    };
    selectionState.focus = {
      row: clamp(selectionState.focus.row + deltaRows, -maxAbs, maxAbs),
      col: selectionState.focus.col,
    };
    needsRender = true;
  }

  function scrollViewportByLines(lines: number) {
    if (!wasmReady || !wasmHandle || !gridState.cellH) return;
    scrollRemainder += lines;
    const delta = Math.trunc(scrollRemainder);
    scrollRemainder -= delta;
    if (!delta) return;
    const beforeOffset = getViewportScrollOffset();
    wasm.scrollViewport(wasmHandle, delta);
    const afterOffset = getViewportScrollOffset();
    shiftSelectionByRows(beforeOffset - afterOffset);
    if (linkState.hoverId) updateLinkHover(null);
    wasm.renderUpdate(wasmHandle);
    needsRender = true;
    noteScrollActivity();
  }

  function setViewportScrollOffset(nextOffset: number) {
    if (!wasmReady || !wasmHandle || !wasmExports?.restty_scrollbar_total) return;
    const total = wasmExports.restty_scrollbar_total(wasmHandle) || 0;
    const len = wasmExports.restty_scrollbar_len ? wasmExports.restty_scrollbar_len(wasmHandle) : 0;
    const current = wasmExports.restty_scrollbar_offset
      ? wasmExports.restty_scrollbar_offset(wasmHandle)
      : 0;
    const maxOffset = Math.max(0, total - len);
    const clamped = clamp(Math.round(nextOffset), 0, maxOffset);
    const delta = clamped - current;
    if (!delta) return;
    const beforeOffset = getViewportScrollOffset();
    wasm.scrollViewport(wasmHandle, delta);
    const afterOffset = getViewportScrollOffset();
    shiftSelectionByRows(beforeOffset - afterOffset);
    if (linkState.hoverId) updateLinkHover(null);
    wasm.renderUpdate(wasmHandle);
    needsRender = true;
    noteScrollActivity();
  }

  function pointerToCanvasPx(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  type OverlayScrollbarLayout = {
    total: number;
    offset: number;
    len: number;
    denom: number;
    width: number;
    trackX: number;
    trackY: number;
    trackH: number;
    thumbY: number;
    thumbH: number;
  };

  function computeOverlayScrollbarLayout(
    total: number,
    offset: number,
    len: number,
  ): OverlayScrollbarLayout | null {
    if (!(total > len && len > 0)) return null;
    const dpr = Math.max(1, currentDpr || 1);
    const width = Math.max(1, Math.round(OVERLAY_SCROLLBAR_WIDTH_CSS_PX * dpr));
    const margin = Math.max(1, Math.round(OVERLAY_SCROLLBAR_MARGIN_CSS_PX * dpr));
    const insetY = Math.max(0, Math.round(OVERLAY_SCROLLBAR_INSET_Y_CSS_PX * dpr));
    const trackX = Math.max(0, canvas.width - margin - width);
    const trackY = insetY;
    const trackH = Math.max(width, canvas.height - insetY * 2);
    const denom = Math.max(1, total - len);
    const dynamicThumbH = Math.round(trackH * (len / total));
    const minThumbH = Math.max(width, Math.round(OVERLAY_SCROLLBAR_MIN_THUMB_CSS_PX * dpr));
    const thumbH = Math.min(trackH, Math.max(minThumbH, dynamicThumbH));
    const thumbY = trackY + Math.round((offset / denom) * (trackH - thumbH));
    return { total, offset, len, denom, width, trackX, trackY, trackH, thumbY, thumbH };
  }

  function getOverlayScrollbarLayout(): OverlayScrollbarLayout | null {
    if (!showOverlayScrollbar || !wasmExports?.restty_scrollbar_total || !wasmHandle) return null;
    if (!gridState.rows) return null;
    const total = wasmExports.restty_scrollbar_total(wasmHandle) || 0;
    const offset = wasmExports.restty_scrollbar_offset
      ? wasmExports.restty_scrollbar_offset(wasmHandle)
      : 0;
    const len = wasmExports.restty_scrollbar_len
      ? wasmExports.restty_scrollbar_len(wasmHandle)
      : gridState.rows;
    return computeOverlayScrollbarLayout(total, offset, len);
  }

  function isPointInScrollbarHitArea(layout: OverlayScrollbarLayout, x: number, y: number) {
    const hitPadX = Math.max(3, Math.round(layout.width * 0.35));
    return (
      x >= layout.trackX - hitPadX &&
      x <= layout.trackX + layout.width + hitPadX &&
      y >= layout.trackY &&
      y <= layout.trackY + layout.trackH
    );
  }

  function isPointInScrollbarThumb(layout: OverlayScrollbarLayout, x: number, y: number) {
    return (
      x >= layout.trackX &&
      x <= layout.trackX + layout.width &&
      y >= layout.thumbY &&
      y <= layout.thumbY + layout.thumbH
    );
  }

  function scrollbarOffsetForPointerY(
    layout: OverlayScrollbarLayout,
    pointerY: number,
    thumbGrabRatio: number,
  ) {
    const thumbTop = pointerY - layout.thumbH * thumbGrabRatio;
    const trackSpan = Math.max(1, layout.trackH - layout.thumbH);
    const ratio = clamp((thumbTop - layout.trackY) / trackSpan, 0, 1);
    return Math.round(ratio * layout.denom);
  }

  function pushRoundedVerticalBar(
    out: number[],
    x: number,
    y: number,
    w: number,
    h: number,
    color: Color,
  ) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const width = Math.max(1, Math.round(w));
    const height = Math.max(1, Math.round(h));
    const radius = Math.min(width * 0.5, height * 0.5);
    if (radius <= 0) {
      pushRectBox(out, x0, y0, width, height, color);
      return;
    }

    const capRows = Math.min(height, Math.max(1, Math.ceil(radius)));
    const middleStart = capRows;
    const middleEnd = Math.max(middleStart, height - capRows);
    const middleH = middleEnd - middleStart;
    if (middleH > 0) {
      pushRectBox(out, x0, y0 + middleStart, width, middleH, color);
    }

    const radiusSq = radius * radius;
    const centerX = width * 0.5;
    const topCenterY = radius;
    const bottomCenterY = height - radius;
    const samplesPerAxis = Math.max(1, OVERLAY_SCROLLBAR_CAP_SUPERSAMPLE | 0);
    const totalSamples = samplesPerAxis * samplesPerAxis;
    const invSamples = 1 / totalSamples;
    const alphaBase = color[3];
    const alphaEpsilon = 1 / 255;

    const sampleCapPixelCoverage = (localX: number, localY: number, centerY: number) => {
      let hits = 0;
      for (let sy = 0; sy < samplesPerAxis; sy += 1) {
        const sampleY = localY + (sy + 0.5) / samplesPerAxis;
        for (let sx = 0; sx < samplesPerAxis; sx += 1) {
          const sampleX = localX + (sx + 0.5) / samplesPerAxis;
          const dx = sampleX - centerX;
          const dy = sampleY - centerY;
          if (dx * dx + dy * dy <= radiusSq) hits += 1;
        }
      }
      return hits * invSamples;
    };

    for (let row = 0; row < capRows; row += 1) {
      const topY = y0 + row;
      const bottomY = y0 + height - 1 - row;
      for (let col = 0; col < width; col += 1) {
        const coverageTop = sampleCapPixelCoverage(col, row, topCenterY);
        if (coverageTop > 0) {
          const alpha = alphaBase * coverageTop;
          if (alpha > alphaEpsilon) {
            out.push(x0 + col, topY, 1, 1, color[0], color[1], color[2], alpha);
          }
        }
        if (bottomY !== topY) {
          const localBottomY = height - 1 - row;
          const coverageBottom = sampleCapPixelCoverage(col, localBottomY, bottomCenterY);
          if (coverageBottom > 0) {
            const alpha = alphaBase * coverageBottom;
            if (alpha > alphaEpsilon) {
              out.push(x0 + col, bottomY, 1, 1, color[0], color[1], color[2], alpha);
            }
          }
        }
      }
    }
  }

  function appendOverlayScrollbar(
    overlayData: number[],
    total: number,
    offset: number,
    len: number,
  ) {
    if (!showOverlayScrollbar) return;
    const layout = computeOverlayScrollbarLayout(total, offset, len);
    if (!layout) return;
    const since = performance.now() - scrollbarState.lastInputAt;
    const fadeDelay = 160;
    const fadeDuration = 520;
    let alpha = 0;
    if (since < fadeDelay) {
      alpha = 0.68;
    } else if (since < fadeDelay + fadeDuration) {
      alpha = 0.68 * (1 - (since - fadeDelay) / fadeDuration);
    }
    if (alpha <= 0.01) return;

    const thumbColor: Color = [0.96, 0.96, 0.96, alpha * 0.75];
    pushRoundedVerticalBar(
      overlayData,
      layout.trackX,
      layout.thumbY,
      layout.width,
      layout.thumbH,
      thumbColor,
    );
  }

  function releaseKittyImage(entry: KittyDecodedImage | undefined) {
    const source = entry?.source as ImageBitmap | undefined;
    if (source && typeof source.close === "function") {
      try {
        source.close();
      } catch {
        // ignore cleanup errors
      }
    }
  }

  function ensureKittyOverlayCanvas() {
    const parent = canvas.parentElement;
    if (!parent || typeof document === "undefined") return;
    if (kittyOverlayCanvas && kittyOverlayCanvas.parentElement === parent) return;

    if (kittyOverlayCanvas?.parentElement) {
      kittyOverlayCanvas.parentElement.removeChild(kittyOverlayCanvas);
    }

    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === "static") {
      parent.style.position = "relative";
    }

    const overlay = document.createElement("canvas");
    overlay.className = "restty-kitty-overlay";
    overlay.style.position = "absolute";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.pointerEvents = "none";
    overlay.style.imageRendering = "pixelated";
    overlay.style.zIndex = "2";
    parent.appendChild(overlay);
    kittyOverlayCanvas = overlay;
    kittyOverlayCtx = overlay.getContext("2d");
  }

  function syncKittyOverlaySize() {
    if (!kittyOverlayCanvas) return;
    if (kittyOverlayCanvas.width !== canvas.width || kittyOverlayCanvas.height !== canvas.height) {
      kittyOverlayCanvas.width = canvas.width;
      kittyOverlayCanvas.height = canvas.height;
      kittyOverlayLastHash = -1;
    }
  }

  function clearKittyOverlay() {
    ensureKittyOverlayCanvas();
    syncKittyOverlaySize();
    if (!kittyOverlayCtx || !kittyOverlayCanvas) return;
    kittyOverlayCtx.clearRect(0, 0, kittyOverlayCanvas.width, kittyOverlayCanvas.height);
    kittyOverlayLastHash = -1;
  }

  function kittyHashInt(hash: number, value: number): number {
    let h = hash >>> 0;
    h ^= value | 0;
    h = Math.imul(h, 16777619) >>> 0;
    return h;
  }

  function kittyHashString(hash: number, value: string): number {
    let h = hash >>> 0;
    for (let i = 0; i < value.length; i += 1) {
      h = kittyHashInt(h, value.charCodeAt(i));
    }
    return h;
  }

  function decodeRawKittyImage(
    placement: KittyPlacement,
    key: string,
    bytes: Uint8Array,
  ): KittyDecodedImage | null {
    const width = placement.imageWidth >>> 0;
    const height = placement.imageHeight >>> 0;
    if (!width || !height || typeof document === "undefined") return null;

    const pixelCount = width * height;
    const out = new Uint8ClampedArray(pixelCount * 4);
    if (placement.imageFormat === KITTY_FMT_GRAY) {
      if (bytes.length < pixelCount) return null;
      for (let i = 0; i < pixelCount; i += 1) {
        const v = bytes[i] ?? 0;
        const o = i * 4;
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
        out[o + 3] = 255;
      }
    } else if (placement.imageFormat === KITTY_FMT_GRAY_ALPHA) {
      if (bytes.length < pixelCount * 2) return null;
      for (let i = 0; i < pixelCount; i += 1) {
        const o = i * 4;
        const s = i * 2;
        const v = bytes[s] ?? 0;
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
        out[o + 3] = bytes[s + 1] ?? 255;
      }
    } else if (placement.imageFormat === KITTY_FMT_RGB) {
      if (bytes.length < pixelCount * 3) return null;
      for (let i = 0; i < pixelCount; i += 1) {
        const o = i * 4;
        const s = i * 3;
        out[o] = bytes[s] ?? 0;
        out[o + 1] = bytes[s + 1] ?? 0;
        out[o + 2] = bytes[s + 2] ?? 0;
        out[o + 3] = 255;
      }
    } else if (placement.imageFormat === KITTY_FMT_RGBA) {
      if (bytes.length < pixelCount * 4) return null;
      out.set(bytes.subarray(0, pixelCount * 4));
    } else {
      return null;
    }

    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const ctx = surface.getContext("2d");
    if (!ctx) return null;
    ctx.putImageData(new ImageData(out, width, height), 0, 0);
    return { key, width, height, source: surface };
  }

  function resolveKittyImage(placement: KittyPlacement): KittyDecodedImage | null {
    if (!wasm) return null;
    const ptr = placement.imageDataPtr >>> 0;
    const len = placement.imageDataLen >>> 0;
    if (!ptr || !len) return null;
    const key = [
      placement.imageId,
      placement.imageFormat,
      placement.imageWidth,
      placement.imageHeight,
      ptr,
      len,
    ].join(":");

    const cached = kittyImageCache.get(placement.imageId);
    if (cached?.key === key) return cached;

    const memory = wasm.memory.buffer;
    if (ptr + len > memory.byteLength) return null;
    const copy = new Uint8Array(len);
    copy.set(new Uint8Array(memory, ptr, len));

    if (placement.imageFormat === KITTY_FMT_PNG) {
      if (kittyDecodePending.has(key)) return null;
      kittyDecodePending.add(key);
      createImageBitmap(new Blob([copy], { type: "image/png" }))
        .then((bitmap) => {
          kittyDecodePending.delete(key);
          const current = kittyImageCache.get(placement.imageId);
          if (current && current.key !== key) releaseKittyImage(current);
          kittyImageCache.set(placement.imageId, {
            key,
            width: bitmap.width,
            height: bitmap.height,
            source: bitmap,
          });
          needsRender = true;
        })
        .catch(() => {
          kittyDecodePending.delete(key);
        });
      return null;
    }

    const decoded = decodeRawKittyImage(placement, key, copy);
    if (!decoded) return null;
    if (cached && cached.key !== key) releaseKittyImage(cached);
    kittyImageCache.set(placement.imageId, decoded);
    return decoded;
  }

  type KittySlice = {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    rawSw: number;
    rawSh: number;
    dx: number;
    dy: number;
    dw: number;
    dh: number;
  };

  function toKittySlice(
    placement: KittyPlacement,
    decoded: KittyDecodedImage,
    cellW: number,
    cellH: number,
  ): KittySlice | null {
    const srcW = decoded.width >>> 0;
    const srcH = decoded.height >>> 0;
    if (!srcW || !srcH) return null;
    if (!placement.width || !placement.height) return null;

    const sxRaw = Math.max(0, Math.min(placement.sourceX >>> 0, srcW));
    const syRaw = Math.max(0, Math.min(placement.sourceY >>> 0, srcH));
    const swMax = Math.max(0, srcW - sxRaw);
    const shMax = Math.max(0, srcH - syRaw);
    let sx = sxRaw;
    let sy = syRaw;
    const rawSw = Math.max(0, Math.min(placement.sourceWidth >>> 0, swMax));
    const rawSh = Math.max(0, Math.min(placement.sourceHeight >>> 0, shMax));
    let sw = rawSw;
    let sh = rawSh;

    // Ghostty can emit zero-sized source slices after integer rounding.
    // Canvas drawImage drops those; sample a 1px edge instead so the slice
    // remains visible and small images don't disappear completely.
    if (sw === 0) {
      sx = Math.min(sxRaw, srcW - 1);
      sw = 1;
    }
    if (sh === 0) {
      sy = Math.min(syRaw, srcH - 1);
      sh = 1;
    }

    const dx = placement.x * cellW + placement.cellOffsetX;
    const dy = placement.y * cellH + placement.cellOffsetY;
    return {
      sx,
      sy,
      sw,
      sh,
      rawSw,
      rawSh,
      dx,
      dy,
      dw: placement.width,
      dh: placement.height,
    };
  }

  function median(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) * 0.5;
  }

  function computeKittyPartialVirtualFallback(
    placements: KittyPlacement[],
    slices: KittySlice[],
    decoded: KittyDecodedImage,
    cellW: number,
    cellH: number,
  ): { dx: number; dy: number; dw: number; dh: number } | null {
    if (!placements.some((p) => p.z === -1)) return null;
    const srcW = decoded.width >>> 0;
    const srcH = decoded.height >>> 0;
    if (!srcW || !srcH) return null;
    const usable = slices.filter((s) => s.rawSw > 0 && s.rawSh > 0 && s.dw > 0 && s.dh > 0);

    let boundMinX = Number.POSITIVE_INFINITY;
    let boundMinY = Number.POSITIVE_INFINITY;
    let boundMaxX = Number.NEGATIVE_INFINITY;
    let boundMaxY = Number.NEGATIVE_INFINITY;
    for (const p of placements) {
      if (!p.width || !p.height) continue;
      const dx = p.x * cellW + p.cellOffsetX;
      const dy = p.y * cellH + p.cellOffsetY;
      boundMinX = Math.min(boundMinX, dx);
      boundMinY = Math.min(boundMinY, dy);
      boundMaxX = Math.max(boundMaxX, dx + p.width);
      boundMaxY = Math.max(boundMaxY, dy + p.height);
    }
    const boundsW = Math.max(0, boundMaxX - boundMinX);
    const boundsH = Math.max(0, boundMaxY - boundMinY);
    const containFromBounds = (): { dx: number; dy: number; dw: number; dh: number } | null => {
      if (!Number.isFinite(boundMinX) || !Number.isFinite(boundMinY)) return null;
      if (!Number.isFinite(boundMaxX) || !Number.isFinite(boundMaxY)) return null;
      if (boundsW <= 0 || boundsH <= 0) return null;
      const scale = Math.min(boundsW / srcW, boundsH / srcH);
      if (!Number.isFinite(scale) || scale <= 0) return null;
      const dw = srcW * scale;
      const dh = srcH * scale;
      const dx = boundMinX + (boundsW - dw) / 2;
      const dy = boundMinY + (boundsH - dh) / 2;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
      if (dw <= 0 || dh <= 0) return null;
      return { dx, dy, dw, dh };
    };
    if (usable.length < 2) {
      return containFromBounds();
    }

    let srcMinX = Number.POSITIVE_INFINITY;
    let srcMaxX = 0;
    let srcMinY = Number.POSITIVE_INFINITY;
    let srcMaxY = 0;
    for (const s of usable) {
      srcMinX = Math.min(srcMinX, s.sx);
      srcMaxX = Math.max(srcMaxX, s.sx + s.rawSw);
      srcMinY = Math.min(srcMinY, s.sy);
      srcMaxY = Math.max(srcMaxY, s.sy + s.rawSh);
    }
    const covX = Math.max(0, srcMaxX - srcMinX) / srcW;
    const covY = Math.max(0, srcMaxY - srcMinY) / srcH;
    // Only recover when we clearly have an incomplete virtual mapping.
    if (covX >= 0.9 && covY >= 0.9) return null;

    const scaleXs: number[] = [];
    const scaleYs: number[] = [];
    const anchorXs: number[] = [];
    const anchorYs: number[] = [];
    for (const s of usable) {
      const scaleX = s.dw / s.rawSw;
      const scaleY = s.dh / s.rawSh;
      if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
        continue;
      }
      scaleXs.push(scaleX);
      scaleYs.push(scaleY);
    }
    if (!scaleXs.length || !scaleYs.length) return null;

    const scaleX = median(scaleXs);
    const scaleY = median(scaleYs);
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
      return null;
    }

    for (const s of usable) {
      anchorXs.push(s.dx - s.sx * scaleX);
      anchorYs.push(s.dy - s.sy * scaleY);
    }
    if (!anchorXs.length || !anchorYs.length) return null;

    const dx = median(anchorXs);
    const dy = median(anchorYs);
    const dw = srcW * scaleX;
    const dh = srcH * scaleY;
    if (
      !Number.isFinite(dx) ||
      !Number.isFinite(dy) ||
      !Number.isFinite(dw) ||
      !Number.isFinite(dh)
    ) {
      return null;
    }
    if (dw <= 0 || dh <= 0) return null;

    // Verify fit: predicted placement should roughly match input placements.
    const xErrs: number[] = [];
    const yErrs: number[] = [];
    for (const s of usable) {
      const px = dx + s.sx * scaleX;
      const py = dy + s.sy * scaleY;
      xErrs.push(Math.abs(px - s.dx));
      yErrs.push(Math.abs(py - s.dy));
    }
    const maxXErr = Math.max(2, cellW * 0.75);
    const maxYErr = Math.max(2, cellH * 0.75);
    if (median(xErrs) > maxXErr || median(yErrs) > maxYErr) {
      return containFromBounds();
    }

    return { dx, dy, dw, dh };
  }

  function drawKittyOverlay(placements: KittyPlacement[], cellW: number, cellH: number) {
    ensureKittyOverlayCanvas();
    syncKittyOverlaySize();
    if (!kittyOverlayCtx || !kittyOverlayCanvas) return;

    if (!placements.length) {
      if (kittyOverlayLastHash !== 0) {
        kittyOverlayCtx.clearRect(0, 0, kittyOverlayCanvas.width, kittyOverlayCanvas.height);
        kittyOverlayLastHash = 0;
      }
      return;
    }

    if (KITTY_OVERLAY_DEBUG) {
      const groups = new Map<number, number>();
      for (const p of placements) {
        groups.set(p.imageId, (groups.get(p.imageId) ?? 0) + 1);
      }
      const sample = placements
        .slice(0, 6)
        .map((p) =>
          [
            `i=${p.imageId}`,
            `fmt=${p.imageFormat}`,
            `xy=${p.x},${p.y}`,
            `wh=${p.width}x${p.height}`,
            `src=${p.sourceX},${p.sourceY},${p.sourceWidth}x${p.sourceHeight}`,
            `off=${p.cellOffsetX},${p.cellOffsetY}`,
            `img=${p.imageWidth}x${p.imageHeight}`,
          ].join(" "),
        )
        .join(" | ");
      const byImage = [...groups.entries()].map(([id, count]) => `${id}:${count}`).join(",");
      const sig = `${placements.length}|${byImage}|${sample}`;
      if (sig !== kittyOverlayDebugLastSig) {
        kittyOverlayDebugLastSig = sig;
        console.log(
          `[kitty-overlay] count=${placements.length} cell=${cellW}x${cellH} images=${byImage} sample=${sample}`,
        );
      }
    }

    const activeImageIds = new Set<number>();
    const grouped = new Map<number, KittyPlacement[]>();
    const order: number[] = [];
    const drawPlans: Array<
      | {
          type: "fallback";
          source: CanvasImageSource;
          sx: number;
          sy: number;
          sw: number;
          sh: number;
          dx: number;
          dy: number;
          dw: number;
          dh: number;
        }
      | { type: "slice"; source: CanvasImageSource; slices: KittySlice[] }
    > = [];
    let hash = 2166136261;
    hash = kittyHashInt(hash, kittyOverlayCanvas.width);
    hash = kittyHashInt(hash, kittyOverlayCanvas.height);
    hash = kittyHashInt(hash, cellW | 0);
    hash = kittyHashInt(hash, cellH | 0);
    hash = kittyHashInt(hash, placements.length);
    for (const placement of placements) {
      activeImageIds.add(placement.imageId);
      hash = kittyHashInt(hash, placement.imageId);
      hash = kittyHashInt(hash, placement.x);
      hash = kittyHashInt(hash, placement.y);
      hash = kittyHashInt(hash, placement.width);
      hash = kittyHashInt(hash, placement.height);
      hash = kittyHashInt(hash, placement.sourceX);
      hash = kittyHashInt(hash, placement.sourceY);
      hash = kittyHashInt(hash, placement.sourceWidth);
      hash = kittyHashInt(hash, placement.sourceHeight);
      hash = kittyHashInt(hash, placement.cellOffsetX);
      hash = kittyHashInt(hash, placement.cellOffsetY);
      hash = kittyHashInt(hash, placement.z);
      let list = grouped.get(placement.imageId);
      if (!list) {
        list = [];
        grouped.set(placement.imageId, list);
        order.push(placement.imageId);
      }
      list.push(placement);
    }

    for (const imageId of order) {
      const group = grouped.get(imageId);
      if (!group?.length) continue;
      const decoded = resolveKittyImage(group[group.length - 1] ?? group[0]!);
      if (!decoded) {
        hash = kittyHashInt(hash, imageId);
        hash = kittyHashInt(hash, -1);
        continue;
      }
      hash = kittyHashInt(hash, imageId);
      hash = kittyHashInt(hash, decoded.width);
      hash = kittyHashInt(hash, decoded.height);
      hash = kittyHashString(hash, decoded.key);

      const slices: KittySlice[] = [];
      for (const placement of group) {
        const slice = toKittySlice(placement, decoded, cellW, cellH);
        if (slice) slices.push(slice);
      }
      if (!slices.length) continue;

      const fallback = computeKittyPartialVirtualFallback(group, slices, decoded, cellW, cellH);
      if (fallback) {
        if (KITTY_OVERLAY_DEBUG) {
          console.log(
            `[kitty-overlay] partial-fallback i=${imageId} draw=${Math.round(fallback.dw)}x${Math.round(fallback.dh)} at ${Math.round(fallback.dx)},${Math.round(fallback.dy)} src=${decoded.width}x${decoded.height}`,
          );
        }
        hash = kittyHashInt(hash, 0xfeed);
        hash = kittyHashInt(hash, Math.round(fallback.dx));
        hash = kittyHashInt(hash, Math.round(fallback.dy));
        hash = kittyHashInt(hash, Math.round(fallback.dw));
        hash = kittyHashInt(hash, Math.round(fallback.dh));
        drawPlans.push({
          type: "fallback",
          source: decoded.source,
          sx: 0,
          sy: 0,
          sw: decoded.width,
          sh: decoded.height,
          dx: fallback.dx,
          dy: fallback.dy,
          dw: fallback.dw,
          dh: fallback.dh,
        });
        continue;
      }

      hash = kittyHashInt(hash, slices.length);
      for (const s of slices) {
        hash = kittyHashInt(hash, s.sx);
        hash = kittyHashInt(hash, s.sy);
        hash = kittyHashInt(hash, s.sw);
        hash = kittyHashInt(hash, s.sh);
        hash = kittyHashInt(hash, Math.round(s.dx));
        hash = kittyHashInt(hash, Math.round(s.dy));
        hash = kittyHashInt(hash, Math.round(s.dw));
        hash = kittyHashInt(hash, Math.round(s.dh));
      }
      drawPlans.push({ type: "slice", source: decoded.source, slices });
    }

    let cacheDirty = false;
    for (const [imageId, entry] of kittyImageCache.entries()) {
      if (activeImageIds.has(imageId)) continue;
      releaseKittyImage(entry);
      kittyImageCache.delete(imageId);
      cacheDirty = true;
    }
    if (!cacheDirty && kittyOverlayLastHash === (hash | 0)) {
      return;
    }

    kittyOverlayCtx.clearRect(0, 0, kittyOverlayCanvas.width, kittyOverlayCanvas.height);
    for (const plan of drawPlans) {
      if (plan.type === "fallback") {
        kittyOverlayCtx.drawImage(
          plan.source,
          plan.sx,
          plan.sy,
          plan.sw,
          plan.sh,
          plan.dx,
          plan.dy,
          plan.dw,
          plan.dh,
        );
        continue;
      }
      for (const s of plan.slices) {
        kittyOverlayCtx.drawImage(plan.source, s.sx, s.sy, s.sw, s.sh, s.dx, s.dy, s.dw, s.dh);
      }
    }
    kittyOverlayLastHash = hash | 0;
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

  function positionToPixel(event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * currentDpr;
    const y = (event.clientY - rect.top) * currentDpr;
    return {
      x: Math.max(1, Math.round(x + 1)),
      y: Math.max(1, Math.round(y + 1)),
    };
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
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const temp = document.createElement("textarea");
        temp.value = text;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(temp);
        }
      }
    },
    onClipboardRead: async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return "";
      }
    },
    getKittyKeyboardFlags: () => {
      if (!wasm || !wasmHandle) return 0;
      return wasm.getKittyKeyboardFlags(wasmHandle);
    },
    onWindowOp: (op) => {
      appendLog(`[term] window op ${op.type} ${op.params.join(";")}`);
    },
  });
  inputHandler!.setMouseMode("auto");

  function clearSelection() {
    clearPendingDesktopSelection();
    selectionState.active = false;
    selectionState.dragging = false;
    selectionState.anchor = null;
    selectionState.focus = null;
    touchSelectionState.activePointerId = null;
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
    if (text === lastReportedPtyStatus) return;
    lastReportedPtyStatus = text;
    if (ptyStatusEl) ptyStatusEl.textContent = text;
    callbacks?.onPtyStatus?.(text);
  }

  function setMouseStatus(text) {
    if (text === lastReportedMouseStatus) return;
    lastReportedMouseStatus = text;
    if (mouseStatusEl) mouseStatusEl.textContent = text;
    callbacks?.onMouseStatus?.(text);
  }

  function updateMouseStatus() {
    if (!inputHandler) return;
    const status = inputHandler.getMouseStatus();
    const label = status.active ? `${status.mode} (${status.detail})` : status.mode;
    setMouseStatus(label);
  }

  function cancelPtyOutputFlush() {
    if (ptyOutputIdleTimer) {
      clearTimeout(ptyOutputIdleTimer);
      ptyOutputIdleTimer = 0;
    }
    if (ptyOutputMaxTimer) {
      clearTimeout(ptyOutputMaxTimer);
      ptyOutputMaxTimer = 0;
    }
  }

  function cancelSyncOutputReset() {
    if (syncOutputResetTimer) {
      clearTimeout(syncOutputResetTimer);
      syncOutputResetTimer = 0;
    }
  }

  function scheduleSyncOutputReset() {
    if (syncOutputResetTimer) return;
    syncOutputResetTimer = setTimeout(() => {
      syncOutputResetTimer = 0;
      if (!inputHandler?.isSynchronizedOutput?.()) return;
      const sanitized = inputHandler.filterOutput(SYNC_OUTPUT_RESET_SEQ) || SYNC_OUTPUT_RESET_SEQ;
      sendInput(sanitized, "pty");
    }, SYNC_OUTPUT_RESET_MS);
  }

  function flushPtyOutputBuffer() {
    const output = ptyOutputBuffer;
    ptyOutputBuffer = "";
    if (!output) return;
    sendInput(output, "pty");
  }

  function queuePtyOutput(text: string) {
    if (!text) return;
    ptyOutputBuffer += text;
    if (ptyOutputIdleTimer) {
      clearTimeout(ptyOutputIdleTimer);
    }
    ptyOutputIdleTimer = setTimeout(() => {
      ptyOutputIdleTimer = 0;
      if (ptyOutputMaxTimer) {
        clearTimeout(ptyOutputMaxTimer);
        ptyOutputMaxTimer = 0;
      }
      flushPtyOutputBuffer();
    }, PTY_OUTPUT_IDLE_MS);

    if (!ptyOutputMaxTimer) {
      ptyOutputMaxTimer = setTimeout(() => {
        ptyOutputMaxTimer = 0;
        if (ptyOutputIdleTimer) {
          clearTimeout(ptyOutputIdleTimer);
          ptyOutputIdleTimer = 0;
        }
        flushPtyOutputBuffer();
      }, PTY_OUTPUT_MAX_MS);
    }
  }

  function disconnectPty() {
    flushPtyOutputBuffer();
    cancelPtyOutputFlush();
    cancelSyncOutputReset();
    ptyOutputBuffer = "";
    ptyTransport.disconnect();
    updateMouseStatus();
    setPtyStatus("disconnected");
  }

  function connectPty(url = "") {
    if (ptyTransport.isConnected()) return;
    setPtyStatus("connecting...");
    try {
      const connectResult = ptyTransport.connect({
        url,
        cols: gridState.cols || 80,
        rows: gridState.rows || 24,
        callbacks: {
          onConnect: () => {
            setPtyStatus("connected");
            updateMouseStatus();
            if (gridState.cols && gridState.rows) {
              ptyTransport.resize(gridState.cols, gridState.rows);
            }
            appendLog("[pty] connected");
          },
          onDisconnect: () => {
            appendLog("[pty] disconnected");
            setPtyStatus("disconnected");
            updateMouseStatus();
          },
          onStatus: (shell) => {
            appendLog(`[pty] shell ${shell ?? ""}`);
          },
          onError: (message, errors) => {
            appendLog(`[pty] error ${message ?? ""}`);
            if (errors) {
              for (const err of errors) appendLog(`[pty] spawn ${err}`);
            }
            disconnectPty();
          },
          onExit: (code) => {
            appendLog(`[pty] exit ${code ?? ""}`);
            disconnectPty();
          },
          onData: (text) => {
            const sanitized = inputHandler ? inputHandler.filterOutput(text) : text;
            updateMouseStatus();
            if (sanitized) queuePtyOutput(sanitized);
          },
        },
      });
      Promise.resolve(connectResult).catch((err) => {
        appendLog(`[pty] error ${err?.message ?? err}`);
        disconnectPty();
      });
    } catch (err) {
      appendLog(`[pty] error ${err?.message ?? err}`);
      disconnectPty();
    }
  }

  function sendKeyInput(text, source = "key") {
    if (!text) return;
    const intercepted = runBeforeInputHook(text, source);
    if (!intercepted) return;
    if (source !== "program" && (selectionState.active || selectionState.dragging)) {
      clearSelection();
    }
    if (ptyTransport.isConnected()) {
      const payload = inputHandler.mapKeyForPty(intercepted);
      ptyTransport.sendInput(payload);
      return;
    }
    sendInput(intercepted, source, { skipHooks: true });
  }

  function formatPasteText(text: string) {
    if (!inputHandler?.isBracketedPaste?.()) return text;
    return `\x1b[200~${text}\x1b[201~`;
  }

  function sendPasteText(text: string) {
    if (!text) return;
    sendKeyInput(formatPasteText(text));
  }

  function sendPastePayloadFromDataTransfer(
    dataTransfer: DataTransfer | null | undefined,
  ): boolean {
    const payload = readPastePayloadFromDataTransfer(dataTransfer);
    if (!payload) return false;
    sendPasteText(payload.text);
    return true;
  }

  function openLink(uri: string) {
    if (!uri || typeof window === "undefined") return;
    try {
      const url = new URL(uri, window.location.href);
      if (!["http:", "https:", "mailto:"].includes(url.protocol)) return;
      const win = window.open(url.toString(), "_blank", "noopener,noreferrer");
      if (win) win.opener = null;
    } catch {
      // ignore invalid URLs
    }
  }

  function getCprPosition() {
    return lastCursorForCpr;
  }

  inputHandler.setCursorProvider(getCprPosition);

  function bindCanvasEvents() {
    if (!attachCanvasEvents) return;
    const shouldRoutePointerToAppMouse = (shiftKey: boolean) => {
      if (shiftKey) return false;
      if (!inputHandler.isMouseActive()) return false;
      return inputHandler.isAltScreen ? inputHandler.isAltScreen() : false;
    };
    // Prefer local drag-selection on primary mouse button; hold Alt to force
    // sending primary-button mouse events to full-screen TUIs.
    const shouldPreferLocalPrimarySelection = (event: PointerEvent) =>
      !isTouchPointer(event) && event.button === 0 && !event.altKey;
    canvas.style.touchAction =
      touchSelectionMode === "long-press" || touchSelectionMode === "drag"
        ? "none"
        : "pan-y pinch-zoom";
    const onPointerDown = (event: PointerEvent) => {
      if (!isTouchPointer(event) && event.button === 0) {
        const layout = getOverlayScrollbarLayout();
        if (layout) {
          const point = pointerToCanvasPx(event);
          if (isPointInScrollbarHitArea(layout, point.x, point.y)) {
            event.preventDefault();
            noteScrollActivity();
            const hitThumb = isPointInScrollbarThumb(layout, point.x, point.y);
            scrollbarDragState.pointerId = event.pointerId;
            scrollbarDragState.thumbGrabRatio = hitThumb
              ? clamp((point.y - layout.thumbY) / Math.max(1, layout.thumbH), 0, 1)
              : 0.5;
            const targetOffset = scrollbarOffsetForPointerY(
              layout,
              point.y,
              scrollbarDragState.thumbGrabRatio,
            );
            setViewportScrollOffset(targetOffset);
            canvas.setPointerCapture?.(event.pointerId);
            return;
          }
        }
      }
      if (
        shouldRoutePointerToAppMouse(event.shiftKey) &&
        !shouldPreferLocalPrimarySelection(event) &&
        inputHandler.sendMouseEvent("down", event)
      ) {
        clearPendingDesktopSelection();
        event.preventDefault();
        canvas.setPointerCapture?.(event.pointerId);
        return;
      }
      if (isTouchPointer(event)) {
        if (event.button !== 0) return;
        const cell = normalizeSelectionCell(positionToCell(event));
        touchSelectionState.activePointerId = null;
        touchSelectionState.panPointerId = null;

        if (touchSelectionMode === "off") return;
        if (touchSelectionMode === "drag") {
          event.preventDefault();
          beginSelectionDrag(cell, event.pointerId);
          return;
        }

        clearPendingTouchSelection();
        touchSelectionState.pendingPointerId = event.pointerId;
        touchSelectionState.pendingCell = cell;
        touchSelectionState.pendingStartedAt = performance.now();
        touchSelectionState.pendingStartX = event.clientX;
        touchSelectionState.pendingStartY = event.clientY;
        touchSelectionState.panPointerId = event.pointerId;
        touchSelectionState.panLastY = event.clientY;
        touchSelectionState.pendingTimer = setTimeout(() => {
          tryActivatePendingTouchSelection(event.pointerId);
        }, touchSelectionLongPressMs);
        return;
      }
      if (event.button !== 0) return;
      event.preventDefault();
      const cell = normalizeSelectionCell(positionToCell(event));
      updateLinkHover(cell);
      desktopSelectionState.pendingPointerId = event.pointerId;
      desktopSelectionState.pendingCell = cell;
      desktopSelectionState.startedWithActiveSelection = selectionState.active;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (scrollbarDragState.pointerId === event.pointerId) {
        const layout = getOverlayScrollbarLayout();
        if (!layout) {
          scrollbarDragState.pointerId = null;
          return;
        }
        const point = pointerToCanvasPx(event);
        const targetOffset = scrollbarOffsetForPointerY(
          layout,
          point.y,
          scrollbarDragState.thumbGrabRatio,
        );
        setViewportScrollOffset(targetOffset);
        event.preventDefault();
        return;
      }
      if (isTouchPointer(event)) {
        if (touchSelectionState.pendingPointerId === event.pointerId) {
          const dx = event.clientX - touchSelectionState.pendingStartX;
          const dy = event.clientY - touchSelectionState.pendingStartY;
          if (dx * dx + dy * dy >= touchSelectionMoveThresholdPx * touchSelectionMoveThresholdPx) {
            clearPendingTouchSelection();
          } else {
            tryActivatePendingTouchSelection(event.pointerId);
          }
          if (touchSelectionState.pendingPointerId === event.pointerId) {
            if (
              touchSelectionMode === "long-press" &&
              touchSelectionState.panPointerId === event.pointerId
            ) {
              const deltaPx = touchSelectionState.panLastY - event.clientY;
              touchSelectionState.panLastY = event.clientY;
              scrollViewportByLines((deltaPx / Math.max(1, gridState.cellH)) * 1.5);
              event.preventDefault();
            }
            return;
          }
        }
        if (selectionState.dragging && touchSelectionState.activePointerId === event.pointerId) {
          const cell = normalizeSelectionCell(positionToCell(event));
          event.preventDefault();
          selectionState.focus = cell;
          updateLinkHover(null);
          updateCanvasCursor();
          needsRender = true;
          return;
        }
        if (
          touchSelectionMode === "long-press" &&
          touchSelectionState.panPointerId === event.pointerId
        ) {
          const deltaPx = touchSelectionState.panLastY - event.clientY;
          touchSelectionState.panLastY = event.clientY;
          scrollViewportByLines((deltaPx / Math.max(1, gridState.cellH)) * 1.5);
          event.preventDefault();
        }
        return;
      }
      const cell = normalizeSelectionCell(positionToCell(event));
      if (
        desktopSelectionState.pendingPointerId === event.pointerId &&
        desktopSelectionState.pendingCell
      ) {
        const anchor = desktopSelectionState.pendingCell;
        if (anchor.row !== cell.row || anchor.col !== cell.col) {
          beginSelectionDrag(anchor, event.pointerId);
          selectionState.focus = cell;
          updateLinkHover(null);
          updateCanvasCursor();
          needsRender = true;
          return;
        }
        updateLinkHover(cell);
        return;
      }
      if (selectionState.dragging) {
        event.preventDefault();
        selectionState.focus = cell;
        updateLinkHover(null);
        updateCanvasCursor();
        needsRender = true;
        return;
      }
      if (
        shouldRoutePointerToAppMouse(event.shiftKey) &&
        inputHandler.sendMouseEvent("move", event)
      ) {
        event.preventDefault();
        return;
      }
      updateLinkHover(cell);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (scrollbarDragState.pointerId === event.pointerId) {
        scrollbarDragState.pointerId = null;
        event.preventDefault();
        return;
      }
      if (isTouchPointer(event)) {
        if (touchSelectionState.pendingPointerId === event.pointerId) {
          clearPendingTouchSelection();
          touchSelectionState.activePointerId = null;
          touchSelectionState.panPointerId = null;
          return;
        }
        if (selectionState.dragging && touchSelectionState.activePointerId === event.pointerId) {
          const cell = normalizeSelectionCell(positionToCell(event));
          event.preventDefault();
          selectionState.dragging = false;
          selectionState.focus = cell;
          touchSelectionState.activePointerId = null;
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
          return;
        }
        if (touchSelectionState.panPointerId === event.pointerId) {
          touchSelectionState.panPointerId = null;
        }
        return;
      }
      const cell = normalizeSelectionCell(positionToCell(event));
      const clearSelectionFromClick =
        desktopSelectionState.pendingPointerId === event.pointerId &&
        desktopSelectionState.startedWithActiveSelection &&
        !selectionState.dragging;
      if (desktopSelectionState.pendingPointerId === event.pointerId) {
        clearPendingDesktopSelection();
      }
      if (clearSelectionFromClick) clearSelection();
      if (selectionState.dragging) {
        event.preventDefault();
        selectionState.dragging = false;
        selectionState.focus = cell;
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
      } else {
        if (
          shouldRoutePointerToAppMouse(event.shiftKey) &&
          !shouldPreferLocalPrimarySelection(event) &&
          inputHandler.sendMouseEvent("up", event)
        ) {
          event.preventDefault();
          return;
        }
        updateLinkHover(cell);
      }
      if (
        !selectionState.active &&
        event.button === 0 &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        inputHandler.isPromptClickEventsEnabled()
      ) {
        const seq = inputHandler.encodePromptClickEvent(cell);
        if (seq) {
          event.preventDefault();
          sendKeyInput(seq);
          return;
        }
      }
      if (!selectionState.active && event.button === 0 && linkState.hoverUri) {
        openLink(linkState.hoverUri);
      }
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (scrollbarDragState.pointerId === event.pointerId) {
        scrollbarDragState.pointerId = null;
      }
      if (desktopSelectionState.pendingPointerId === event.pointerId) {
        clearPendingDesktopSelection();
      }
      if (isTouchPointer(event)) {
        if (touchSelectionState.pendingPointerId === event.pointerId) {
          clearPendingTouchSelection();
        }
        if (touchSelectionState.panPointerId === event.pointerId) {
          touchSelectionState.panPointerId = null;
        }
        if (touchSelectionState.activePointerId === event.pointerId) {
          touchSelectionState.activePointerId = null;
          if (selectionState.dragging) {
            selectionState.dragging = false;
            updateCanvasCursor();
            needsRender = true;
          }
        }
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (shouldRoutePointerToAppMouse(event.shiftKey)) {
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
      scrollViewportByLines(lines * speed);
      event.preventDefault();
    };

    const onContextMenu = (event: MouseEvent) => {
      if (inputHandler.isMouseActive()) event.preventDefault();
    };

    const onPointerLeave = () => {
      updateLinkHover(null);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    cleanupCanvasFns.push(() => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      clearPendingTouchSelection();
      scrollbarDragState.pointerId = null;
    });

    if (imeInput) {
      let suppressNextInput = false;
      const onCompositionStart = (event: CompositionEvent) => {
        imeState.composing = true;
        setPreedit(event.data || imeInput.value || "");
        requestAnimationFrame(syncImeSelection);
      };

      const onCompositionUpdate = (event: CompositionEvent) => {
        setPreedit(event.data || imeInput.value || "");
        requestAnimationFrame(syncImeSelection);
      };

      const onCompositionEnd = (event: CompositionEvent) => {
        imeState.composing = false;
        setPreedit("", true);
        imeState.selectionStart = 0;
        imeState.selectionEnd = 0;
        const text = event.data || "";
        if (text) {
          suppressNextInput = true;
          sendKeyInput(text);
        }
        imeInput.value = "";
      };

      const onBeforeInput = (event: InputEvent) => {
        if (!wasmReady || !wasmHandle) return;
        if (imeState.composing) return;

        if (event.inputType === "insertFromPaste") {
          event.preventDefault();
          suppressNextInput = true;
          const pasteText = event.dataTransfer?.getData("text/plain") || event.data || "";
          if (pasteText) {
            sendPasteText(pasteText);
            imeInput.value = "";
            return;
          }
          sendPastePayloadFromDataTransfer(event.dataTransfer);
          imeInput.value = "";
          return;
        }

        const text = inputHandler.encodeBeforeInput(event);

        if (text) {
          // Safari may emit both keydown and beforeinput for control keys.
          // If we just sent the same sequence from keydown, drop this duplicate.
          const now = performance.now();
          if (
            lastKeydownSeq &&
            text === lastKeydownSeq &&
            now - lastKeydownSeqAt <= KEYDOWN_BEFOREINPUT_DEDUPE_MS
          ) {
            event.preventDefault();
            suppressNextInput = true;
            imeInput.value = "";
            return;
          }
          event.preventDefault();
          suppressNextInput = true;
          sendKeyInput(text);
          imeInput.value = "";
        }
      };

      const onInput = (event: InputEvent) => {
        if (!wasmReady || !wasmHandle) return;
        if (imeState.composing) return;
        if (suppressNextInput) {
          suppressNextInput = false;
          imeInput.value = "";
          return;
        }
        const text = (event as InputEvent).data || imeInput.value;
        if (text) {
          sendKeyInput(text);
          imeInput.value = "";
        }
      };

      const onPaste = (event: ClipboardEvent) => {
        if (!wasmReady || !wasmHandle) return;
        event.preventDefault();
        suppressNextInput = true;
        const text = event.clipboardData?.getData("text/plain") || "";
        if (text) {
          sendPasteText(text);
          imeInput.value = "";
          return;
        }
        sendPastePayloadFromDataTransfer(event.clipboardData);
        imeInput.value = "";
      };

      imeInput.addEventListener("compositionstart", onCompositionStart);
      imeInput.addEventListener("compositionupdate", onCompositionUpdate);
      imeInput.addEventListener("compositionend", onCompositionEnd);
      imeInput.addEventListener("beforeinput", onBeforeInput);
      imeInput.addEventListener("input", onInput);
      imeInput.addEventListener("paste", onPaste);
      cleanupCanvasFns.push(() => {
        imeInput.removeEventListener("compositionstart", onCompositionStart);
        imeInput.removeEventListener("compositionupdate", onCompositionUpdate);
        imeInput.removeEventListener("compositionend", onCompositionEnd);
        imeInput.removeEventListener("beforeinput", onBeforeInput);
        imeInput.removeEventListener("input", onInput);
        imeInput.removeEventListener("paste", onPaste);
      });
    }
  }

  bindCanvasEvents();
  bindFocusEvents();

  const fontState: FontManagerState = {
    font: null,
    fonts: [],
    fontSizePx: 0,
    sizeMode: options.fontSizeMode === "em" ? "em" : "height",
    fontPickCache: new Map(),
  };

  const fontConfig = {
    sizePx: Number.isFinite(options.fontSize) ? Math.max(1, Math.round(options.fontSize!)) : 18,
  };

  const FONT_SCALE_OVERRIDES = options.fontScaleOverrides ?? [];

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

  function formatCodepoint(cp) {
    const hex = cp.toString(16).toUpperCase();
    return `U+${hex.padStart(4, "0")}`;
  }

  function atlasRegionToImageData(atlas, x, y, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    const pixelMode = atlas.bitmap?.pixelMode ?? PixelMode.Gray;
    const rgbaBitmap = pixelMode === (PixelMode.RGBA ?? 4) || pixelMode === 4;
    for (let row = 0; row < height; row += 1) {
      const dstRow = row * width * 4;
      if (rgbaBitmap) {
        const srcRow = (y + row) * atlas.bitmap.pitch + x * 4;
        for (let col = 0; col < width; col += 1) {
          const srcIdx = srcRow + col * 4;
          const dstIdx = dstRow + col * 4;
          rgba[dstIdx] = atlas.bitmap.buffer[srcIdx] ?? 0;
          rgba[dstIdx + 1] = atlas.bitmap.buffer[srcIdx + 1] ?? 0;
          rgba[dstIdx + 2] = atlas.bitmap.buffer[srcIdx + 2] ?? 0;
          rgba[dstIdx + 3] = atlas.bitmap.buffer[srcIdx + 3] ?? 0;
        }
        continue;
      }
      const srcRow = (y + row) * atlas.bitmap.pitch + x;
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

  function padAtlasRGBA(rgba: Uint8Array, atlas: any, padding: number): Uint8Array {
    if (!padding || padding <= 0 || !atlas?.glyphs) return rgba;
    const width = atlas.bitmap?.width ?? 0;
    const height = atlas.bitmap?.rows ?? 0;
    if (!width || !height) return rgba;
    const out = new Uint8Array(rgba);
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const writePixel = (dstX: number, dstY: number, srcX: number, srcY: number) => {
      if (dstX < 0 || dstY < 0 || dstX >= width || dstY >= height) return;
      if (srcX < 0 || srcY < 0 || srcX >= width || srcY >= height) return;
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (dstY * width + dstX) * 4;
      out[dstIdx] = out[srcIdx];
      out[dstIdx + 1] = out[srcIdx + 1];
      out[dstIdx + 2] = out[srcIdx + 2];
      out[dstIdx + 3] = out[srcIdx + 3];
    };

    const padMetrics = (metrics: any) => {
      const x0 = metrics.atlasX;
      const y0 = metrics.atlasY;
      const x1 = metrics.atlasX + metrics.width - 1;
      const y1 = metrics.atlasY + metrics.height - 1;
      if (x0 < 0 || y0 < 0 || x1 < x0 || y1 < y0) return;
      const pad = padding;

      for (let y = y0; y <= y1; y += 1) {
        for (let px = 1; px <= pad; px += 1) {
          writePixel(x0 - px, y, x0, y);
          writePixel(x1 + px, y, x1, y);
        }
      }
      for (let x = x0 - pad; x <= x1 + pad; x += 1) {
        const clampedX = clamp(x, 0, width - 1);
        for (let py = 1; py <= pad; py += 1) {
          writePixel(clampedX, y0 - py, clampedX, y0);
          writePixel(clampedX, y1 + py, clampedX, y1);
        }
      }
    };

    for (const metrics of atlas.glyphs.values()) {
      padMetrics(metrics);
    }

    const glyphsByWidth = atlas.glyphsByWidth;
    if (glyphsByWidth && typeof glyphsByWidth.values === "function") {
      for (const map of glyphsByWidth.values()) {
        if (!map?.values) continue;
        for (const metrics of map.values()) {
          padMetrics(metrics);
        }
      }
    }

    return out;
  }

  function bitmapBytesPerPixel(pixelMode: number): number {
    if (pixelMode === 2 || pixelMode === 3) return 3;
    if (pixelMode === 4) return 4;
    return 1;
  }

  function resolveGlyphPixelMode(entry: FontEntry): number {
    const colorMode = PixelMode.RGBA;
    if (colorMode !== undefined && colorMode !== null && isColorEmojiFont(entry)) {
      return colorMode;
    }
    return PixelMode.Gray;
  }

  function atlasBitmapToRGBA(atlas: any): Uint8Array | null {
    const bitmap = atlas?.bitmap;
    if (!bitmap?.width || !bitmap?.rows) return null;
    const rgbaMode = PixelMode.RGBA ?? 4;
    if (bitmap.pixelMode === rgbaMode || bitmap.pixelMode === 4) {
      const width = bitmap.width;
      const height = bitmap.rows;
      const rgba = new Uint8Array(width * height * 4);
      for (let row = 0; row < height; row += 1) {
        const srcStart = row * bitmap.pitch;
        const srcEnd = srcStart + width * 4;
        const dstStart = row * width * 4;
        rgba.set(bitmap.buffer.subarray(srcStart, srcEnd), dstStart);
      }
      return rgba;
    }
    return atlasToRGBA(atlas);
  }

  function getColorGlyphContext(): CanvasRenderingContext2D | null {
    if (colorGlyphCtx) return colorGlyphCtx;
    if (typeof document === "undefined") return null;
    colorGlyphCanvas = document.createElement("canvas");
    colorGlyphCtx = colorGlyphCanvas.getContext("2d", { willReadFrequently: true });
    return colorGlyphCtx;
  }

  function resolveColorGlyphFontCss(entry: FontEntry, fontSize: number): string {
    const label = String(entry.label ?? "")
      .split("(")[0]
      .trim()
      .replace(/"/g, '\\"');
    const families: string[] = [];
    if (label && !/openmoji/i.test(label)) {
      families.push(`"${label}"`);
    }
    families.push(COLOR_EMOJI_FONT_STACK);
    return `${Math.max(1, Math.round(fontSize))}px ${families.join(",")}`;
  }

  function rasterizeColorGlyphWithCanvas(
    entry: FontEntry,
    text: string,
    fontSize: number,
  ): { bitmap: any; bearingX: number; bearingY: number } | null {
    if (!text) return null;
    const ctx = getColorGlyphContext();
    if (!ctx) return null;
    const rgbaMode = PixelMode.RGBA ?? 4;
    const fontCss = resolveColorGlyphFontCss(entry, fontSize);

    ctx.save();
    ctx.font = fontCss;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const metrics = ctx.measureText(text);
    const left = Math.max(0, metrics.actualBoundingBoxLeft ?? 0);
    const right = Math.max(1, metrics.actualBoundingBoxRight ?? metrics.width ?? 1);
    const ascent = Math.max(1, metrics.actualBoundingBoxAscent ?? fontSize * 0.8);
    const descent = Math.max(0, metrics.actualBoundingBoxDescent ?? fontSize * 0.2);
    const width = Math.max(1, Math.ceil(left + right + 1));
    const height = Math.max(1, Math.ceil(ascent + descent + 1));

    if (!colorGlyphCanvas) {
      ctx.restore();
      return null;
    }
    if (colorGlyphCanvas.width !== width || colorGlyphCanvas.height !== height) {
      colorGlyphCanvas.width = width;
      colorGlyphCanvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.font = fontCss;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.fillText(text, left, ascent);
    const image = ctx.getImageData(0, 0, width, height);
    ctx.restore();

    return {
      bitmap: {
        width,
        rows: height,
        pitch: width * 4,
        buffer: new Uint8Array(image.data),
        pixelMode: rgbaMode,
        numGrays: 256,
      },
      bearingX: -left,
      bearingY: ascent,
    };
  }

  function buildColorEmojiAtlasWithCanvas(options: {
    font: any;
    fontEntry: FontEntry;
    glyphIds: number[];
    fontSize: number;
    sizeMode: string;
    padding: number;
    maxWidth: number;
    maxHeight: number;
    pixelMode: number;
  }) {
    const {
      font,
      fontEntry,
      glyphIds,
      fontSize,
      sizeMode,
      padding,
      maxWidth,
      maxHeight,
      pixelMode,
    } = options;
    const rgbaMode = PixelMode.RGBA ?? 4;
    if (pixelMode !== rgbaMode && pixelMode !== 4) return null;
    if (!fontEntry.colorGlyphTexts?.size) return null;

    const scale = resolveFontScaleForAtlas(font, fontSize, sizeMode);
    const glyphData: Array<{
      glyphId: number;
      bitmap: any;
      bearingX: number;
      bearingY: number;
      advance: number;
    }> = [];

    for (let i = 0; i < glyphIds.length; i += 1) {
      const glyphId = glyphIds[i];
      const text = fontEntry.colorGlyphTexts.get(glyphId);
      if (!text) continue;
      const raster = rasterizeColorGlyphWithCanvas(fontEntry, text, fontSize);
      if (!raster) continue;
      glyphData.push({
        glyphId,
        bitmap: raster.bitmap,
        bearingX: raster.bearingX,
        bearingY: raster.bearingY,
        advance: font.advanceWidth(glyphId) * scale,
      });
    }

    if (!glyphData.length) return null;

    glyphData.sort((a, b) => (b.bitmap?.rows ?? 0) - (a.bitmap?.rows ?? 0));
    const {
      width: atlasWidth,
      height: atlasHeight,
      placements,
    } = packGlyphs(
      glyphData.map((g) => ({
        width: (g.bitmap?.width ?? 0) + padding * 2,
        height: (g.bitmap?.rows ?? 0) + padding * 2,
      })),
      maxWidth,
      maxHeight,
    );
    const atlasBitmap = createAtlasBitmap(atlasWidth, atlasHeight, rgbaMode);
    const glyphMetrics = new Map<number, any>();

    for (let i = 0; i < glyphData.length; i += 1) {
      const glyph = glyphData[i];
      const placement = placements[i];
      if (!placement?.placed || !glyph.bitmap) continue;
      copyBitmapToAtlas(glyph.bitmap, atlasBitmap, placement.x + padding, placement.y + padding);
      glyphMetrics.set(glyph.glyphId, {
        glyphId: glyph.glyphId,
        atlasX: placement.x + padding,
        atlasY: placement.y + padding,
        width: glyph.bitmap.width,
        height: glyph.bitmap.rows,
        bearingX: glyph.bearingX,
        bearingY: glyph.bearingY,
        advance: glyph.advance,
      });
    }

    return {
      atlas: {
        bitmap: atlasBitmap,
        glyphs: glyphMetrics,
        glyphsByWidth: new Map<number, Map<number, any>>(),
        fontSize,
        colorGlyphs: new Set<number>(glyphMetrics.keys()),
      },
      constrainedGlyphWidths: null,
    };
  }

  function createAtlasBitmap(width: number, height: number, pixelMode: number) {
    const bytesPerPixel = bitmapBytesPerPixel(pixelMode);
    const pitch = Math.max(1, Math.ceil(width * bytesPerPixel));
    const size = pitch * height;
    return {
      width,
      rows: height,
      pitch,
      buffer: new Uint8Array(size),
      pixelMode,
      numGrays: pixelMode === 0 ? 2 : 256,
    };
  }

  function cloneBitmap(bitmap: any) {
    const pitch = bitmap?.pitch ?? 0;
    const rows = bitmap?.rows ?? 0;
    const size = pitch * rows;
    const buffer = new Uint8Array(size);
    if (bitmap?.buffer) {
      buffer.set(bitmap.buffer.subarray(0, size));
    }
    return {
      width: bitmap?.width ?? 0,
      rows,
      pitch,
      buffer,
      pixelMode: bitmap?.pixelMode ?? PixelMode.Gray,
      numGrays: bitmap?.numGrays ?? 256,
    };
  }

  function copyBitmapToAtlas(src: any, dst: any, dstX: number, dstY: number): void {
    const bytesPerPixel = bitmapBytesPerPixel(src.pixelMode ?? 1);
    const rowBytes = src.width * bytesPerPixel;
    for (let y = 0; y < src.rows; y += 1) {
      const srcRow = y * src.pitch;
      const dstRow = (dstY + y) * dst.pitch + dstX * bytesPerPixel;
      dst.buffer.set(src.buffer.subarray(srcRow, srcRow + rowBytes), dstRow);
    }
  }

  function nextPowerOf2(n: number): number {
    if (n <= 0) return 1;
    let v = n - 1;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    return v + 1;
  }

  function packGlyphs(
    sizes: Array<{ width: number; height: number }>,
    maxWidth: number,
    maxHeight: number,
  ) {
    const shelves: Array<{ y: number; height: number; width: number }> = [];
    const placements: Array<{ x: number; y: number; placed: boolean }> = [];
    let atlasWidth = 0;
    let atlasHeight = 0;

    for (let i = 0; i < sizes.length; i += 1) {
      const size = sizes[i];
      let placed = false;
      let bestShelf = -1;
      let bestY = maxHeight;

      for (let j = 0; j < shelves.length; j += 1) {
        const shelf = shelves[j];
        if (shelf.width + size.width <= maxWidth && size.height <= shelf.height) {
          if (shelf.y < bestY) {
            bestShelf = j;
            bestY = shelf.y;
          }
        }
      }

      if (bestShelf >= 0) {
        const shelf = shelves[bestShelf];
        placements.push({ x: shelf.width, y: shelf.y, placed: true });
        shelf.width += size.width;
        atlasWidth = Math.max(atlasWidth, shelf.width);
        placed = true;
      } else {
        const newY = atlasHeight;
        if (newY + size.height <= maxHeight && size.width <= maxWidth) {
          shelves.push({ y: newY, height: size.height, width: size.width });
          placements.push({ x: 0, y: newY, placed: true });
          atlasHeight = newY + size.height;
          atlasWidth = Math.max(atlasWidth, size.width);
          placed = true;
        }
      }

      if (!placed) placements.push({ x: 0, y: 0, placed: false });
    }

    const finalWidth = nextPowerOf2(atlasWidth);
    const finalHeight = nextPowerOf2(atlasHeight);
    return {
      width: Math.min(finalWidth, maxWidth),
      height: Math.min(finalHeight, maxHeight),
      placements,
    };
  }

  function resolveFontScaleForAtlas(font: any, fontSize: number, sizeMode?: string | null): number {
    if (font && typeof font.scaleForSize === "function") {
      return font.scaleForSize(fontSize, sizeMode ?? undefined);
    }
    const upem = font?.unitsPerEm ?? font?.upem ?? 1000;
    return upem > 0 ? fontSize / upem : 1;
  }

  function fontCapHeightUnits(font: any): number {
    if (!font) return 1;

    const capFromOs2 = font?.os2?.sCapHeight ?? font?._os2?.sCapHeight;
    if (Number.isFinite(capFromOs2) && capFromOs2 > 0) return capFromOs2;

    if (typeof font.glyphIdForChar === "function" && typeof font.getGlyphBounds === "function") {
      const capGlyphId = font.glyphIdForChar("H");
      if (capGlyphId !== undefined && capGlyphId !== null && capGlyphId !== 0) {
        const bounds = font.getGlyphBounds(capGlyphId);
        const yMax = bounds?.yMax;
        if (Number.isFinite(yMax) && yMax > 0) return yMax;
        const height = (bounds?.yMax ?? 0) - (bounds?.yMin ?? 0);
        if (Number.isFinite(height) && height > 0) return height;
      }
    }

    const ascender = font?.ascender;
    if (Number.isFinite(ascender) && ascender > 0) return ascender * 0.75;

    const faceHeight = fontHeightUnits(font);
    if (Number.isFinite(faceHeight) && faceHeight > 0) return faceHeight * 0.6;

    return 1;
  }

  function buildNerdMetrics(
    cellW: number,
    cellH: number,
    lineHeight: number,
    primaryFont: any,
    primaryScale: number,
    iconScale: number,
  ) {
    let faceWidth = cellW;
    if (
      primaryFont &&
      typeof primaryFont.glyphIdForChar === "function" &&
      typeof primaryFont.advanceWidth === "function"
    ) {
      const mGlyphId = primaryFont.glyphIdForChar("M");
      if (mGlyphId !== undefined && mGlyphId !== null && mGlyphId !== 0) {
        const width = primaryFont.advanceWidth(mGlyphId) * primaryScale;
        if (Number.isFinite(width) && width > 0) faceWidth = width;
      }
    }

    const capHeight = fontCapHeightUnits(primaryFont) * primaryScale;
    const safeIconScale = Number.isFinite(iconScale) ? Math.max(0.5, Math.min(2, iconScale)) : 1;
    const iconHeight = lineHeight * safeIconScale;
    const iconHeightSingle = clamp(
      ((2 * capHeight + lineHeight) / 3) * safeIconScale,
      1,
      iconHeight,
    );

    return {
      cellWidth: cellW,
      cellHeight: cellH,
      faceWidth,
      faceHeight: lineHeight,
      faceY: (cellH - lineHeight) * 0.5,
      iconHeight,
      iconHeightSingle,
    };
  }

  const NERD_CELL_FIT_COVER_SCALE = 1.0;
  const NERD_ICON_FIT_COVER_SCALE = 2 / 3;

  function nerdConstraintSignature(
    glyphMeta?: Map<number, GlyphConstraintMeta>,
    constraintContext?: AtlasConstraintContext | null,
  ): string {
    if (!glyphMeta?.size || !constraintContext) return "";
    const m = constraintContext.nerdMetrics;
    return [
      `ih:${m.iconHeight.toFixed(3)}`,
      `ih1:${m.iconHeightSingle.toFixed(3)}`,
      `iw:${m.cellWidth.toFixed(3)}`,
      `cw:${constraintContext.cellW.toFixed(3)}`,
      `ch:${constraintContext.cellH.toFixed(3)}`,
      `is:${NERD_ICON_FIT_COVER_SCALE.toFixed(4)}`,
      `cs:${NERD_CELL_FIT_COVER_SCALE.toFixed(4)}`,
    ].join("|");
  }

  function scaleGlyphBoxAroundCenter(
    box: { x: number; y: number; width: number; height: number },
    factor: number,
  ) {
    if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-6) return box;
    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.5;
    const w = box.width * factor;
    const h = box.height * factor;
    return {
      x: cx - w * 0.5,
      y: cy - h * 0.5,
      width: w,
      height: h,
    };
  }

  function scaleGlyphBoxAnchoredLeft(
    box: { x: number; y: number; width: number; height: number },
    factor: number,
  ) {
    if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-6) return box;
    const w = box.width * factor;
    const h = box.height * factor;
    return {
      x: box.x,
      y: box.y + (box.height - h) * 0.5,
      width: w,
      height: h,
    };
  }

  function tightenNerdConstraintBox(
    box: { x: number; y: number; width: number; height: number },
    constraint: any,
  ) {
    if (!constraint) return box;
    if (constraint.size !== "fit_cover1") return box;
    if (constraint.height === "icon") {
      return scaleGlyphBoxAnchoredLeft(box, NERD_ICON_FIT_COVER_SCALE);
    }
    if (constraint.height !== undefined && constraint.height !== "cell") return box;
    return scaleGlyphBoxAroundCenter(box, NERD_CELL_FIT_COVER_SCALE);
  }

  function buildGlyphAtlasWithConstraints(options: {
    font: any;
    glyphIds: number[];
    fontSize: number;
    sizeMode: string;
    padding: number;
    maxWidth: number;
    maxHeight: number;
    pixelMode: number;
    hinting: boolean;
    rasterizeGlyph?: (
      font: any,
      glyphId: number,
      fontSize: number,
      options?: any,
    ) => { bitmap: any; bearingX: number; bearingY: number } | null;
    rasterizeGlyphWithTransform?: (
      font: any,
      glyphId: number,
      fontSize: number,
      matrix: number[] | number[][],
      options?: any,
    ) => { bitmap: any; bearingX: number; bearingY: number } | null;
    glyphMeta?: Map<number, GlyphConstraintMeta>;
    constraintContext?: AtlasConstraintContext;
  }) {
    const {
      font,
      glyphIds,
      fontSize,
      sizeMode,
      padding,
      maxWidth,
      maxHeight,
      pixelMode,
      hinting,
      rasterizeGlyph,
      rasterizeGlyphWithTransform,
      glyphMeta,
      constraintContext,
    } = options;

    const scale = resolveFontScaleForAtlas(font, fontSize, sizeMode);
    const glyphData: Array<{
      glyphId: number;
      bitmap: any;
      bearingX: number;
      bearingY: number;
      advance: number;
      constraintWidth: number;
    }> = [];

    if (!rasterizeGlyph) {
      return { atlas: null, constrainedGlyphWidths: null };
    }

    const rasterOptions = {
      padding: 0,
      pixelMode,
      sizeMode,
      hinting,
    };

    for (let i = 0; i < glyphIds.length; i += 1) {
      const glyphId = glyphIds[i];
      let raster = rasterizeGlyph(font, glyphId, fontSize, rasterOptions);
      if (!raster) continue;

      let didConstraint = false;
      const meta = glyphMeta?.get(glyphId);
      const widthSet =
        meta?.widths && meta.widths.size
          ? Array.from(meta.widths.values())
          : [Math.max(1, meta?.constraintWidth ?? 1)];
      const widths = Array.from(new Set(widthSet.map((w) => Math.max(1, w)))).sort();
      const constraint = meta?.cp ? getNerdConstraint(meta.cp) : null;

      if (constraint && constraintContext && rasterizeGlyphWithTransform) {
        for (const constraintWidth of widths) {
          const maxCellWidth = constraintContext.cellW * constraintWidth;
          const maxCellHeight = constraintContext.cellH;
          let bitmapScale = 1;

          const widthUnits = glyphWidthUnits(constraintContext.fontEntry, glyphId);
          let glyphWidthPx = widthUnits * constraintContext.fontScale;
          if (!Number.isFinite(glyphWidthPx) || glyphWidthPx <= 0) {
            glyphWidthPx = raster.bitmap?.width ?? 0;
          }
          if (glyphWidthPx > 0 && maxCellWidth > 0) {
            const fit = maxCellWidth / glyphWidthPx;
            if (fit > 0 && fit < 1) bitmapScale = fit;
          }

          let gw = (raster.bitmap?.width ?? 0) * bitmapScale;
          let gh = (raster.bitmap?.rows ?? 0) * bitmapScale;
          if (gw > 0 && gh > 0 && maxCellWidth > 0 && maxCellHeight > 0) {
            const fitScale = Math.min(1, maxCellWidth / gw, maxCellHeight / gh);
            if (fitScale < 1) {
              bitmapScale *= fitScale;
              gw *= fitScale;
              gh *= fitScale;
            }
          }

          const baseY =
            constraintContext.yPad +
            constraintContext.baselineOffset +
            constraintContext.baselineAdjust;
          const scaledBox = {
            x: raster.bearingX * bitmapScale,
            y: baseY - raster.bearingY * bitmapScale,
            width: gw,
            height: gh,
          };
          const adjusted = constrainGlyphBox(
            scaledBox,
            constraint,
            constraintContext.nerdMetrics,
            constraintWidth,
          );
          const tightened = tightenNerdConstraintBox(adjusted, constraint);

          if (
            tightened.width > 0 &&
            tightened.height > 0 &&
            raster.bitmap?.width &&
            raster.bitmap?.rows
          ) {
            const targetLeft = tightened.x;
            const targetTop = baseY - tightened.y;
            const scaleX = tightened.width / raster.bitmap.width;
            const scaleY = tightened.height / raster.bitmap.rows;
            if (Number.isFinite(scaleX) && scaleX > 0 && Number.isFinite(scaleY) && scaleY > 0) {
              const tx = targetLeft - raster.bearingX * scaleX;
              const ty = targetTop - raster.bearingY * scaleY;
              const transformed = rasterizeGlyphWithTransform(
                font,
                glyphId,
                fontSize,
                [scaleX, 0, 0, scaleY, tx, ty],
                rasterOptions,
              );
              if (transformed) {
                glyphData.push({
                  glyphId,
                  bitmap: cloneBitmap(transformed.bitmap),
                  bearingX: transformed.bearingX,
                  bearingY: transformed.bearingY,
                  advance: font.advanceWidth(glyphId) * scale,
                  constraintWidth,
                });
                didConstraint = true;
              }
            }
          }
        }
      }

      if (!didConstraint) {
        const advance = font.advanceWidth(glyphId) * scale;
        glyphData.push({
          glyphId,
          bitmap: cloneBitmap(raster.bitmap),
          bearingX: raster.bearingX,
          bearingY: raster.bearingY,
          advance,
          constraintWidth: 0,
        });
      }
    }

    glyphData.sort((a, b) => (b.bitmap?.rows ?? 0) - (a.bitmap?.rows ?? 0));

    const {
      width: atlasWidth,
      height: atlasHeight,
      placements,
    } = packGlyphs(
      glyphData.map((g) => ({
        width: (g.bitmap?.width ?? 0) + padding * 2,
        height: (g.bitmap?.rows ?? 0) + padding * 2,
      })),
      maxWidth,
      maxHeight,
    );

    const atlas = createAtlasBitmap(atlasWidth, atlasHeight, pixelMode);
    const glyphMetrics = new Map();

    const glyphMetricsByWidth = new Map<number, Map<number, any>>();

    for (let i = 0; i < glyphData.length; i += 1) {
      const glyph = glyphData[i];
      const placement = placements[i];
      if (!placement?.placed || !glyph.bitmap) continue;
      copyBitmapToAtlas(glyph.bitmap, atlas, placement.x + padding, placement.y + padding);
      const metrics = {
        glyphId: glyph.glyphId,
        atlasX: placement.x + padding,
        atlasY: placement.y + padding,
        width: glyph.bitmap.width,
        height: glyph.bitmap.rows,
        bearingX: glyph.bearingX,
        bearingY: glyph.bearingY,
        advance: glyph.advance,
      };
      const widthKey = glyph.constraintWidth ?? 0;
      if (widthKey > 0) {
        let widthMap = glyphMetricsByWidth.get(widthKey);
        if (!widthMap) {
          widthMap = new Map();
          glyphMetricsByWidth.set(widthKey, widthMap);
        }
        widthMap.set(glyph.glyphId, metrics);
        if (!glyphMetrics.has(glyph.glyphId) || widthKey === 1) {
          glyphMetrics.set(glyph.glyphId, metrics);
        }
      } else {
        if (!glyphMetrics.has(glyph.glyphId)) {
          glyphMetrics.set(glyph.glyphId, metrics);
        }
      }
    }

    return {
      atlas: {
        bitmap: atlas,
        glyphs: glyphMetrics,
        glyphsByWidth: glyphMetricsByWidth,
        fontSize,
      },
      constrainedGlyphWidths: null,
    };
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
      console.log(
        `  Font ${idx}: "${label}" isSymbolFont=${isSym} hasGlyph=${hasGlyph} glyphId=${glyphId}`,
      );
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
        console.log(
          `  Glyph ${i}: id=${g.glyphId} xAdvance=${g.xAdvance} xOffset=${g.xOffset} yOffset=${g.yOffset}`,
        );
      });
    }

    // Check constraint
    const constraint = getNerdConstraint(cp);
    console.log(`Nerd constraint:`, constraint || "none");

    console.groupEnd();
  }

  // Expose diagnostic to window for debugging
  if (debugExpose && typeof window !== "undefined") {
    const debugWindow = window as ResttyDebugWindow;
    debugWindow.diagnoseCodepoint = diagnoseCodepoint;
    debugWindow.dumpGlyphMetrics = (cp: number) => {
      const text = String.fromCodePoint(cp);
      const fontIndex = pickFontIndexForText(text, 1);
      const entry = fontState.fonts[fontIndex];
      if (!entry?.font || !entry.atlas) {
        console.warn("font/atlas not ready");
        return null;
      }
      const glyphId = entry.font.glyphIdForChar(text);
      const atlas = entry.atlas;
      const atlasW = atlas.bitmap.width;
      const atlasH = atlas.bitmap.rows;
      const report = (label: string, metrics: any) => {
        if (!metrics) {
          console.log(`${label}: missing`);
          return;
        }
        const u0 = metrics.atlasX / atlasW;
        const v0 = metrics.atlasY / atlasH;
        const u1 = (metrics.atlasX + metrics.width) / atlasW;
        const v1 = (metrics.atlasY + metrics.height) / atlasH;
        console.log(`${label}:`, {
          glyphId,
          atlasX: metrics.atlasX,
          atlasY: metrics.atlasY,
          width: metrics.width,
          height: metrics.height,
          bearingX: metrics.bearingX,
          bearingY: metrics.bearingY,
          u0,
          v0,
          u1,
          v1,
          atlasW,
          atlasH,
        });
      };
      console.group(`Glyph metrics U+${cp.toString(16).toUpperCase()}`);
      report("default", atlas.glyphs.get(glyphId));
      if (atlas.glyphsByWidth) {
        report("width=1", atlas.glyphsByWidth.get(1)?.get(glyphId));
        report("width=2", atlas.glyphsByWidth.get(2)?.get(glyphId));
      }
      console.groupEnd();
      return { fontIndex, glyphId };
    };

    debugWindow.dumpAtlasRegion = async (
      fontIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const state = activeState;
      if (!state || !("device" in state)) {
        console.warn("WebGPU not active");
        return null;
      }
      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!atlasState) {
        console.warn("atlas not ready");
        return null;
      }
      const device = state.device;
      const bytesPerRow = width * 4;
      const alignedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
      const buffer = device.createBuffer({
        size: alignedBytesPerRow * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        { texture: atlasState.texture, origin: { x, y } },
        { buffer, bytesPerRow: alignedBytesPerRow, rowsPerImage: height },
        { width, height, depthOrArrayLayers: 1 },
      );
      device.queue.submit([encoder.finish()]);
      await buffer.mapAsync(GPUMapMode.READ);
      const mapped = new Uint8Array(buffer.getMappedRange());
      const out = new Uint8ClampedArray(width * height * 4);
      for (let row = 0; row < height; row += 1) {
        const srcStart = row * alignedBytesPerRow;
        const srcEnd = srcStart + bytesPerRow;
        const dstStart = row * bytesPerRow;
        out.set(mapped.subarray(srcStart, srcEnd), dstStart);
      }
      buffer.unmap();
      const image = new ImageData(out, width, height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.putImageData(image, 0, 0);
      canvas.style.border = "1px solid #555";
      canvas.style.margin = "6px";
      document.body.appendChild(canvas);
      return image;
    };

    debugWindow.dumpGlyphRender = async (cp: number, constraintWidth = 1) => {
      const state = activeState;
      if (!state || !("device" in state)) {
        console.warn("WebGPU not active");
        return null;
      }
      const text = String.fromCodePoint(cp);
      const span = Math.max(1, constraintWidth || 1);
      const fontIndex = pickFontIndexForText(text, span);
      const entry = fontState.fonts[fontIndex];
      if (!entry?.font) {
        console.warn("font not ready");
        return null;
      }
      const glyphId = entry.font.glyphIdForChar(text);
      if (!glyphId) {
        console.warn("missing glyph");
        return null;
      }

      const cellW = gridState.cellW || canvas.width / Math.max(1, gridState.cols || 1);
      const cellH = gridState.cellH || canvas.height / Math.max(1, gridState.rows || 1);
      const fontSizePx = gridState.fontSizePx || fontConfig.sizePx;
      const primaryEntry = fontState.fonts[0];
      const primaryScale = primaryEntry?.font
        ? primaryEntry.font.scaleForSize(fontSizePx, fontState.sizeMode)
        : 1;
      const lineHeight = primaryEntry?.font
        ? fontHeightUnits(primaryEntry.font) * primaryScale
        : cellH;
      const baselineOffset = primaryEntry?.font ? primaryEntry.font.ascender * primaryScale : 0;
      const yPad = gridState.yPad ?? (cellH - lineHeight) * 0.5;

      const baseScale =
        entry.font.scaleForSize(fontSizePx, fontState.sizeMode) *
        fontScaleOverride(entry, FONT_SCALE_OVERRIDES);
      let fontScale = baseScale;
      if (!isSymbolFont(entry) && !isColorEmojiFont(entry)) {
        const advanceUnits = fontAdvanceUnits(entry, shapeClusterWithFont);
        const maxSpan = fontMaxCellSpan(entry);
        const widthPx = advanceUnits * baseScale;
        const widthAdjustRaw = widthPx > 0 ? (cellW * maxSpan) / widthPx : 1;
        const widthAdjust = clamp(widthAdjustRaw, 0.5, 2);
        fontScale = baseScale * widthAdjust;
        const adjustedHeightPx = fontHeightUnits(entry.font) * fontScale;
        if (adjustedHeightPx > lineHeight && adjustedHeightPx > 0) {
          fontScale *= lineHeight / adjustedHeightPx;
        }
      }
      const baselineAdjust = primaryEntry?.font
        ? primaryEntry.font.ascender * primaryScale - entry.font.ascender * fontScale
        : 0;
      const atlasScale = clamp(fontScale / (baseScale || 1), 0.5, 2);

      const meta = new Map<number, GlyphConstraintMeta>();
      meta.set(glyphId, {
        cp,
        constraintWidth: span,
        widths: new Set([span]),
        variable: false,
      });

      const constraintContext = {
        cellW,
        cellH,
        yPad,
        baselineOffset,
        baselineAdjust,
        fontScale,
        nerdMetrics: buildNerdMetrics(
          cellW,
          cellH,
          lineHeight,
          primaryEntry?.font,
          primaryScale,
          nerdIconScale,
        ),
        fontEntry: entry,
      };

      ensureAtlasForFont(
        state.device,
        state,
        entry,
        new Set([glyphId]),
        fontSizePx,
        fontIndex,
        atlasScale,
        meta,
        constraintContext,
      );

      const atlas = entry.atlas;
      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!atlas || !atlasState) {
        console.warn("atlas not ready");
        return null;
      }
      const widthMap = atlas.glyphsByWidth?.get(span);
      const metrics = widthMap?.get(glyphId) ?? atlas.glyphs.get(glyphId);
      if (!metrics) {
        console.warn("metrics missing");
        return null;
      }

      const atlasW = atlas.bitmap.width;
      const atlasH = atlas.bitmap.rows;
      const baseInset = Number.isFinite(atlas.inset) ? atlas.inset : 0;
      const uvInset = baseInset + (atlasState.nearest ? 0.5 : 0);
      const insetX = Math.min(uvInset, (metrics.width - 1) * 0.5);
      const insetY = Math.min(uvInset, (metrics.height - 1) * 0.5);
      const u0 = (metrics.atlasX + insetX) / atlasW;
      const v0 = (metrics.atlasY + insetY) / atlasH;
      const u1 = (metrics.atlasX + metrics.width - insetX) / atlasW;
      const v1 = (metrics.atlasY + metrics.height - insetY) / atlasH;

      const outW = Math.max(1, metrics.width);
      const outH = Math.max(1, metrics.height);
      const uniformBuffer = state.device.createBuffer({
        size: 8 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const uniforms = new Float32Array([outW, outH, 0, 0, 0, 0, 0, 0]);
      state.device.queue.writeBuffer(uniformBuffer, 0, uniforms);

      const instance = new Float32Array([0, 0, outW, outH, u0, v0, u1, v1, 1, 1, 1, 1, 0, 0, 0, 1]);
      const instanceBuffer = state.device.createBuffer({
        size: instance.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
      });
      new Float32Array(instanceBuffer.getMappedRange()).set(instance);
      instanceBuffer.unmap();

      const renderTarget = state.device.createTexture({
        size: [outW, outH, 1],
        format: state.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });

      const pipeline = atlasState.nearest ? state.glyphPipelineNearest : state.glyphPipeline;
      const bindGroup = state.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: atlasState.nearest
          ? [
              { binding: 0, resource: { buffer: uniformBuffer } },
              {
                binding: 1,
                resource:
                  atlasState.samplerNearest ??
                  state.device.createSampler({
                    magFilter: "nearest",
                    minFilter: "nearest",
                    addressModeU: "clamp-to-edge",
                    addressModeV: "clamp-to-edge",
                  }),
              },
              { binding: 2, resource: atlasState.texture.createView() },
            ]
          : [
              { binding: 0, resource: { buffer: uniformBuffer } },
              {
                binding: 1,
                resource:
                  atlasState.sampler ??
                  state.device.createSampler({
                    magFilter: "linear",
                    minFilter: "linear",
                    addressModeU: "clamp-to-edge",
                    addressModeV: "clamp-to-edge",
                  }),
              },
              { binding: 2, resource: atlasState.texture.createView() },
            ],
      });

      const encoder = state.device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: renderTarget.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, state.vertexBuffer);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.draw(6, 1, 0, 0);
      pass.end();
      state.device.queue.submit([encoder.finish()]);

      const bytesPerRow = outW * 4;
      const alignedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
      const buffer = state.device.createBuffer({
        size: alignedBytesPerRow * outH,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      const readEncoder = state.device.createCommandEncoder();
      readEncoder.copyTextureToBuffer(
        { texture: renderTarget },
        { buffer, bytesPerRow: alignedBytesPerRow, rowsPerImage: outH },
        { width: outW, height: outH, depthOrArrayLayers: 1 },
      );
      state.device.queue.submit([readEncoder.finish()]);
      await buffer.mapAsync(GPUMapMode.READ);
      const mapped = new Uint8Array(buffer.getMappedRange());
      const out = new Uint8ClampedArray(outW * outH * 4);
      for (let row = 0; row < outH; row += 1) {
        const srcStart = row * alignedBytesPerRow;
        const srcEnd = srcStart + bytesPerRow;
        const dstStart = row * bytesPerRow;
        out.set(mapped.subarray(srcStart, srcEnd), dstStart);
      }
      buffer.unmap();
      const image = new ImageData(out, outW, outH);
      const canvasEl = document.createElement("canvas");
      canvasEl.width = outW;
      canvasEl.height = outH;
      const ctx = canvasEl.getContext("2d");
      if (ctx) ctx.putImageData(image, 0, 0);
      canvasEl.style.border = "1px solid #555";
      canvasEl.style.margin = "6px";
      canvasEl.style.imageRendering = "pixelated";
      canvasEl.style.width = `${outW * 3}px`;
      canvasEl.style.height = `${outH * 3}px`;
      document.body.appendChild(canvasEl);

      console.log("dumpGlyphRender", {
        cp: formatCodepoint(cp),
        fontIndex,
        glyphId,
        constraintWidth: span,
        metrics,
        atlasW,
        atlasH,
        format: state.format,
        u0,
        v0,
        u1,
        v1,
        nearest: atlasState.nearest,
      });

      return image;
    };
  }

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

  let fontPromise: Promise<void> | null = null;
  let fontError: Error | null = null;

  function log(msg) {
    appendLog(`[ui] ${msg}`);
  }

  function setBoundedMap<K, V>(map: Map<K, V>, key: K, value: V, limit: number): void {
    if (map.has(key)) {
      map.delete(key);
    }
    map.set(key, value);
    if (map.size <= limit) return;
    const oldest = map.keys().next().value;
    if (oldest !== undefined) {
      map.delete(oldest);
    }
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
    const entry = `${timestamp} ${line}`;
    logBuffer.push(entry);
    if (logBuffer.length > LOG_LIMIT) {
      logBuffer.splice(0, logBuffer.length - LOG_LIMIT);
    }
    if (logEl) logEl.textContent = line;
    callbacks?.onLog?.(entry);
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

  // State saved during renderer switch
  let savedCanvasState: {
    width: number;
    height: number;
    dpr: number;
    gridCols: number;
    gridRows: number;
    cellW: number;
    cellH: number;
    fontSizePx: number;
  } | null = null;

  function saveCanvasState(): void {
    savedCanvasState = {
      width: canvas.width,
      height: canvas.height,
      dpr: currentDpr,
      gridCols: gridState.cols,
      gridRows: gridState.rows,
      cellW: gridState.cellW,
      cellH: gridState.cellH,
      fontSizePx: gridState.fontSizePx,
    };
    console.log(
      `[saveCanvasState] ${savedCanvasState.width}x${savedCanvasState.height} grid=${savedCanvasState.gridCols}x${savedCanvasState.gridRows}`,
    );
  }

  function restoreCanvasState(): void {
    if (!savedCanvasState) return;
    canvas.width = savedCanvasState.width;
    canvas.height = savedCanvasState.height;
    currentDpr = savedCanvasState.dpr;
    gridState.cols = savedCanvasState.gridCols;
    gridState.rows = savedCanvasState.gridRows;
    gridState.cellW = savedCanvasState.cellW;
    gridState.cellH = savedCanvasState.cellH;
    gridState.fontSizePx = savedCanvasState.fontSizePx;
    console.log(
      `[restoreCanvasState] ${canvas.width}x${canvas.height} grid=${gridState.cols}x${gridState.rows}`,
    );
    savedCanvasState = null;
  }

  function replaceCanvas(): void {
    const parent = canvas.parentElement;
    if (!parent) return;

    // Save state before replacing
    saveCanvasState();
    for (const cleanup of cleanupCanvasFns) cleanup();
    cleanupCanvasFns.length = 0;
    if (kittyOverlayCanvas?.parentElement) {
      kittyOverlayCanvas.parentElement.removeChild(kittyOverlayCanvas);
    }
    kittyOverlayCanvas = null;
    kittyOverlayCtx = null;

    const newCanvas = document.createElement("canvas");
    newCanvas.id = canvas.id;
    newCanvas.className = canvas.className;

    parent.replaceChild(newCanvas, canvas);
    canvas = newCanvas;
    isFocused = typeof document !== "undefined" ? document.activeElement === canvas : true;

    // Restore state to new canvas
    restoreCanvasState();
    bindCanvasEvents();
    bindFocusEvents();

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
    const sizeChanged =
      nextWidth !== canvas.width || nextHeight !== canvas.height || dpr !== currentDpr;
    if (!sizeChanged && !force) return;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    if (dprEl) dprEl.textContent = dpr.toFixed(2);
    callbacks?.onDpr?.(dpr);
    if (sizeEl) sizeEl.textContent = `${canvas.width}x${canvas.height}`;
    callbacks?.onCanvasSize?.(canvas.width, canvas.height);
    currentDpr = dpr;
    resizeState.dpr = dpr;
    resizeState.active = true;
    resizeState.lastAt = performance.now();
    const metrics = computeCellMetrics();
    if (metrics?.cellW && metrics?.cellH) {
      resizeState.cols = Math.max(1, Math.floor(canvas.width / metrics.cellW));
      resizeState.rows = Math.max(1, Math.floor(canvas.height / metrics.cellH));
    }
    syncKittyOverlaySize();
    updateGrid();
    needsRender = true;
    // Allow the loop to present a fresh frame immediately after resize.
    lastRenderTime = 0;
  }

  function resize(cols: number, rows: number) {
    const nextCols = Math.max(1, Math.floor(Number(cols)));
    const nextRows = Math.max(1, Math.floor(Number(rows)));
    if (!Number.isFinite(nextCols) || !Number.isFinite(nextRows)) return;

    const dpr = window.devicePixelRatio || 1;
    if (dpr !== currentDpr) {
      currentDpr = dpr;
      if (dprEl) dprEl.textContent = dpr.toFixed(2);
      callbacks?.onDpr?.(dpr);
    }

    const metrics = computeCellMetrics();
    if (!metrics) return;

    canvas.width = Math.max(1, nextCols * metrics.cellW);
    canvas.height = Math.max(1, nextRows * metrics.cellH);
    if (sizeEl) sizeEl.textContent = `${canvas.width}x${canvas.height}`;
    callbacks?.onCanvasSize?.(canvas.width, canvas.height);

    resizeState.dpr = currentDpr;
    resizeState.active = true;
    resizeState.lastAt = performance.now();
    resizeState.cols = nextCols;
    resizeState.rows = nextRows;

    updateGrid();
    scheduleTerminalResizeCommit(nextCols, nextRows, { immediate: true });
    needsRender = true;
    lastRenderTime = 0;
  }

  function scheduleSizeUpdate() {
    // Apply one immediate update so canvas backing size follows live drag.
    updateSize();
    // Coalesce resize bursts to at most one update per frame.
    // Cancelling/re-requesting here can starve updates during continuous drag,
    // leaving old content stretched/shrunk by CSS until the next draw.
    if (sizeRaf) return;
    sizeRaf = requestAnimationFrame(() => {
      sizeRaf = 0;
      updateSize();
    });
  }

  function focusTypingInput() {
    canvas.focus({ preventScroll: true });
    if (!imeInput) return;
    imeInput.focus({ preventScroll: true });
    // Safari can occasionally drop scripted IME focus; retry once on next frame.
    if (typeof document !== "undefined" && document.activeElement !== imeInput) {
      requestAnimationFrame(() => {
        if (document.activeElement === canvas) imeInput.focus({ preventScroll: true });
      });
    }
  }

  function focus() {
    focusTypingInput();
    isFocused =
      typeof document !== "undefined" && imeInput
        ? document.activeElement === canvas || document.activeElement === imeInput
        : true;
  }

  function blur() {
    if (imeInput && document.activeElement === imeInput) {
      imeInput.blur();
    }
    if (document.activeElement === canvas) {
      canvas.blur();
    }
    isFocused = false;
  }

  function bindFocusEvents() {
    if (!attachCanvasEvents) return;
    canvas.tabIndex = 0;
    const handleFocus = () => {
      isFocused = true;
      focusTypingInput();
      if (inputHandler?.isFocusReporting?.()) {
        sendKeyInput("\x1b[I", "program");
      }
    };
    const handleBlur = () => {
      const stillFocused =
        typeof document !== "undefined" && imeInput ? document.activeElement === imeInput : false;
      isFocused = stillFocused;
      if (!stillFocused && inputHandler?.isFocusReporting?.()) {
        sendKeyInput("\x1b[O", "program");
      }
    };
    const handlePointerFocus = () => {
      focusTypingInput();
    };
    canvas.addEventListener("pointerdown", handlePointerFocus);
    canvas.addEventListener("focus", handleFocus);
    canvas.addEventListener("blur", handleBlur);
    cleanupCanvasFns.push(() => {
      canvas.removeEventListener("pointerdown", handlePointerFocus);
      canvas.removeEventListener("focus", handleFocus);
      canvas.removeEventListener("blur", handleBlur);
    });
  }

  const hasResizeObserver = autoResize && "ResizeObserver" in window;
  if (attachWindowEvents && autoResize && !hasResizeObserver) {
    window.addEventListener("resize", scheduleSizeUpdate);
    window.addEventListener("load", scheduleSizeUpdate);
    cleanupFns.push(() => {
      window.removeEventListener("resize", scheduleSizeUpdate);
      window.removeEventListener("load", scheduleSizeUpdate);
    });
  }

  if (hasResizeObserver) {
    const ro = new ResizeObserver(() => scheduleSizeUpdate());
    const target = canvas.parentElement ?? document.body;
    ro.observe(target);
    cleanupFns.push(() => ro.disconnect());
  }

  function decodeRGBAWithCache(bytes: Uint8Array, index: number, cache: Map<number, Color>): Color {
    const offset = index * 4;
    const packed =
      ((bytes[offset] ?? 0) |
        ((bytes[offset + 1] ?? 0) << 8) |
        ((bytes[offset + 2] ?? 0) << 16) |
        ((bytes[offset + 3] ?? 0) << 24)) >>>
      0;
    const cached = cache.get(packed);
    if (cached) return cached;
    const decoded = decodePackedRGBA(packed);
    cache.set(packed, decoded);
    return decoded;
  }

  function decodePackedRGBA(color) {
    return [
      (color & 0xff) / 255,
      ((color >>> 8) & 0xff) / 255,
      ((color >>> 16) & 0xff) / 255,
      ((color >>> 24) & 0xff) / 255,
    ];
  }

  function clamp01(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  function brighten(color: Color, amount: number) {
    return [
      clamp01(color[0] + (1 - color[0]) * amount),
      clamp01(color[1] + (1 - color[1]) * amount),
      clamp01(color[2] + (1 - color[2]) * amount),
      color[3],
    ] as Color;
  }

  function fade(color: Color, factor: number) {
    return [color[0], color[1], color[2], clamp01(color[3] * factor)] as Color;
  }

  function drawUnderlineStyle(
    underlineData: number[],
    style: number,
    x: number,
    rowY: number,
    cellW: number,
    cellH: number,
    baseY: number,
    underlineOffsetPx: number,
    underlineThicknessPx: number,
    color: Color,
  ) {
    if (style <= 0) return;
    const thickness = underlineThicknessPx;
    const minY = rowY + 1;
    const maxY = rowY + cellH - thickness - 1;
    const underlineY = clamp(baseY + underlineOffsetPx, minY, maxY);
    if (style === 1) {
      pushRect(underlineData, x, underlineY, cellW, thickness, color);
      return;
    }
    if (style === 2) {
      pushRect(underlineData, x, underlineY, cellW, thickness, color);
      const gap = Math.max(1, Math.round(thickness * 0.6));
      let secondY = underlineY + thickness + gap;
      if (secondY > maxY) secondY = Math.max(minY, underlineY - thickness - gap);
      pushRect(underlineData, x, secondY, cellW, thickness, color);
      return;
    }
    if (style === 3) {
      const step = Math.max(2, Math.round(cellW * 0.25));
      const waveOffset = Math.max(1, Math.round(thickness * 0.8));
      for (let dx = 0; dx < cellW; dx += step) {
        const up = Math.floor(dx / step) % 2 === 0;
        const y = underlineY + (up ? 0 : waveOffset);
        pushRect(underlineData, x + dx, y, Math.min(step, cellW - dx), thickness, color);
      }
      return;
    }
    if (style === 4) {
      const dot = Math.max(1, Math.round(thickness));
      const gap = Math.max(1, Math.round(dot));
      for (let dx = 0; dx < cellW; dx += dot + gap) {
        pushRect(underlineData, x + dx, underlineY, Math.min(dot, cellW - dx), thickness, color);
      }
      return;
    }
    if (style === 5) {
      const dash = Math.max(1, Math.round(cellW * 0.6));
      const gap = Math.max(1, Math.round(cellW * 0.2));
      for (let dx = 0; dx < cellW; dx += dash + gap) {
        pushRect(underlineData, x + dx, underlineY, Math.min(dash, cellW - dx), thickness, color);
      }
    }
  }

  function drawStrikethrough(
    underlineData: number[],
    x: number,
    rowY: number,
    cellW: number,
    cellH: number,
    color: Color,
  ) {
    const thickness = Math.max(1, Math.round(cellH * 0.08));
    const y = Math.round(rowY + cellH * 0.5 - thickness * 0.5);
    pushRect(underlineData, x, y, cellW, thickness, color);
  }

  function drawOverline(
    underlineData: number[],
    x: number,
    rowY: number,
    cellW: number,
    color: Color,
  ) {
    const thickness = 1;
    const y = Math.round(rowY + 1);
    pushRect(underlineData, x, y, cellW, thickness, color);
  }

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
      } catch {
        // Ignore permissions API errors and attempt queryLocalFonts directly.
      }
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
            // Unstyled source should strongly prefer an unstyled face.
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

  function sourceLabelFromUrl(url: string, index: number): string {
    try {
      const parsed = new URL(url, window.location.href);
      const pathname = parsed.pathname;
      const slashIndex = pathname.lastIndexOf("/");
      const rawName = slashIndex >= 0 ? pathname.slice(slashIndex + 1) : pathname;
      const decoded = decodeURIComponent(rawName);
      return decoded || `font-${index + 1}`;
    } catch {
      return `font-${index + 1}`;
    }
  }

  function sourceBufferFromView(view: ArrayBufferView): ArrayBuffer {
    const out = new Uint8Array(view.byteLength);
    out.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return out.buffer;
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
    setBoundedMap(entry.glyphCache, text, shaped, GLYPH_SHAPE_CACHE_LIMIT);
    return shaped;
  }

  function noteColorGlyphText(
    entry: FontEntry,
    text: string,
    shaped: { glyphs: Array<{ glyphId: number }> },
  ) {
    if (!isColorEmojiFont(entry) || shaped.glyphs.length !== 1) return;
    const glyphId = shaped.glyphs[0]?.glyphId;
    if (!glyphId) return;
    if (!entry.colorGlyphTexts) entry.colorGlyphTexts = new Map();
    entry.colorGlyphTexts.set(glyphId, text);
  }

  function fontHasGlyph(font, ch) {
    const glyphId = font.glyphIdForChar(ch);
    return glyphId !== undefined && glyphId !== null && glyphId !== 0;
  }

  function isLikelyEmojiCodepoint(cp: number) {
    if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true;
    if (cp >= 0x1f300 && cp <= 0x1faff) return true;
    return false;
  }

  function isVariationSelectorCodepoint(cp: number) {
    if (cp >= 0xfe00 && cp <= 0xfe0f) return true;
    if (cp >= 0xe0100 && cp <= 0xe01ef) return true;
    return false;
  }

  function isCombiningMarkCodepoint(cp: number) {
    if (cp >= 0x0300 && cp <= 0x036f) return true;
    if (cp >= 0x1ab0 && cp <= 0x1aff) return true;
    if (cp >= 0x1dc0 && cp <= 0x1dff) return true;
    if (cp >= 0x20d0 && cp <= 0x20ff) return true;
    if (cp >= 0xfe20 && cp <= 0xfe2f) return true;
    return false;
  }

  function isEmojiModifierCodepoint(cp: number) {
    return cp >= 0x1f3fb && cp <= 0x1f3ff;
  }

  function isCoverageIgnorableCodepoint(cp: number) {
    if (cp === 0x200c || cp === 0x200d) return true;
    if (isVariationSelectorCodepoint(cp)) return true;
    if (isCombiningMarkCodepoint(cp)) return true;
    if (cp >= 0xe0020 && cp <= 0xe007f) return true;
    return false;
  }

  function shouldMergeTrailingClusterCodepoint(cp: number) {
    if (cp === 0x200c || cp === 0x200d) return true;
    if (isVariationSelectorCodepoint(cp)) return true;
    if (isCombiningMarkCodepoint(cp)) return true;
    if (isEmojiModifierCodepoint(cp)) return true;
    return false;
  }

  function resolvePresentationPreference(text: string, chars: string[]) {
    if (text.includes("\ufe0f")) return "emoji";
    if (text.includes("\ufe0e")) return "text";
    if (text.includes("\u200d")) return "emoji";
    for (const ch of chars) {
      const cp = ch.codePointAt(0) ?? 0;
      if (isLikelyEmojiCodepoint(cp)) return "emoji";
    }
    return "auto";
  }

  function pickFontIndexForText(text, expectedSpan = 1, stylePreference = "regular") {
    if (!fontState.fonts.length) return 0;
    const cacheKey = `${expectedSpan}:${stylePreference}:${text}`;
    const cached = fontState.fontPickCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const chars = Array.from(text);
    const requiredChars = chars.filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return !isCoverageIgnorableCodepoint(cp);
    });
    const firstCp = text.codePointAt(0) ?? 0;
    const nerdSymbol = isNerdSymbolCodepoint(firstCp);
    const presentation = resolvePresentationPreference(text, chars);
    const styleHintsEnabled =
      stylePreference !== "regular" && presentation !== "emoji" && !nerdSymbol;

    const hasBoldHint = (entry: FontEntry) => /\bbold\b/i.test(entry.label ?? "");
    const hasItalicHint = (entry: FontEntry) => /\b(italic|oblique)\b/i.test(entry.label ?? "");
    const stylePredicates: Array<(entry: FontEntry) => boolean> =
      stylePreference === "bold_italic"
        ? [
            (entry) => hasBoldHint(entry) && hasItalicHint(entry),
            (entry) => hasBoldHint(entry),
            (entry) => hasItalicHint(entry),
          ]
        : stylePreference === "bold"
          ? [(entry) => hasBoldHint(entry) && !hasItalicHint(entry), (entry) => hasBoldHint(entry)]
          : stylePreference === "italic"
            ? [
                (entry) => hasItalicHint(entry) && !hasBoldHint(entry),
                (entry) => hasItalicHint(entry),
              ]
            : [];

    const pickFirstMatch = (predicate?, allowSequenceShapingFallback = false) => {
      for (let i = 0; i < fontState.fonts.length; i += 1) {
        const entry = fontState.fonts[i];
        if (!entry?.font) continue;
        if (predicate && !predicate(entry)) continue;
        let ok = true;
        for (const ch of requiredChars) {
          if (!fontHasGlyph(entry.font, ch)) {
            ok = false;
            break;
          }
        }
        if (!ok && allowSequenceShapingFallback) {
          const shaped = shapeClusterWithFont(entry, text);
          ok = shaped.glyphs.some((glyph) => (glyph.glyphId ?? 0) !== 0);
        }
        if (ok) return i;
      }
      return -1;
    };
    const pickWithStyle = (predicate?, allowSequenceShapingFallback = false) => {
      if (styleHintsEnabled) {
        for (let i = 0; i < stylePredicates.length; i += 1) {
          const stylePredicate = stylePredicates[i];
          const styledIndex = pickFirstMatch(
            (entry) => {
              if (!stylePredicate(entry)) return false;
              return predicate ? !!predicate(entry) : true;
            },
            allowSequenceShapingFallback,
          );
          if (styledIndex >= 0) return styledIndex;
        }
      }
      return pickFirstMatch(predicate, allowSequenceShapingFallback);
    };

    const tryIndex = (index) => {
      if (index < 0) return null;
      setBoundedMap(fontState.fontPickCache, cacheKey, index, FONT_PICK_CACHE_LIMIT);
      return index;
    };

    if (nerdSymbol) {
      const symbolIndex = pickWithStyle((entry) => isNerdSymbolFont(entry) || isSymbolFont(entry));
      const result = tryIndex(symbolIndex);
      if (result !== null) return result;
    }

    if (presentation === "emoji") {
      const emojiIndex = pickFirstMatch((entry) => isColorEmojiFont(entry), true);
      const result = tryIndex(emojiIndex);
      if (result !== null) return result;
    } else if (presentation === "text") {
      const textIndex = pickFirstMatch((entry) => !isColorEmojiFont(entry));
      const result = tryIndex(textIndex);
      if (result !== null) return result;
    }

    const firstIndex = pickWithStyle();
    if (firstIndex >= 0) {
      setBoundedMap(fontState.fontPickCache, cacheKey, firstIndex, FONT_PICK_CACHE_LIMIT);
      return firstIndex;
    }

    setBoundedMap(fontState.fontPickCache, cacheKey, 0, FONT_PICK_CACHE_LIMIT);
    return 0;
  }

function stylePreferenceFromFlags(bold: boolean, italic: boolean) {
    if (bold && italic) return "bold_italic";
    if (bold) return "bold";
    if (italic) return "italic";
  return "regular";
}

function isAppleSymbolsFont(entry: FontEntry | undefined | null) {
  return !!entry && /\bapple symbols\b/i.test(entry.label ?? "");
}

function fontEntryHasBoldStyle(entry: FontEntry | undefined | null) {
  return !!entry && /\bbold\b/i.test(entry.label ?? "");
}

  function fontEntryHasItalicStyle(entry: FontEntry | undefined | null) {
    return !!entry && /\b(italic|oblique)\b/i.test(entry.label ?? "");
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
    const gridSizeChanged = cols !== gridState.cols || rows !== gridState.rows;
    const cellSizeChanged = metrics.cellW !== gridState.cellW || metrics.cellH !== gridState.cellH;
    if (gridSizeChanged) {
      if (gridEl) gridEl.textContent = `${cols}x${rows}`;
      callbacks?.onGridSize?.(cols, rows);
    }
    if (cellSizeChanged) {
      if (cellEl) cellEl.textContent = `${Math.round(metrics.cellW)}x${Math.round(metrics.cellH)}`;
      callbacks?.onCellSize?.(metrics.cellW, metrics.cellH);
    }
    const changed =
      gridSizeChanged || metrics.fontSizePx !== gridState.fontSizePx || cellSizeChanged;

    if (metrics.fontSizePx !== gridState.fontSizePx) {
      for (const entry of fontState.fonts) resetFontEntry(entry);
      if (activeState && activeState.glyphAtlases) {
        activeState.glyphAtlases = new Map();
      }
    }

    Object.assign(gridState, metrics, { cols, rows });

    if (wasmReady && wasm && wasmHandle) {
      wasm.setPixelSize(wasmHandle, canvas.width, canvas.height);
    }

    if (changed) {
      const resizeActive = performance.now() - resizeState.lastAt <= RESIZE_ACTIVE_MS;
      scheduleTerminalResizeCommit(cols, rows, { immediate: !resizeActive });
    }

    syncKittyOverlaySize();
  }

  function commitTerminalResize(cols: number, rows: number) {
    if (wasmReady && wasm && wasmHandle) {
      wasm.resize(wasmHandle, cols, rows);
      wasm.renderUpdate(wasmHandle);
    }
    if (ptyTransport.isConnected()) {
      ptyTransport.resize(cols, rows);
    }
    needsRender = true;
  }

  function flushPendingTerminalResize() {
    if (terminalResizeTimer) {
      clearTimeout(terminalResizeTimer);
      terminalResizeTimer = 0;
    }
    if (!pendingTerminalResize) return;
    const { cols, rows } = pendingTerminalResize;
    pendingTerminalResize = null;
    commitTerminalResize(cols, rows);
  }

  function scheduleTerminalResizeCommit(
    cols: number,
    rows: number,
    options: { immediate?: boolean } = {},
  ) {
    pendingTerminalResize = { cols, rows };
    if (options.immediate) {
      flushPendingTerminalResize();
      return;
    }
    if (terminalResizeTimer) {
      clearTimeout(terminalResizeTimer);
      terminalResizeTimer = 0;
    }
    terminalResizeTimer = window.setTimeout(() => {
      terminalResizeTimer = 0;
      flushPendingTerminalResize();
    }, RESIZE_COMMIT_DEBOUNCE_MS);
  }

  function ensureAtlasForFont(
    device: GPUDevice,
    state: WebGPUState,
    entry: FontEntry,
    neededGlyphIds: Set<number>,
    fontSizePx: number,
    fontIndex: number,
    atlasScale: number,
    glyphMeta?: Map<number, GlyphConstraintMeta>,
    constraintContext?: AtlasConstraintContext | null,
  ): boolean {
    const built = buildFontAtlasIfNeeded({
      entry,
      neededGlyphIds,
      glyphMeta,
      fontSizePx,
      atlasScale,
      fontIndex,
      constraintContext,
      deps: {
        fontScaleOverrides: FONT_SCALE_OVERRIDES,
        sizeMode: fontState.sizeMode,
        isSymbolFont,
        fontScaleOverride,
        resolveGlyphPixelMode,
        atlasBitmapToRGBA,
        padAtlasRGBA,
        buildAtlas,
        buildGlyphAtlasWithConstraints,
        buildColorEmojiAtlasWithCanvas,
        rasterizeGlyph,
        rasterizeGlyphWithTransform,
        nerdConstraintSignature,
        constants: {
          atlasPadding: ATLAS_PADDING,
          symbolAtlasPadding: SYMBOL_ATLAS_PADDING,
          symbolAtlasMaxSize: SYMBOL_ATLAS_MAX_SIZE,
          defaultAtlasMaxSize: 2048,
          pixelModeRgbaValue: PixelMode.RGBA ?? 4,
        },
        resolvePreferNearest: ({ fontIndex: idx, isSymbol, atlasScale: scale }) => {
          const scaleHint = scale ?? 1;
          return idx === 0 || isSymbol || scaleHint >= 0.99;
        },
      },
    });
    if (!built.rebuilt || !built.atlas || !built.rgba) return false;

    const atlas = built.atlas;
    const colorGlyphs = built.colorGlyphs;
    const preferNearest = built.preferNearest;
    const rgba = built.rgba;

    const texture = device.createTexture({
      size: [atlas.bitmap.width, atlas.bitmap.rows, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const width = atlas.bitmap.width;
    const height = atlas.bitmap.rows;
    const bytesPerRow = width * 4;
    const alignedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
    let upload = rgba;
    if (alignedBytesPerRow !== bytesPerRow) {
      const padded = new Uint8Array(alignedBytesPerRow * height);
      for (let row = 0; row < height; row += 1) {
        const srcStart = row * bytesPerRow;
        const srcEnd = srcStart + bytesPerRow;
        const dstStart = row * alignedBytesPerRow;
        padded.set(rgba.subarray(srcStart, srcEnd), dstStart);
      }
      upload = padded;
    }
    device.queue.writeTexture(
      { texture },
      upload,
      { bytesPerRow: alignedBytesPerRow, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 },
    );

    const samplerNearest = device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    const samplerLinear = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    const bindGroupNearest = device.createBindGroup({
      layout: state.glyphPipelineNearest.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: state.uniformBuffer } },
        { binding: 1, resource: samplerNearest },
        { binding: 2, resource: texture.createView() },
      ],
    });

    const bindGroupLinear = device.createBindGroup({
      layout: state.glyphPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: state.uniformBuffer } },
        { binding: 1, resource: samplerLinear },
        { binding: 2, resource: texture.createView() },
      ],
    });

    if (!state.glyphAtlases) state.glyphAtlases = new Map();
    const inset = Number.isFinite(atlas.inset) ? atlas.inset : 0;
    state.glyphAtlases.set(fontIndex, {
      texture,
      sampler: preferNearest ? undefined : samplerLinear,
      samplerNearest,
      samplerLinear,
      bindGroup: preferNearest ? bindGroupNearest : bindGroupLinear,
      bindGroupNearest,
      bindGroupLinear,
      width: atlas.bitmap.width,
      height: atlas.bitmap.rows,
      inset,
      colorGlyphs,
      nearest: preferNearest,
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
    const clampedStartRow = clamp(startRow, 0, rows - 1);
    const clampedEndRow = clamp(endRow, 0, rows - 1);
    for (let row = clampedStartRow; row <= clampedEndRow; row += 1) {
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

  function resolveCursorPosition(cursor: CursorInfo | null) {
    if (!cursor) return null;
    let col = cursor.col;
    let row = cursor.row;
    if (wasmExports?.restty_debug_cursor_x && wasmExports?.restty_debug_cursor_y && wasmHandle) {
      const ax = wasmExports.restty_debug_cursor_x(wasmHandle);
      const ay = wasmExports.restty_debug_cursor_y(wasmHandle);
      if (Number.isFinite(ax) && Number.isFinite(ay)) {
        col = ax;
        row = ay;
      }
    }
    return { col, row, wideTail: cursor.wideTail === 1 };
  }

  function resolveCursorStyle(
    cursor: CursorInfo | null,
    opts: { focused: boolean; preedit: boolean; blinkVisible: boolean },
  ): number | null {
    if (!cursor) return null;
    const visible = cursor.visible !== 0;
    if (!visible || opts.preedit) return null;
    if (!opts.focused) return 3;
    if (cursor.blinking && !opts.blinkVisible) return null;
    return cursor.style ?? 0;
  }

  function reportTermSize(cols: number, rows: number): void {
    if (cols === lastReportedTermCols && rows === lastReportedTermRows) return;
    lastReportedTermCols = cols;
    lastReportedTermRows = rows;
    if (termSizeEl) termSizeEl.textContent = `${cols}x${rows}`;
    callbacks?.onTermSize?.(cols, rows);
  }

  function reportCursor(cursorPos: { col: number; row: number } | null): void {
    if (!cursorPos) return;
    const { col, row } = cursorPos;
    if (cursorPosEl && (col !== lastReportedCursorCol || row !== lastReportedCursorRow)) {
      cursorPosEl.textContent = `${col},${row}`;
    }
    if (col !== lastReportedCursorCol || row !== lastReportedCursorRow) {
      callbacks?.onCursor?.(col, row);
      lastReportedCursorCol = col;
      lastReportedCursorRow = row;
    }
    lastCursorForCpr = { row: row + 1, col: col + 1 };
  }

  function reportDebugText(text: string): void {
    if (text === lastReportedDebugText) return;
    lastReportedDebugText = text;
    if (dbgEl) dbgEl.textContent = text;
    callbacks?.onDebug?.(text);
  }

  function tickWebGPU(state) {
    const { device, context } = state;

    if (fontError) {
      const text = `Font error: ${fontError.message}`;
      if (termDebug) termDebug.textContent = text;
      reportDebugText(text);
    }

    updateGrid();

    const render = getRenderState();
    if (!render || !fontState.font) {
      // During live resize, render state can be momentarily unavailable.
      // Keep the last presented frame instead of flashing a cleared frame.
      if (lastRenderState) {
        clearKittyOverlay();
        return;
      }
      const { useLinearBlending } = resolveBlendFlags("webgpu", state);
      const clearColor = useLinearBlending ? srgbToLinearColor(defaultBg) : defaultBg;
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.end();
      device.queue.submit([encoder.finish()]);
      clearKittyOverlay();
      return;
    }

    lastRenderState = render;

    const {
      rows,
      cols,
      codepoints,
      contentTags,
      wide,
      styleFlags,
      linkIds,
      fgBytes,
      bgBytes,
      ulBytes,
      ulStyle,
      graphemeOffset,
      graphemeLen,
      graphemeBuffer,
      cursor,
    } = render;

    if (!codepoints || !fgBytes) return;

    const mergedEmojiSkip = new Uint8Array(codepoints.length);
    const isRegionalIndicator = (value: number) => value >= 0x1f1e6 && value <= 0x1f1ff;
    const readCellCluster = (
      cellIndex: number,
    ): { cp: number; text: string; span: number } | null => {
      const flag = wide ? (wide[cellIndex] ?? 0) : 0;
      if (flag === 2 || flag === 3) return null;
      const cp = codepoints[cellIndex] ?? 0;
      if (!cp) return null;
      let text = String.fromCodePoint(cp);
      const extra =
        graphemeLen && graphemeOffset && graphemeBuffer ? (graphemeLen[cellIndex] ?? 0) : 0;
      if (extra > 0 && graphemeOffset && graphemeBuffer) {
        const start = graphemeOffset[cellIndex] ?? 0;
        const cps = [cp];
        for (let j = 0; j < extra; j += 1) {
          const extraCp = graphemeBuffer[start + j];
          if (extraCp) cps.push(extraCp);
        }
        text = String.fromCodePoint(...cps);
      }
      return { cp, text, span: flag === 1 ? 2 : 1 };
    };

    const { useLinearBlending, useLinearCorrection } = resolveBlendFlags("webgpu", state);
    const clearColor = useLinearBlending ? srgbToLinearColor(defaultBg) : defaultBg;

    reportTermSize(cols, rows);
    const cursorPos = cursor ? resolveCursorPosition(cursor) : null;
    reportCursor(cursorPos);
    const isBlinking = (cursor?.blinking || 0) !== 0 || FORCE_CURSOR_BLINK;
    const blinkVisible = !isBlinking || Math.floor(performance.now() / CURSOR_BLINK_MS) % 2 === 0;
    const imeFocused =
      typeof document !== "undefined" && imeInput ? document.activeElement === imeInput : false;
    const windowFocused = typeof document !== "undefined" ? document.hasFocus() : true;
    const cursorStyle = cursor
      ? resolveCursorStyle(cursor, {
          focused: isFocused || imeFocused || windowFocused,
          preedit: Boolean(imeState.preedit),
          blinkVisible,
        })
      : null;
    let cursorCell: { row: number; col: number; wide: boolean } | null = null;
    if (cursorStyle !== null && cursorPos) {
      let col = cursorPos.col;
      const row = cursorPos.row;
      let wide = false;
      if (cursorPos.wideTail && col > 0) {
        col -= 1;
        wide = true;
      }
      cursorCell = { row, col, wide };
    }
    if (dbgEl && wasmExports && wasmHandle) {
      const cx = wasmExports.restty_debug_cursor_x
        ? wasmExports.restty_debug_cursor_x(wasmHandle)
        : 0;
      const cy = wasmExports.restty_debug_cursor_y
        ? wasmExports.restty_debug_cursor_y(wasmHandle)
        : 0;
      const sl = wasmExports.restty_debug_scroll_left
        ? wasmExports.restty_debug_scroll_left(wasmHandle)
        : 0;
      const sr = wasmExports.restty_debug_scroll_right
        ? wasmExports.restty_debug_scroll_right(wasmHandle)
        : 0;
      const tc = wasmExports.restty_debug_term_cols
        ? wasmExports.restty_debug_term_cols(wasmHandle)
        : 0;
      const tr = wasmExports.restty_debug_term_rows
        ? wasmExports.restty_debug_term_rows(wasmHandle)
        : 0;
      const pc = wasmExports.restty_debug_page_cols
        ? wasmExports.restty_debug_page_cols(wasmHandle)
        : 0;
      const pr = wasmExports.restty_debug_page_rows
        ? wasmExports.restty_debug_page_rows(wasmHandle)
        : 0;
      const text = `${cx},${cy} | ${sl}-${sr} | t:${tc}x${tr} p:${pc}x${pr}`;
      reportDebugText(text);
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
    // OpenType underlinePosition is in Y-up font space (negative means below baseline).
    // Screen space is Y-down, so we flip the sign.
    const underlineOffsetPx = -underlinePosition * primaryScale;
    const underlineThicknessPx = Math.max(1, Math.ceil(underlineThickness * primaryScale));

    if (cursorPos && cursorStyle === null) {
      updateImePosition({ row: cursorPos.row, col: cursorPos.col }, cellW, cellH);
    }

    const bgData = [];
    const selectionData = [];
    const underlineData = [];
    const cursorData = [];
    const fgRectData = [];
    const overlayData = [];
    const glyphDataNearestByFont = new Map();
    const glyphDataLinearByFont = new Map();
    const glyphQueueByFont = new Map();
    const overlayGlyphDataNearestByFont = new Map();
    const overlayGlyphDataLinearByFont = new Map();
    const overlayGlyphQueueByFont = new Map();
    const neededGlyphIdsByFont = new Map();
    const neededGlyphMetaByFont = new Map();
    const fgColorCache = new Map<number, Color>();
    const bgColorCache = new Map<number, Color>();
    const ulColorCache = new Map<number, Color>();
    const baseScaleByFont = fontState.fonts.map((entry, idx) => {
      if (!entry?.font) return primaryScale;
      if (idx === 0) return primaryScale;
      return (
        entry.font.scaleForSize(fontSizePx, fontState.sizeMode) *
        fontScaleOverride(entry, FONT_SCALE_OVERRIDES)
      );
    });

    const scaleByFont = fontState.fonts.map((entry, idx) => {
      if (!entry?.font) return primaryScale;
      if (idx === 0) return primaryScale;
      const baseScale = baseScaleByFont[idx] ?? primaryScale;
      if (isSymbolFont(entry) || isColorEmojiFont(entry)) return baseScale;
      const advanceUnits = fontAdvanceUnits(entry, shapeClusterWithFont);
      const maxSpan = fontMaxCellSpan(entry);
      const widthPx = advanceUnits * baseScale;
      const widthAdjustRaw = widthPx > 0 ? (cellW * maxSpan) / widthPx : 1;
      const widthAdjust = clamp(widthAdjustRaw, 0.5, 2);
      let adjustedScale = baseScale * widthAdjust;
      const adjustedHeightPx = fontHeightUnits(entry.font) * adjustedScale;
      if (adjustedHeightPx > lineHeight && adjustedHeightPx > 0) {
        adjustedScale *= lineHeight / adjustedHeightPx;
      }
      return adjustedScale;
    });

    const bitmapScaleByFont = fontState.fonts.map((entry, idx) => {
      if (!entry?.font || idx === 0) return 1;
      if (isSymbolFont(entry)) return 1;
      const baseScale = baseScaleByFont[idx] ?? 0;
      if (baseScale <= 0) return 1;
      const targetScale = scaleByFont[idx] ?? baseScale;
      return clamp(targetScale / baseScale, 0.5, 2);
    });

    const baselineAdjustByFont = fontState.fonts.map((entry, idx) => {
      if (!entry?.font || idx === 0 || !primaryEntry?.font) return 0;
      const scale = scaleByFont[idx] ?? primaryScale;
      return primaryEntry.font.ascender * primaryScale - entry.font.ascender * scale;
    });

    const nerdMetrics = buildNerdMetrics(
      cellW,
      cellH,
      lineHeight,
      primaryEntry?.font,
      primaryScale,
      nerdIconScale,
    );

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
    const getGlyphMeta = (fontIndex) => {
      if (!neededGlyphMetaByFont.has(fontIndex)) neededGlyphMetaByFont.set(fontIndex, new Map());
      return neededGlyphMetaByFont.get(fontIndex);
    };
    const noteGlyphMeta = (fontIndex, glyphId, cp, constraintWidth) => {
      if (!glyphId || !cp) return;
      const meta = getGlyphMeta(fontIndex);
      const prev = meta.get(glyphId);
      if (!prev) {
        const width = Math.max(1, constraintWidth || 1);
        meta.set(glyphId, {
          cp,
          constraintWidth: width,
          widths: new Set([width]),
          variable: false,
        });
        return;
      }
      if (prev.constraintWidth !== constraintWidth) {
        prev.widths?.add(Math.max(1, constraintWidth || 1));
        meta.set(glyphId, {
          ...prev,
          constraintWidth: Math.min(prev.constraintWidth, Math.max(1, constraintWidth || 1)),
          variable: true,
        });
      }
    };
    const getGlyphData = (map, fontIndex) => {
      if (!map.has(fontIndex)) map.set(fontIndex, []);
      return map.get(fontIndex);
    };

    const cursorBlock = cursorStyle === 0 && !!cursorCell;
    for (let row = 0; row < rows; row += 1) {
      const rowY = row * cellH;
      const baseY = rowY + yPad + baselineOffset;
      const localSel = selectionState.active ? selectionForRow(row, cols) : null;
      const selStart = localSel?.start ?? -1;
      const selEnd = localSel?.end ?? -1;
      if (selStart >= 0 && selEnd > selStart) {
        const start = Math.max(0, selStart);
        const end = Math.min(cols, selEnd);
        pushRect(selectionData, start * cellW, rowY, (end - start) * cellW, cellH, selectionColor);
      }

      for (let col = 0; col < cols; col += 1) {
        const idx = row * cols + col;
        const x = col * cellW;

        const tag = contentTags ? contentTags[idx] : 0;
        const bgOnly = tag === 2 || tag === 3;
        const flags = styleFlags ? styleFlags[idx] : 0;
        const bold = (flags & STYLE_BOLD) !== 0;
        const italic = (flags & STYLE_ITALIC) !== 0;
        const faint = (flags & STYLE_FAINT) !== 0;
        const blink = (flags & STYLE_BLINK) !== 0;
        const inverse = (flags & STYLE_INVERSE) !== 0;
        const invisible = (flags & STYLE_INVISIBLE) !== 0;
        const strike = (flags & STYLE_STRIKE) !== 0;
        const overline = (flags & STYLE_OVERLINE) !== 0;
        const underlineStyle = ulStyle ? ulStyle[idx] : (flags & STYLE_UNDERLINE_MASK) >> 8;

        let fg = decodeRGBAWithCache(fgBytes, idx, fgColorCache);
        let bg = bgBytes ? decodeRGBAWithCache(bgBytes, idx, bgColorCache) : defaultBg;
        let ul = ulBytes ? decodeRGBAWithCache(ulBytes, idx, ulColorCache) : fg;
        const underlineUsesFg =
          ul[0] === fg[0] && ul[1] === fg[1] && ul[2] === fg[2] && ul[3] === fg[3];

        if (inverse) {
          const tmp = fg;
          fg = bg;
          bg = tmp;
          if (underlineUsesFg) ul = fg;
        }

        if (bold) {
          fg = brighten(fg, BOLD_BRIGHTEN);
          ul = brighten(ul, BOLD_BRIGHTEN);
        }
        if (faint) {
          fg = fade(fg, FAINT_ALPHA);
          ul = fade(ul, FAINT_ALPHA);
        }

        const bgForText =
          bg[3] < 1
            ? [
                bg[0] + defaultBg[0] * (1 - bg[3]),
                bg[1] + defaultBg[1] * (1 - bg[3]),
                bg[2] + defaultBg[2] * (1 - bg[3]),
                1,
              ]
            : bg;
        if ((bgBytes || inverse) && bg[3] > 0) pushRect(bgData, x, rowY, cellW, cellH, bg);

        const linkId = linkIds ? (linkIds[idx] ?? 0) : 0;
        const linkHovered = linkId && linkId === linkState.hoverId;
        const blinkOff = blink && !blinkVisible;
        const textHidden = invisible || blinkOff;
        if (!textHidden && !bgOnly) {
          if (underlineStyle > 0 && ul[3] > 0) {
            drawUnderlineStyle(
              underlineData,
              underlineStyle,
              x,
              rowY,
              cellW,
              cellH,
              baseY,
              underlineOffsetPx,
              underlineThicknessPx,
              ul,
            );
          }
          if (linkHovered && !selectionState.active && !selectionState.dragging) {
            drawUnderlineStyle(
              underlineData,
              1,
              x,
              rowY,
              cellW,
              cellH,
              baseY,
              underlineOffsetPx,
              underlineThicknessPx,
              ul,
            );
          }
          if (strike) drawStrikethrough(underlineData, x, rowY, cellW, cellH, fg);
          if (overline) drawOverline(underlineData, x, rowY, cellW, fg);
        }

        if (bgOnly || textHidden) continue;

        if (mergedEmojiSkip[idx]) continue;
        const cluster = readCellCluster(idx);
        if (!cluster) continue;
        const cp = cluster.cp;
        if (cp === KITTY_PLACEHOLDER_CP) continue;
        let text = cluster.text;
        let baseSpan = cluster.span;
        const rowEnd = row * cols + cols;

        if (isRegionalIndicator(cp)) {
          const nextIdx = idx + baseSpan;
          if (nextIdx < rowEnd && !mergedEmojiSkip[nextIdx]) {
            const next = readCellCluster(nextIdx);
            if (next && isRegionalIndicator(next.cp)) {
              text += next.text;
              baseSpan += next.span;
              mergedEmojiSkip[nextIdx] = 1;
            }
          }
        }

        let nextSeqIdx = idx + baseSpan;
        let guard = 0;
        while (nextSeqIdx < rowEnd && guard < 12) {
          const next = readCellCluster(nextSeqIdx);
          if (!next || !next.cp || isSpaceCp(next.cp)) break;
          const shouldMerge =
            text.endsWith("\u200d") || shouldMergeTrailingClusterCodepoint(next.cp);
          if (!shouldMerge) break;
          text += next.text;
          baseSpan += next.span;
          mergedEmojiSkip[nextSeqIdx] = 1;
          nextSeqIdx += next.span;
          guard += 1;
        }

        const extra = text.length > String.fromCodePoint(cp).length ? 1 : 0;
        if (extra === 0 && isSpaceCp(cp)) continue;

        if (
          cursorBlock &&
          cursorCell &&
          row === cursorCell.row &&
          col >= cursorCell.col &&
          col < cursorCell.col + (cursorCell.wide ? 2 : 1)
        ) {
          fg = [bgForText[0], bgForText[1], bgForText[2], 1];
        }

        if (isBlockElement(cp)) {
          if (drawBlockElement(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
        }

        if (isBoxDrawing(cp)) {
          if (drawBoxDrawing(cp, x, rowY, cellW, cellH, fg, fgRectData, underlineThicknessPx))
            continue;
        }

        if (isBraille(cp)) {
          if (drawBraille(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
        }

        if (isPowerline(cp)) {
          if (drawPowerline(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
        }

        if (extra > 0 && text.trim() === "") continue;

        const fontIndex = pickFontIndexForText(
          text,
          baseSpan,
          stylePreferenceFromFlags(bold, italic),
        );
        const fontEntry = fontState.fonts[fontIndex] ?? fontState.fonts[0];
        const shaped = shapeClusterWithFont(fontEntry, text);
        if (!shaped.glyphs.length) continue;
        noteColorGlyphText(fontEntry, text, shaped);
        const glyphSet = getGlyphSet(fontIndex);
        for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);

        const fontScale = scaleByFont[fontIndex] ?? primaryScale;
        let cellSpan = baseSpan;
        const symbolLike = isRenderSymbolLike(cp);
        const nerdConstraint = symbolLike ? resolveSymbolConstraint(cp) : null;
        const symbolConstraint = !!nerdConstraint;
        let constraintWidth = baseSpan;
        let forceFit = false;
        let glyphWidthPx = 0;
        if (symbolLike) {
          if (baseSpan === 1) {
            // Match Ghostty behavior for icon-like Nerd glyphs: allow 2-cell span only
            // when followed by whitespace and not in a symbol run.
            if (nerdConstraint?.height === "icon") {
              constraintWidth = 1;
              if (col < cols - 1) {
                if (col > 0) {
                  const prevCp = codepoints[idx - 1];
                  if (isRenderSymbolLike(prevCp) && !isGraphicsElement(prevCp)) {
                    constraintWidth = 1;
                  } else {
                    const nextCp = codepoints[idx + 1];
                    if (!nextCp || isSpaceCp(nextCp)) constraintWidth = 2;
                  }
                } else {
                  const nextCp = codepoints[idx + 1];
                  if (!nextCp || isSpaceCp(nextCp)) constraintWidth = 2;
                }
              }
            } else {
              constraintWidth = 1;
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
        if (symbolConstraint) {
          for (const glyph of shaped.glyphs) {
            noteGlyphMeta(fontIndex, glyph.glyphId, cp, constraintWidth);
          }
        }
        const cellWidthPx = cellW * cellSpan;
        const xPad = 0;

        getGlyphQueue(fontIndex).push({
          x,
          baseY,
          xPad,
          fg,
          bg: bgForText,
          shaped,
          fontIndex,
          scale: fontScale,
          cellWidth: cellWidthPx,
          symbolLike,
          symbolConstraint,
          constraintWidth,
          forceFit,
          glyphWidthPx,
          cp,
          italic,
          bold,
        });
      }
    }

    if (cursor && imeState.preedit) {
      const preeditText = imeState.preedit;
      const preeditFontIndex = pickFontIndexForText(preeditText, 1);
      const preeditEntry = fontState.fonts[preeditFontIndex] ?? fontState.fonts[0];
      const shaped = shapeClusterWithFont(preeditEntry, preeditText);
      noteColorGlyphText(preeditEntry, preeditText, shaped);
      const glyphSet = getGlyphSet(preeditFontIndex);
      for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);
      const preeditRow = cursorCell?.row ?? cursorPos?.row ?? cursor.row;
      const preeditCol = cursorCell?.col ?? cursorPos?.col ?? cursor.col;
      const baseY = preeditRow * cellH + yPad + baselineOffset;
      const x = preeditCol * cellW;
      const preeditScale = scaleByFont[preeditFontIndex] ?? primaryScale;
      const advancePx = shaped.advance * preeditScale;
      const widthPx = Math.max(cellW, advancePx);
      const rowY = preeditRow * cellH;
      pushRect(bgData, x, rowY, widthPx, cellH, PREEDIT_BG);
      const thickness = underlineThicknessPx;
      const underlineBaseY = clamp(
        baseY + underlineOffsetPx,
        rowY + 1,
        rowY + cellH - thickness - 1,
      );
      pushRect(underlineData, x, underlineBaseY, widthPx, thickness, PREEDIT_UL);
      const selStart = imeState.selectionStart || 0;
      const selEnd = imeState.selectionEnd || 0;
      if (selEnd > selStart) {
        const leftWidth =
          shapeClusterWithFont(preeditEntry, preeditText.slice(0, selStart)).advance * preeditScale;
        const selWidth =
          shapeClusterWithFont(preeditEntry, preeditText.slice(selStart, selEnd)).advance *
          preeditScale;
        pushRect(bgData, x + leftWidth, rowY, selWidth, cellH, PREEDIT_ACTIVE_BG);
        pushRect(underlineData, x + leftWidth, underlineBaseY, selWidth, thickness, PREEDIT_UL);
      } else {
        const caretWidth = Math.max(1, Math.floor(cellW * 0.1));
        const caretX =
          x +
          shapeClusterWithFont(preeditEntry, preeditText.slice(0, selStart)).advance * preeditScale;
        pushRect(cursorData, caretX, rowY + 2, caretWidth, cellH - 4, PREEDIT_CARET);
      }
      getGlyphQueue(preeditFontIndex).push({
        x,
        baseY,
        xPad: 0,
        fg: PREEDIT_FG,
        bg: PREEDIT_BG,
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
          const overlayBg: Color = [0, 0, 0, 0.6 * alpha];
          pushRectBox(overlayData, boxX, boxY, boxW, boxH, overlayBg);
          pushRectBox(overlayData, boxX, boxY, boxW, 1, [1, 1, 1, 0.12 * alpha]);
          const textRowY = boxY + (boxH - lineHeight) * 0.5;
          const baseY = textRowY + yPad + baselineOffset;
          getOverlayGlyphQueue(0).push({
            x: boxX + padX,
            baseY,
            xPad: 0,
            fg: [1, 1, 1, alpha],
            bg: overlayBg,
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
      const meta = neededGlyphMetaByFont.get(fontIndex);
      const constraintContext = meta
        ? {
            cellW,
            cellH,
            yPad,
            baselineOffset,
            baselineAdjust: baselineAdjustByFont[fontIndex] ?? 0,
            fontScale: scaleByFont[fontIndex] ?? primaryScale,
            nerdMetrics,
            fontEntry: entry,
          }
        : null;
      ensureAtlasForFont(
        device,
        state,
        entry,
        neededSet,
        fontSizePx,
        fontIndex,
        atlasScale,
        meta,
        constraintContext,
      );
    }

    const emitGlyphs = (
      queueByFont,
      targetMaps: {
        nearest: Map<number, number[]>;
        linear: Map<number, number[]>;
      },
    ) => {
      for (const [fontIndex, queue] of queueByFont.entries()) {
        const entry = fontState.fonts[fontIndex];
        const atlasState = state.glyphAtlases?.get(fontIndex);
        if (!entry || !entry.atlas || !atlasState) continue;
        const atlas = entry.atlas;
        const atlasW = atlas.bitmap.width;
        const atlasH = atlas.bitmap.rows;
        const baseInset = Number.isFinite(atlas.inset) ? atlas.inset : 0;
        const colorGlyphs = atlasState.colorGlyphs ?? atlas.colorGlyphs;
        for (const item of queue) {
          const bg = item.bg ?? defaultBg;
          let penX = 0;
          const scale = item.scale ?? primaryScale;
          const maxWidth = item.cellWidth ?? cellW;
          const maxHeight = cellH;
          const symbolLike = item.symbolLike;
          const symbolConstraint = item.symbolConstraint;
          const glyphDataNearest = getGlyphData(targetMaps.nearest, fontIndex);
          const glyphDataLinear = getGlyphData(targetMaps.linear, fontIndex);
          let itemScale = scale;
          if (!symbolConstraint) {
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
          }
          const scaleFactor = scale > 0 ? itemScale / scale : 1;
          const widthKey = item.constraintWidth ?? 0;
          const widthMap = atlas.glyphsByWidth?.get(widthKey);
          for (const glyph of item.shaped.glyphs) {
            const colorGlyph = !!colorGlyphs?.has(glyph.glyphId);
            const metrics = widthMap?.get(glyph.glyphId) ?? atlas.glyphs.get(glyph.glyphId);
            if (!metrics) continue;
            let bitmapScale = scaleFactor;
            const glyphConstrained = symbolLike && !!widthMap?.has(glyph.glyphId);
            if (glyphConstrained) bitmapScale = 1;
            if (fontIndex > 0 && !symbolLike) {
              const widthScale = maxWidth > 0 ? maxWidth / metrics.width : 1;
              const heightScale = maxHeight > 0 ? maxHeight / metrics.height : 1;
              const clampScale = Math.min(1, widthScale, heightScale);
              bitmapScale *= clampScale;
            }
            const baselineAdjust = baselineAdjustByFont[fontIndex] ?? 0;
            let gw = metrics.width * bitmapScale;
            let gh = metrics.height * bitmapScale;
            if (symbolLike && !glyphConstrained) {
              const scaleToFit = gw > 0 && gh > 0 ? Math.min(maxWidth / gw, maxHeight / gh) : 1;
              if (scaleToFit < 1) {
                bitmapScale *= scaleToFit;
                gw *= scaleToFit;
                gh *= scaleToFit;
              }
              gw = Math.round(gw);
              gh = Math.round(gh);
              gw = Math.max(1, gw);
              gh = Math.max(1, gh);
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
            if (!glyphConstrained && symbolLike && item.cp) {
              const nerdConstraint = resolveSymbolConstraint(item.cp);
              const defaultConstraint = isAppleSymbolsFont(entry)
                ? DEFAULT_APPLE_SYMBOLS_CONSTRAINT
                : DEFAULT_SYMBOL_CONSTRAINT;
              const constraint =
                nerdConstraint ?? (colorGlyph ? DEFAULT_EMOJI_CONSTRAINT : defaultConstraint);
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
              const tightened = nerdConstraint
                ? tightenNerdConstraintBox(adjusted, nerdConstraint)
                : adjusted;
              x = item.x + tightened.x;
              y = rowY + tightened.y;
              gw = tightened.width;
              gh = tightened.height;
            }
            if (gw < 1) gw = 1;
            if (gh < 1) gh = 1;
            const scaled =
              Math.abs(gw - metrics.width) > 0.01 || Math.abs(gh - metrics.height) > 0.01;
            const useNearest = atlasState.nearest && !scaled;
            if (useNearest) {
              gw = metrics.width;
              gh = metrics.height;
            }
            const uvInset = baseInset + (useNearest ? 0.5 : 0);
            const px = Math.round(x);
            const py = Math.round(y);
            const insetX = Math.min(uvInset, (metrics.width - 1) * 0.5);
            const insetY = Math.min(uvInset, (metrics.height - 1) * 0.5);
            const u0 = (metrics.atlasX + insetX) / atlasW;
            const v0 = (metrics.atlasY + insetY) / atlasH;
            const u1 = (metrics.atlasX + metrics.width - insetX) / atlasW;
            const v1 = (metrics.atlasY + metrics.height - insetY) / atlasH;
            const glyphData = useNearest ? glyphDataNearest : glyphDataLinear;
            const italic = !!item.italic;
            const bold = !!item.bold;
            const syntheticItalic = italic && !fontEntryHasItalicStyle(entry);
            const syntheticBold = bold && !fontEntryHasBoldStyle(entry);
            const slant = syntheticItalic && !colorGlyph ? gh * ITALIC_SLANT : 0;
            const boldOffset =
              syntheticBold && !colorGlyph ? Math.max(1, Math.round(gw * BOLD_OFFSET)) : 0;
            const renderMode = colorGlyph ? GLYPH_RENDER_MODE_COLOR : GLYPH_RENDER_MODE_MONO;
            const pushGlyph = (xPos: number) => {
              glyphData.push(
                xPos,
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
                bg[0],
                bg[1],
                bg[2],
                bg[3],
                slant,
                renderMode,
              );
            };
            pushGlyph(px);
            if (boldOffset > 0) {
              const minGlyphX = Math.round(item.x);
              const maxGlyphX = Math.round(item.x + maxWidth - gw);
              let bx = clamp(px + boldOffset, minGlyphX, maxGlyphX);
              if (bx === px) bx = clamp(px - boldOffset, minGlyphX, maxGlyphX);
              // If a glyph fully occupies its cell, we can't offset; reinforce at the same x.
              if (bx === px) pushGlyph(px);
              else pushGlyph(bx);
            }
            penX += glyph.xAdvance;
          }
        }
      }
    };

    emitGlyphs(glyphQueueByFont, {
      nearest: glyphDataNearestByFont,
      linear: glyphDataLinearByFont,
    });
    emitGlyphs(overlayGlyphQueueByFont, {
      nearest: overlayGlyphDataNearestByFont,
      linear: overlayGlyphDataLinearByFont,
    });

    if (cursorStyle !== null && cursorPos) {
      let cursorCol = cursorPos.col;
      let cursorRow = cursorPos.row;
      let cursorWidth = cellW;
      if (cursorPos.wideTail && cursorCol > 0) {
        cursorCol -= 1;
        cursorWidth = cellW * 2;
      }
      if (cursorRow < rows && cursorCol < cols) {
        const x = cursorCol * cellW;
        const y = cursorRow * cellH;
        const cursorColor = cursor?.color ? decodePackedRGBA(cursor.color) : cursorFallback;
        const cursorThicknessPx = underlineThicknessPx;
        updateImePosition({ row: cursorRow, col: cursorCol }, cellW, cellH);
        if (cursorStyle === 0) {
          pushRect(fgRectData, x, y, cursorWidth, cellH, cursorColor);
        } else if (cursorStyle === 1) {
          const offset = Math.floor((cursorThicknessPx + 1) / 2);
          pushRect(cursorData, x - offset, y, cursorThicknessPx, cellH, cursorColor);
        } else if (cursorStyle === 2) {
          const baseY = cursorRow * cellH + yPad + baselineOffset;
          const underlineY = clamp(
            baseY + underlineOffsetPx,
            y + 1,
            y + cellH - cursorThicknessPx - 1,
          );
          pushRect(cursorData, x, underlineY, cursorWidth, cursorThicknessPx, cursorColor);
        } else if (cursorStyle === 3) {
          pushRect(cursorData, x, y, cursorWidth, cursorThicknessPx, cursorColor);
          pushRect(
            cursorData,
            x,
            y + cellH - cursorThicknessPx,
            cursorWidth,
            cursorThicknessPx,
            cursorColor,
          );
          pushRect(cursorData, x, y, cursorThicknessPx, cellH, cursorColor);
          pushRect(
            cursorData,
            x + cursorWidth - cursorThicknessPx,
            y,
            cursorThicknessPx,
            cellH,
            cursorColor,
          );
        } else {
          pushRect(cursorData, x, y, cursorWidth, cellH, cursorColor);
        }
      }
    }

    if (wasmExports && wasmHandle && wasmExports.restty_scrollbar_total) {
      const total = wasmExports.restty_scrollbar_total(wasmHandle) || 0;
      const offset = wasmExports.restty_scrollbar_offset
        ? wasmExports.restty_scrollbar_offset(wasmHandle)
        : 0;
      const len = wasmExports.restty_scrollbar_len
        ? wasmExports.restty_scrollbar_len(wasmHandle)
        : rows;
      if (
        total !== scrollbarState.lastTotal ||
        offset !== scrollbarState.lastOffset ||
        len !== scrollbarState.lastLen
      ) {
        scrollbarState.lastTotal = total;
        scrollbarState.lastOffset = offset;
        scrollbarState.lastLen = len;
      }
      appendOverlayScrollbar(overlayData, total, offset, len);
    }

    webgpuUniforms[0] = canvas.width;
    webgpuUniforms[1] = canvas.height;
    webgpuUniforms[2] = 0;
    webgpuUniforms[3] = 0;
    webgpuUniforms[4] = useLinearBlending ? 1 : 0;
    webgpuUniforms[5] = useLinearCorrection ? 1 : 0;
    webgpuUniforms[6] = 0;
    webgpuUniforms[7] = 0;
    device.queue.writeBuffer(state.uniformBuffer, 0, webgpuUniforms);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    const alignTo4 = (value: number) => (value + 3) & ~3;
    const uploadInstanceBatches = (
      kind: "rect" | "glyph",
      batches: Array<{ array: Float32Array; offset: number }>,
    ) => {
      if (!batches.length) return;
      let totalBytes = 0;
      for (const batch of batches) {
        totalBytes = alignTo4(totalBytes);
        batch.offset = totalBytes;
        totalBytes += batch.array.byteLength;
      }
      ensureInstanceBuffer(state, kind, totalBytes);
      const buffer = kind === "rect" ? state.rectInstanceBuffer : state.glyphInstanceBuffer;
      for (const batch of batches) {
        device.queue.writeBuffer(buffer, batch.offset, batch.array);
      }
    };

    const rectPreBatches: Array<{
      array: Float32Array;
      offset: number;
      instances: number;
    }> = [];
    const rectPostBatches: Array<{
      array: Float32Array;
      offset: number;
      instances: number;
    }> = [];
    const pushRectBatch = (target: typeof rectPreBatches, data: number[]) => {
      if (!data.length) return;
      target.push({
        array: new Float32Array(data),
        offset: 0,
        instances: data.length / 8,
      });
    };

    pushRectBatch(rectPreBatches, bgData);
    pushRectBatch(rectPreBatches, selectionData);
    pushRectBatch(rectPreBatches, underlineData);
    pushRectBatch(rectPreBatches, fgRectData);
    pushRectBatch(rectPostBatches, cursorData);
    pushRectBatch(rectPostBatches, overlayData);

    const glyphMainBatches: Array<{
      array: Float32Array;
      offset: number;
      instances: number;
      pipeline: GPURenderPipeline;
      bindGroup: GPUBindGroup;
    }> = [];
    const glyphOverlayBatches: Array<{
      array: Float32Array;
      offset: number;
      instances: number;
      pipeline: GPURenderPipeline;
      bindGroup: GPUBindGroup;
    }> = [];

    for (const [fontIndex, glyphData] of glyphDataNearestByFont.entries()) {
      if (!glyphData.length) continue;
      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!atlasState?.bindGroupNearest) continue;
      glyphMainBatches.push({
        array: new Float32Array(glyphData),
        offset: 0,
        instances: glyphData.length / GLYPH_INSTANCE_FLOATS,
        pipeline: state.glyphPipelineNearest,
        bindGroup: atlasState.bindGroupNearest,
      });
    }

    for (const [fontIndex, glyphData] of glyphDataLinearByFont.entries()) {
      if (!glyphData.length) continue;
      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!atlasState?.bindGroupLinear) continue;
      glyphMainBatches.push({
        array: new Float32Array(glyphData),
        offset: 0,
        instances: glyphData.length / GLYPH_INSTANCE_FLOATS,
        pipeline: state.glyphPipeline,
        bindGroup: atlasState.bindGroupLinear,
      });
    }

    for (const [fontIndex, glyphData] of overlayGlyphDataNearestByFont.entries()) {
      if (!glyphData.length) continue;
      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!atlasState?.bindGroupNearest) continue;
      glyphOverlayBatches.push({
        array: new Float32Array(glyphData),
        offset: 0,
        instances: glyphData.length / GLYPH_INSTANCE_FLOATS,
        pipeline: state.glyphPipelineNearest,
        bindGroup: atlasState.bindGroupNearest,
      });
    }

    for (const [fontIndex, glyphData] of overlayGlyphDataLinearByFont.entries()) {
      if (!glyphData.length) continue;
      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!atlasState?.bindGroupLinear) continue;
      glyphOverlayBatches.push({
        array: new Float32Array(glyphData),
        offset: 0,
        instances: glyphData.length / GLYPH_INSTANCE_FLOATS,
        pipeline: state.glyphPipeline,
        bindGroup: atlasState.bindGroupLinear,
      });
    }

    uploadInstanceBatches("rect", [...rectPreBatches, ...rectPostBatches]);
    uploadInstanceBatches("glyph", [...glyphMainBatches, ...glyphOverlayBatches]);

    pass.setVertexBuffer(0, state.vertexBuffer);
    const drawRectBatches = (
      batches: Array<{
        array: Float32Array;
        offset: number;
        instances: number;
      }>,
    ) => {
      if (!batches.length) return;
      pass.setPipeline(state.rectPipeline);
      pass.setBindGroup(0, state.rectBindGroup);
      for (const batch of batches) {
        pass.setVertexBuffer(1, state.rectInstanceBuffer, batch.offset, batch.array.byteLength);
        pass.draw(6, batch.instances, 0, 0);
      }
    };

    const drawGlyphBatches = (
      batches: Array<{
        array: Float32Array;
        offset: number;
        instances: number;
        pipeline: GPURenderPipeline;
        bindGroup: GPUBindGroup;
      }>,
    ) => {
      for (const batch of batches) {
        pass.setPipeline(batch.pipeline);
        pass.setBindGroup(0, batch.bindGroup);
        pass.setVertexBuffer(1, state.glyphInstanceBuffer, batch.offset, batch.array.byteLength);
        pass.draw(6, batch.instances, 0, 0);
      }
    };

    drawRectBatches(rectPreBatches);
    drawGlyphBatches(glyphMainBatches);
    drawRectBatches(rectPostBatches);
    drawGlyphBatches(glyphOverlayBatches);

    pass.end();
    device.queue.submit([encoder.finish()]);
    const kittyPlacements = wasm && wasmHandle ? wasm.getKittyPlacements(wasmHandle) : [];
    drawKittyOverlay(kittyPlacements, cellW, cellH);
  }

  function tickWebGL(state: WebGLState) {
    const { gl } = state;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(defaultBg[0], defaultBg[1], defaultBg[2], defaultBg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (fontError) {
      const text = `Font error: ${fontError.message}`;
      if (termDebug) termDebug.textContent = text;
      reportDebugText(text);
    }

    updateGrid();

    const render = getRenderState();
    if (!render || !fontState.font) {
      clearKittyOverlay();
      return;
    }

    lastRenderState = render;

    const {
      rows,
      cols,
      codepoints,
      contentTags,
      wide,
      styleFlags,
      linkIds,
      fgBytes,
      bgBytes,
      ulBytes,
      ulStyle,
      graphemeOffset,
      graphemeLen,
      graphemeBuffer,
      cursor,
    } = render;

    if (!codepoints || !fgBytes) {
      clearKittyOverlay();
      return;
    }

    const mergedEmojiSkip = new Uint8Array(codepoints.length);
    const isRegionalIndicator = (value: number) => value >= 0x1f1e6 && value <= 0x1f1ff;
    const readCellCluster = (
      cellIndex: number,
    ): { cp: number; text: string; span: number } | null => {
      const flag = wide ? (wide[cellIndex] ?? 0) : 0;
      if (flag === 2 || flag === 3) return null;
      const cp = codepoints[cellIndex] ?? 0;
      if (!cp) return null;
      let text = String.fromCodePoint(cp);
      const extra =
        graphemeLen && graphemeOffset && graphemeBuffer ? (graphemeLen[cellIndex] ?? 0) : 0;
      if (extra > 0 && graphemeOffset && graphemeBuffer) {
        const start = graphemeOffset[cellIndex] ?? 0;
        const cps = [cp];
        for (let j = 0; j < extra; j += 1) {
          const extraCp = graphemeBuffer[start + j];
          if (extraCp) cps.push(extraCp);
        }
        text = String.fromCodePoint(...cps);
      }
      return { cp, text, span: flag === 1 ? 2 : 1 };
    };

    const { useLinearBlending, useLinearCorrection } = resolveBlendFlags("webgl2");

    reportTermSize(cols, rows);
    const cursorPos = cursor ? resolveCursorPosition(cursor) : null;
    reportCursor(cursorPos);
    const isBlinking = (cursor?.blinking || 0) !== 0 || FORCE_CURSOR_BLINK;
    const blinkVisible = !isBlinking || Math.floor(performance.now() / CURSOR_BLINK_MS) % 2 === 0;
    const imeFocused =
      typeof document !== "undefined" && imeInput ? document.activeElement === imeInput : false;
    const windowFocused = typeof document !== "undefined" ? document.hasFocus() : true;
    const cursorStyle = cursor
      ? resolveCursorStyle(cursor, {
          focused: isFocused || imeFocused || windowFocused,
          preedit: Boolean(imeState.preedit),
          blinkVisible,
        })
      : null;
    let cursorCell: { row: number; col: number; wide: boolean } | null = null;
    if (cursorStyle !== null && cursorPos) {
      let col = cursorPos.col;
      const row = cursorPos.row;
      let wide = false;
      if (cursorPos.wideTail && col > 0) {
        col -= 1;
        wide = true;
      }
      cursorCell = { row, col, wide };
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
    // OpenType underlinePosition is in Y-up font space (negative means below baseline).
    // Screen space is Y-down, so we flip the sign.
    const underlineOffsetPx = -underlinePosition * primaryScale;
    const underlineThicknessPx = Math.max(1, Math.ceil(underlineThickness * primaryScale));

    if (cursorPos && cursorStyle === null) {
      updateImePosition({ row: cursorPos.row, col: cursorPos.col }, cellW, cellH);
    }

    const bgData: number[] = [];
    const selectionData: number[] = [];
    const underlineData: number[] = [];
    const cursorData: number[] = [];
    const fgRectData: number[] = [];
    const overlayData: number[] = [];
    const glyphDataByFont = new Map<number, number[]>();
    const glyphQueueByFont = new Map<number, any[]>();
    const overlayGlyphDataByFont = new Map<number, number[]>();
    const overlayGlyphQueueByFont = new Map<number, any[]>();
    const neededGlyphIdsByFont = new Map<number, Set<number>>();
    const neededGlyphMetaByFont = new Map<number, Map<number, GlyphConstraintMeta>>();
    const fgColorCache = new Map<number, Color>();
    const bgColorCache = new Map<number, Color>();
    const ulColorCache = new Map<number, Color>();

    const baseScaleByFont = fontState.fonts.map((entry, idx) => {
      if (!entry?.font) return primaryScale;
      if (idx === 0) return primaryScale;
      return (
        entry.font.scaleForSize(fontSizePx, fontState.sizeMode) *
        fontScaleOverride(entry, FONT_SCALE_OVERRIDES)
      );
    });

    const scaleByFont = fontState.fonts.map((entry, idx) => {
      if (!entry?.font) return primaryScale;
      if (idx === 0) return primaryScale;
      const baseScale = baseScaleByFont[idx] ?? primaryScale;
      if (isSymbolFont(entry) || isColorEmojiFont(entry)) return baseScale;
      const advanceUnits = fontAdvanceUnits(entry, shapeClusterWithFont);
      const maxSpan = fontMaxCellSpan(entry);
      const widthPx = advanceUnits * baseScale;
      const widthAdjustRaw = widthPx > 0 ? (cellW * maxSpan) / widthPx : 1;
      const widthAdjust = clamp(widthAdjustRaw, 0.5, 2);
      let adjustedScale = baseScale * widthAdjust;
      const adjustedHeightPx = fontHeightUnits(entry.font) * adjustedScale;
      if (adjustedHeightPx > lineHeight && adjustedHeightPx > 0) {
        adjustedScale *= lineHeight / adjustedHeightPx;
      }
      return adjustedScale;
    });

    const bitmapScaleByFont = fontState.fonts.map((entry, idx) => {
      if (!entry?.font || idx === 0) return 1;
      if (isSymbolFont(entry)) return 1;
      const baseScale = baseScaleByFont[idx] ?? 0;
      if (baseScale <= 0) return 1;
      const targetScale = scaleByFont[idx] ?? baseScale;
      return clamp(targetScale / baseScale, 0.5, 2);
    });

    const baselineAdjustByFont = fontState.fonts.map((entry, idx) => {
      if (!entry?.font || idx === 0 || !primaryEntry?.font) return 0;
      const scale = scaleByFont[idx] ?? primaryScale;
      return primaryEntry.font.ascender * primaryScale - entry.font.ascender * scale;
    });

    const nerdMetrics = buildNerdMetrics(
      cellW,
      cellH,
      lineHeight,
      primaryEntry?.font,
      primaryScale,
      nerdIconScale,
    );

    const getGlyphQueue = (fontIndex: number) => {
      if (!glyphQueueByFont.has(fontIndex)) glyphQueueByFont.set(fontIndex, []);
      return glyphQueueByFont.get(fontIndex)!;
    };
    const getOverlayGlyphQueue = (fontIndex: number) => {
      if (!overlayGlyphQueueByFont.has(fontIndex)) overlayGlyphQueueByFont.set(fontIndex, []);
      return overlayGlyphQueueByFont.get(fontIndex)!;
    };
    const getGlyphSet = (fontIndex: number) => {
      if (!neededGlyphIdsByFont.has(fontIndex)) neededGlyphIdsByFont.set(fontIndex, new Set());
      return neededGlyphIdsByFont.get(fontIndex)!;
    };
    const getGlyphMeta = (fontIndex: number) => {
      if (!neededGlyphMetaByFont.has(fontIndex)) neededGlyphMetaByFont.set(fontIndex, new Map());
      return neededGlyphMetaByFont.get(fontIndex)!;
    };
    const noteGlyphMeta = (
      fontIndex: number,
      glyphId: number,
      cp: number,
      constraintWidth: number,
    ) => {
      if (!glyphId || !cp) return;
      const meta = getGlyphMeta(fontIndex);
      const prev = meta.get(glyphId);
      if (!prev) {
        const width = Math.max(1, constraintWidth || 1);
        meta.set(glyphId, {
          cp,
          constraintWidth: width,
          widths: new Set([width]),
          variable: false,
        });
        return;
      }
      if (prev.constraintWidth !== constraintWidth) {
        prev.widths?.add(Math.max(1, constraintWidth || 1));
        meta.set(glyphId, {
          ...prev,
          constraintWidth: Math.min(prev.constraintWidth, Math.max(1, constraintWidth || 1)),
          variable: true,
        });
      }
    };
    const getGlyphData = (map: Map<number, number[]>, fontIndex: number) => {
      if (!map.has(fontIndex)) map.set(fontIndex, []);
      return map.get(fontIndex)!;
    };

    const cursorBlock = cursorStyle === 0 && !!cursorCell;
    for (let row = 0; row < rows; row += 1) {
      const rowY = row * cellH;
      const baseY = rowY + yPad + baselineOffset;
      const localSel = selectionState.active ? selectionForRow(row, cols) : null;
      const selStart = localSel?.start ?? -1;
      const selEnd = localSel?.end ?? -1;
      if (selStart >= 0 && selEnd > selStart) {
        const start = Math.max(0, selStart);
        const end = Math.min(cols, selEnd);
        pushRect(selectionData, start * cellW, rowY, (end - start) * cellW, cellH, selectionColor);
      }

      for (let col = 0; col < cols; col += 1) {
        const idx = row * cols + col;
        const x = col * cellW;

        const tag = contentTags ? contentTags[idx] : 0;
        const bgOnly = tag === 2 || tag === 3;
        const flags = styleFlags ? styleFlags[idx] : 0;
        const bold = (flags & STYLE_BOLD) !== 0;
        const italic = (flags & STYLE_ITALIC) !== 0;
        const faint = (flags & STYLE_FAINT) !== 0;
        const blink = (flags & STYLE_BLINK) !== 0;
        const inverse = (flags & STYLE_INVERSE) !== 0;
        const invisible = (flags & STYLE_INVISIBLE) !== 0;
        const strike = (flags & STYLE_STRIKE) !== 0;
        const overline = (flags & STYLE_OVERLINE) !== 0;
        const underlineStyle = ulStyle ? ulStyle[idx] : (flags & STYLE_UNDERLINE_MASK) >> 8;

        let fg = decodeRGBAWithCache(fgBytes, idx, fgColorCache);
        let bg = bgBytes ? decodeRGBAWithCache(bgBytes, idx, bgColorCache) : defaultBg;
        let ul = ulBytes ? decodeRGBAWithCache(ulBytes, idx, ulColorCache) : fg;
        const underlineUsesFg =
          ul[0] === fg[0] && ul[1] === fg[1] && ul[2] === fg[2] && ul[3] === fg[3];

        if (inverse) {
          const tmp = fg;
          fg = bg;
          bg = tmp;
          if (underlineUsesFg) ul = fg;
        }

        if (bold) {
          fg = brighten(fg, BOLD_BRIGHTEN);
          ul = brighten(ul, BOLD_BRIGHTEN);
        }
        if (faint) {
          fg = fade(fg, FAINT_ALPHA);
          ul = fade(ul, FAINT_ALPHA);
        }

        const bgForText =
          bg[3] < 1
            ? [
                bg[0] + defaultBg[0] * (1 - bg[3]),
                bg[1] + defaultBg[1] * (1 - bg[3]),
                bg[2] + defaultBg[2] * (1 - bg[3]),
                1,
              ]
            : bg;
        if ((bgBytes || inverse) && bg[3] > 0) pushRect(bgData, x, rowY, cellW, cellH, bg);

        const linkId = linkIds ? (linkIds[idx] ?? 0) : 0;
        const linkHovered = linkId && linkId === linkState.hoverId;
        const blinkOff = blink && !blinkVisible;
        const textHidden = invisible || blinkOff;
        if (!textHidden && !bgOnly) {
          if (underlineStyle > 0 && ul[3] > 0) {
            drawUnderlineStyle(
              underlineData,
              underlineStyle,
              x,
              rowY,
              cellW,
              cellH,
              baseY,
              underlineOffsetPx,
              underlineThicknessPx,
              ul,
            );
          }
          if (linkHovered && !selectionState.active && !selectionState.dragging) {
            drawUnderlineStyle(
              underlineData,
              1,
              x,
              rowY,
              cellW,
              cellH,
              baseY,
              underlineOffsetPx,
              underlineThicknessPx,
              ul,
            );
          }
          if (strike) drawStrikethrough(underlineData, x, rowY, cellW, cellH, fg);
          if (overline) drawOverline(underlineData, x, rowY, cellW, fg);
        }

        if (bgOnly || textHidden) continue;

        if (mergedEmojiSkip[idx]) continue;
        const cluster = readCellCluster(idx);
        if (!cluster) continue;
        const cp = cluster.cp;
        if (cp === KITTY_PLACEHOLDER_CP) continue;
        let text = cluster.text;
        let baseSpan = cluster.span;
        const rowEnd = row * cols + cols;

        if (isRegionalIndicator(cp)) {
          const nextIdx = idx + baseSpan;
          if (nextIdx < rowEnd && !mergedEmojiSkip[nextIdx]) {
            const next = readCellCluster(nextIdx);
            if (next && isRegionalIndicator(next.cp)) {
              text += next.text;
              baseSpan += next.span;
              mergedEmojiSkip[nextIdx] = 1;
            }
          }
        }

        let nextSeqIdx = idx + baseSpan;
        let guard = 0;
        while (nextSeqIdx < rowEnd && guard < 12) {
          const next = readCellCluster(nextSeqIdx);
          if (!next || !next.cp || isSpaceCp(next.cp)) break;
          const shouldMerge =
            text.endsWith("\u200d") || shouldMergeTrailingClusterCodepoint(next.cp);
          if (!shouldMerge) break;
          text += next.text;
          baseSpan += next.span;
          mergedEmojiSkip[nextSeqIdx] = 1;
          nextSeqIdx += next.span;
          guard += 1;
        }

        const extra = text.length > String.fromCodePoint(cp).length ? 1 : 0;
        if (extra === 0 && isSpaceCp(cp)) continue;

        if (
          cursorBlock &&
          cursorCell &&
          row === cursorCell.row &&
          col >= cursorCell.col &&
          col < cursorCell.col + (cursorCell.wide ? 2 : 1)
        ) {
          fg = [bgForText[0], bgForText[1], bgForText[2], 1];
        }

        if (isBlockElement(cp)) {
          if (drawBlockElement(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
        }
        if (isBoxDrawing(cp)) {
          if (drawBoxDrawing(cp, x, rowY, cellW, cellH, fg, fgRectData, underlineThicknessPx))
            continue;
        }
        if (isBraille(cp)) {
          if (drawBraille(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
        }
        if (isPowerline(cp)) {
          if (drawPowerline(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
        }

        if (extra > 0 && text.trim() === "") continue;

        const fontIndex = pickFontIndexForText(
          text,
          baseSpan,
          stylePreferenceFromFlags(bold, italic),
        );
        const fontEntry = fontState.fonts[fontIndex] ?? fontState.fonts[0];
        const shaped = shapeClusterWithFont(fontEntry, text);
        if (!shaped.glyphs.length) continue;
        noteColorGlyphText(fontEntry, text, shaped);
        const glyphSet = getGlyphSet(fontIndex);
        for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);

        const fontScale = scaleByFont[fontIndex] ?? primaryScale;
        let cellSpan = baseSpan;
        const symbolLike = isRenderSymbolLike(cp);
        const nerdConstraint = symbolLike ? resolveSymbolConstraint(cp) : null;
        const symbolConstraint = !!nerdConstraint;
        let constraintWidth = baseSpan;
        let forceFit = false;
        let glyphWidthPx = 0;
        if (symbolLike) {
          if (baseSpan === 1) {
            // Match Ghostty behavior for icon-like Nerd glyphs: allow 2-cell span only
            // when followed by whitespace and not in a symbol run.
            if (nerdConstraint?.height === "icon") {
              constraintWidth = 1;
              if (col < cols - 1) {
                if (col > 0) {
                  const prevCp = codepoints[idx - 1];
                  if (isRenderSymbolLike(prevCp) && !isGraphicsElement(prevCp)) {
                    constraintWidth = 1;
                  } else {
                    const nextCp = codepoints[idx + 1];
                    if (!nextCp || isSpaceCp(nextCp)) constraintWidth = 2;
                  }
                } else {
                  const nextCp = codepoints[idx + 1];
                  if (!nextCp || isSpaceCp(nextCp)) constraintWidth = 2;
                }
              }
            } else {
              constraintWidth = 1;
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
        if (symbolConstraint) {
          for (const glyph of shaped.glyphs) {
            noteGlyphMeta(fontIndex, glyph.glyphId, cp, constraintWidth);
          }
        }
        const cellWidthPx = cellW * cellSpan;
        const xPad = 0;

        getGlyphQueue(fontIndex).push({
          x,
          baseY,
          xPad,
          fg,
          bg: bgForText,
          shaped,
          fontIndex,
          scale: fontScale,
          cellWidth: cellWidthPx,
          symbolLike,
          symbolConstraint,
          constraintWidth,
          forceFit,
          glyphWidthPx,
          cp,
          italic,
          bold,
        });
      }
    }

    if (cursor && imeState.preedit) {
      const preeditText = imeState.preedit;
      const preeditFontIndex = pickFontIndexForText(preeditText, 1);
      const preeditEntry = fontState.fonts[preeditFontIndex] ?? fontState.fonts[0];
      const shaped = shapeClusterWithFont(preeditEntry, preeditText);
      noteColorGlyphText(preeditEntry, preeditText, shaped);
      const glyphSet = getGlyphSet(preeditFontIndex);
      for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);
      const preeditRow = cursorCell?.row ?? cursorPos?.row ?? cursor.row;
      const preeditCol = cursorCell?.col ?? cursorPos?.col ?? cursor.col;
      const baseY = preeditRow * cellH + yPad + baselineOffset;
      const x = preeditCol * cellW;
      const preeditScale = scaleByFont[preeditFontIndex] ?? primaryScale;
      const advancePx = shaped.advance * preeditScale;
      const widthPx = Math.max(cellW, advancePx);
      const rowY = preeditRow * cellH;
      pushRect(bgData, x, rowY, widthPx, cellH, PREEDIT_BG);
      const thickness = underlineThicknessPx;
      const underlineBaseY = clamp(
        baseY + underlineOffsetPx,
        rowY + 1,
        rowY + cellH - thickness - 1,
      );
      pushRect(underlineData, x, underlineBaseY, widthPx, thickness, PREEDIT_UL);
      const selStart = imeState.selectionStart || 0;
      const selEnd = imeState.selectionEnd || 0;
      if (selEnd > selStart) {
        const leftWidth =
          shapeClusterWithFont(preeditEntry, preeditText.slice(0, selStart)).advance * preeditScale;
        const selWidth =
          shapeClusterWithFont(preeditEntry, preeditText.slice(selStart, selEnd)).advance *
          preeditScale;
        pushRect(bgData, x + leftWidth, rowY, selWidth, cellH, PREEDIT_ACTIVE_BG);
        pushRect(underlineData, x + leftWidth, underlineBaseY, selWidth, thickness, PREEDIT_UL);
      } else {
        const caretWidth = Math.max(1, Math.floor(cellW * 0.1));
        const caretX =
          x +
          shapeClusterWithFont(preeditEntry, preeditText.slice(0, selStart)).advance * preeditScale;
        pushRect(cursorData, caretX, rowY + 2, caretWidth, cellH - 4, PREEDIT_CARET);
      }
      getGlyphQueue(preeditFontIndex).push({
        x,
        baseY,
        xPad: 0,
        fg: PREEDIT_FG,
        bg: PREEDIT_BG,
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
          const overlayBg: Color = [0, 0, 0, 0.6 * alpha];
          pushRectBox(overlayData, boxX, boxY, boxW, boxH, overlayBg);
          pushRectBox(overlayData, boxX, boxY, boxW, 1, [1, 1, 1, 0.12 * alpha]);
          const textRowY = boxY + (boxH - lineHeight) * 0.5;
          const baseY = textRowY + yPad + baselineOffset;
          getOverlayGlyphQueue(0).push({
            x: boxX + padX,
            baseY,
            xPad: 0,
            fg: [1, 1, 1, alpha],
            bg: overlayBg,
            shaped,
            fontIndex: 0,
            scale: primaryScale,
            cellWidth: textWidth,
            symbolLike: false,
          });
        }
      }
    }

    // Cursor
    if (cursorStyle !== null && cursorPos) {
      let cursorCol = cursorPos.col;
      let cursorRow = cursorPos.row;
      let cursorWidth = cellW;
      if (cursorPos.wideTail && cursorCol > 0) {
        cursorCol -= 1;
        cursorWidth = cellW * 2;
      }
      if (cursorRow < rows && cursorCol < cols) {
        const x = cursorCol * cellW;
        const y = cursorRow * cellH;
        const cursorColor = cursor?.color ? decodePackedRGBA(cursor.color) : cursorFallback;
        const cursorThicknessPx = underlineThicknessPx;
        updateImePosition({ row: cursorRow, col: cursorCol }, cellW, cellH);
        if (cursorStyle === 0) {
          pushRect(fgRectData, x, y, cursorWidth, cellH, cursorColor);
        } else if (cursorStyle === 1) {
          const offset = Math.floor((cursorThicknessPx + 1) / 2);
          pushRect(cursorData, x - offset, y, cursorThicknessPx, cellH, cursorColor);
        } else if (cursorStyle === 2) {
          const baseY = cursorRow * cellH + yPad + baselineOffset;
          const underlineY = clamp(
            baseY + underlineOffsetPx,
            y + 1,
            y + cellH - cursorThicknessPx - 1,
          );
          pushRect(cursorData, x, underlineY, cursorWidth, cursorThicknessPx, cursorColor);
        } else if (cursorStyle === 3) {
          pushRect(cursorData, x, y, cursorWidth, cursorThicknessPx, cursorColor);
          pushRect(
            cursorData,
            x,
            y + cellH - cursorThicknessPx,
            cursorWidth,
            cursorThicknessPx,
            cursorColor,
          );
          pushRect(cursorData, x, y, cursorThicknessPx, cellH, cursorColor);
          pushRect(
            cursorData,
            x + cursorWidth - cursorThicknessPx,
            y,
            cursorThicknessPx,
            cellH,
            cursorColor,
          );
        } else {
          pushRect(cursorData, x, y, cursorWidth, cellH, cursorColor);
        }
      }
    }

    if (wasmExports && wasmHandle && wasmExports.restty_scrollbar_total) {
      const total = wasmExports.restty_scrollbar_total(wasmHandle) || 0;
      const offset = wasmExports.restty_scrollbar_offset
        ? wasmExports.restty_scrollbar_offset(wasmHandle)
        : 0;
      const len = wasmExports.restty_scrollbar_len
        ? wasmExports.restty_scrollbar_len(wasmHandle)
        : rows;
      if (
        total !== scrollbarState.lastTotal ||
        offset !== scrollbarState.lastOffset ||
        len !== scrollbarState.lastLen
      ) {
        scrollbarState.lastTotal = total;
        scrollbarState.lastOffset = offset;
        scrollbarState.lastLen = len;
      }
      appendOverlayScrollbar(overlayData, total, offset, len);
    }

    // Update glyph atlases for WebGL
    for (const [fontIndex, neededIds] of neededGlyphIdsByFont.entries()) {
      const fontEntry = fontState.fonts[fontIndex];
      if (!fontEntry?.font) continue;
      let atlasState = state.glyphAtlases.get(fontIndex);
      const meta = neededGlyphMetaByFont.get(fontIndex);

      // Use bitmap scale for symbol fonts (matches WebGPU)
      const bitmapScale = bitmapScaleByFont[fontIndex] ?? 1;
      const constraintContext = meta
        ? {
            cellW,
            cellH,
            yPad,
            baselineOffset,
            baselineAdjust: baselineAdjustByFont[fontIndex] ?? 0,
            fontScale: scaleByFont[fontIndex] ?? primaryScale,
            nerdMetrics,
            fontEntry,
          }
        : null;

      const built = buildFontAtlasIfNeeded({
        entry: fontEntry,
        neededGlyphIds: neededIds,
        glyphMeta: meta,
        fontSizePx,
        atlasScale: bitmapScale,
        fontIndex,
        constraintContext,
        deps: {
          fontScaleOverrides: FONT_SCALE_OVERRIDES,
          sizeMode: fontState.sizeMode,
          isSymbolFont,
          fontScaleOverride,
          resolveGlyphPixelMode,
          atlasBitmapToRGBA,
          padAtlasRGBA,
          buildAtlas,
          buildGlyphAtlasWithConstraints,
          buildColorEmojiAtlasWithCanvas,
          rasterizeGlyph,
          rasterizeGlyphWithTransform,
          nerdConstraintSignature,
          constants: {
            atlasPadding: ATLAS_PADDING,
            symbolAtlasPadding: SYMBOL_ATLAS_PADDING,
            symbolAtlasMaxSize: SYMBOL_ATLAS_MAX_SIZE,
            defaultAtlasMaxSize: 2048,
            pixelModeRgbaValue: PixelMode.RGBA ?? 4,
          },
          resolvePreferNearest: ({ fontIndex: idx, isSymbol }) => idx === 0 || isSymbol,
        },
      });

      if (!built.rebuilt || !built.atlas || !built.rgba) continue;
      const atlas = built.atlas;
      const colorGlyphs = built.colorGlyphs;
      const rgba = built.rgba;
      const preferNearest = built.preferNearest;

      if (atlasState) {
        gl.deleteTexture(atlasState.texture);
      }

      const texture = gl.createTexture();
      if (!texture) continue;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        atlas.bitmap.width,
        atlas.bitmap.rows,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(rgba),
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        preferNearest ? gl.NEAREST : gl.LINEAR,
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        preferNearest ? gl.NEAREST : gl.LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      atlasState = {
        texture,
        width: atlas.bitmap.width,
        height: atlas.bitmap.rows,
        inset: atlas.inset,
        colorGlyphs,
        nearest: preferNearest,
      };
      state.glyphAtlases.set(fontIndex, atlasState);
    }

    const emitGlyphs = (queueByFont: Map<number, any[]>, targetMap: Map<number, number[]>) => {
      for (const [fontIndex, queue] of queueByFont.entries()) {
        const entry = fontState.fonts[fontIndex];
        const atlasState = state.glyphAtlases?.get(fontIndex);
        if (!entry || !entry.atlas || !atlasState) continue;
        const atlas = entry.atlas;
        const atlasW = atlas.bitmap.width;
        const atlasH = atlas.bitmap.rows;
        const baseInset = Number.isFinite(atlas.inset) ? atlas.inset : 0;
        const uvInset = baseInset + (atlasState.nearest ? 0.5 : 0);
        const colorGlyphs = atlasState.colorGlyphs ?? atlas.colorGlyphs;
        const glyphData = getGlyphData(targetMap, fontIndex);
        for (const item of queue) {
          const bg = item.bg ?? defaultBg;
          let penX = 0;
          const scale = item.scale ?? primaryScale;
          const maxWidth = item.cellWidth ?? cellW;
          const maxHeight = cellH;
          const symbolLike = item.symbolLike;
          const symbolConstraint = item.symbolConstraint;
          let itemScale = scale;
          if (!symbolConstraint) {
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
          }
          const scaleFactor = scale > 0 ? itemScale / scale : 1;
          const widthKey = item.constraintWidth ?? 0;
          const widthMap = atlas.glyphsByWidth?.get(widthKey);
          for (const glyph of item.shaped.glyphs) {
            const colorGlyph = !!colorGlyphs?.has(glyph.glyphId);
            const metrics = widthMap?.get(glyph.glyphId) ?? atlas.glyphs.get(glyph.glyphId);
            if (!metrics) continue;
            let bitmapScale = scaleFactor;
            const glyphConstrained = symbolLike && !!widthMap?.has(glyph.glyphId);
            if (glyphConstrained) bitmapScale = 1;
            if (fontIndex > 0 && !symbolLike) {
              const widthScale = maxWidth > 0 ? maxWidth / metrics.width : 1;
              const heightScale = maxHeight > 0 ? maxHeight / metrics.height : 1;
              const clampScale = Math.min(1, widthScale, heightScale);
              bitmapScale *= clampScale;
            }
            const baselineAdjust = baselineAdjustByFont[fontIndex] ?? 0;
            let gw = metrics.width * bitmapScale;
            let gh = metrics.height * bitmapScale;
            if (symbolLike && !glyphConstrained) {
              const scaleToFit = gw > 0 && gh > 0 ? Math.min(maxWidth / gw, maxHeight / gh) : 1;
              if (scaleToFit < 1) {
                bitmapScale *= scaleToFit;
                gw *= scaleToFit;
                gh *= scaleToFit;
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
            if (!glyphConstrained && symbolLike && item.cp) {
              const nerdConstraint = resolveSymbolConstraint(item.cp);
              const defaultConstraint = isAppleSymbolsFont(entry)
                ? DEFAULT_APPLE_SYMBOLS_CONSTRAINT
                : DEFAULT_SYMBOL_CONSTRAINT;
              const constraint =
                nerdConstraint ?? (colorGlyph ? DEFAULT_EMOJI_CONSTRAINT : defaultConstraint);
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
              const tightened = nerdConstraint
                ? tightenNerdConstraintBox(adjusted, nerdConstraint)
                : adjusted;
              x = item.x + tightened.x;
              y = rowY + tightened.y;
              gw = tightened.width;
              gh = tightened.height;
            }
            if (gw < 1) gw = 1;
            if (gh < 1) gh = 1;
            const px = Math.round(x);
            const py = Math.round(y);
            const insetX = Math.min(uvInset, (metrics.width - 1) * 0.5);
            const insetY = Math.min(uvInset, (metrics.height - 1) * 0.5);
            const u0 = (metrics.atlasX + insetX) / atlasW;
            const v0 = (metrics.atlasY + insetY) / atlasH;
            const u1 = (metrics.atlasX + metrics.width - insetX) / atlasW;
            const v1 = (metrics.atlasY + metrics.height - insetY) / atlasH;
            const italic = !!item.italic;
            const bold = !!item.bold;
            const syntheticItalic = italic && !fontEntryHasItalicStyle(entry);
            const syntheticBold = bold && !fontEntryHasBoldStyle(entry);
            const slant = syntheticItalic && !colorGlyph ? gh * ITALIC_SLANT : 0;
            const boldOffset =
              syntheticBold && !colorGlyph ? Math.max(1, Math.round(gw * BOLD_OFFSET)) : 0;
            const renderMode = colorGlyph ? GLYPH_RENDER_MODE_COLOR : GLYPH_RENDER_MODE_MONO;
            const pushGlyph = (xPos: number) => {
              glyphData.push(
                xPos,
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
                bg[0],
                bg[1],
                bg[2],
                bg[3],
                slant,
                renderMode,
              );
            };
            pushGlyph(px);
            if (boldOffset > 0) {
              const minGlyphX = Math.round(item.x);
              const maxGlyphX = Math.round(item.x + maxWidth - gw);
              let bx = clamp(px + boldOffset, minGlyphX, maxGlyphX);
              if (bx === px) bx = clamp(px - boldOffset, minGlyphX, maxGlyphX);
              // If a glyph fully occupies its cell, we can't offset; reinforce at the same x.
              if (bx === px) pushGlyph(px);
              else pushGlyph(bx);
            }
            penX += glyph.xAdvance;
          }
        }
      }
    };

    emitGlyphs(glyphQueueByFont, glyphDataByFont);
    emitGlyphs(overlayGlyphQueueByFont, overlayGlyphDataByFont);

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
      gl.uniform2f(state.rectBlendLoc, useLinearBlending ? 1 : 0, useLinearCorrection ? 1 : 0);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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
      gl.uniform2f(state.glyphBlendLoc, useLinearBlending ? 1 : 0, useLinearCorrection ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlasState.texture);
      gl.uniform1i(state.glyphAtlasLoc, 0);
      // Use premultiplied alpha blend mode (shader outputs premultiplied colors)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.length / GLYPH_INSTANCE_FLOATS);
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

    for (const [fontIndex, glyphData] of overlayGlyphDataByFont.entries()) {
      drawGlyphs(fontIndex, glyphData);
    }

    const kittyPlacements = wasm && wasmHandle ? wasm.getKittyPlacements(wasmHandle) : [];
    drawKittyOverlay(kittyPlacements, cellW, cellH);
  }

  function updateFps() {
    frameCount += 1;
    const now = performance.now();
    if (now - lastFpsTime >= 500) {
      const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      if (fpsEl) fpsEl.textContent = `${fps}`;
      callbacks?.onFps?.(fps);
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
      const resizeActive = now - resizeState.lastAt <= RESIZE_ACTIVE_MS;
      if (resizeActive) {
        // During live resize, render on every animation frame.
        needsRender = true;
      } else if (resizeWasActive) {
        flushPendingTerminalResize();
      }
      resizeWasActive = resizeActive;
      const hidden =
        typeof document !== "undefined" &&
        typeof document.visibilityState === "string" &&
        document.visibilityState !== "visible";
      const targetRenderFps = hidden ? BACKGROUND_RENDER_FPS : TARGET_RENDER_FPS;
      const renderBudget = resizeActive ? true : now - lastRenderTime >= 1000 / targetRenderFps;
      if (needsRender && renderBudget) {
        if (backend === "webgpu") tickWebGPU(state);
        if (backend === "webgl2") tickWebGL(state);
        lastRenderTime = now;
        needsRender = false;
        updateFps();
      }
    }
    rafId = requestAnimationFrame(() => loop(state));
  }

  const onWasmLog = (text: string) => {
    if (shouldSuppressWasmLog(text)) return;
    console.log(`[wasm] ${text}`);
    appendLog(`[wasm] ${text}`);
  };
  if (session.addWasmLogListener) {
    session.addWasmLogListener(onWasmLog);
    cleanupFns.push(() => session.removeWasmLogListener?.(onWasmLog));
  }

  async function initWasm() {
    if (wasmReady && wasm) return wasm;
    const instance = await session.getWasm();
    wasm = instance;
    wasmExports = instance.exports;
    wasmReady = true;
    return instance;
  }

  function writeToWasm(handle, text) {
    if (!wasm) return;
    wasm.write(handle, text);
  }

  function flushWasmOutputToPty() {
    if (!wasm || !wasmHandle) return;
    if (!ptyTransport.isConnected()) return;

    let iterations = 0;
    while (iterations < 32) {
      const out = wasm.drainOutput(wasmHandle);
      if (!out) break;
      ptyTransport.sendInput(out);
      iterations += 1;
    }
  }

  function normalizeNewlines(text) {
    return text.replace(/\r?\n/g, "\r\n");
  }

  function runBeforeInputHook(text: string, source: string): string | null {
    if (!beforeInputHook) return text;
    try {
      const next = beforeInputHook({ text, source });
      if (next === null) return null;
      if (typeof next === "string") return next;
      return text;
    } catch (error) {
      console.error("[restty] beforeInput hook error:", error);
      return text;
    }
  }

  function runBeforeRenderOutputHook(text: string, source: string): string | null {
    if (!beforeRenderOutputHook) return text;
    try {
      const next = beforeRenderOutputHook({ text, source });
      if (next === null) return null;
      if (typeof next === "string") return next;
      return text;
    } catch (error) {
      console.error("[restty] beforeRenderOutput hook error:", error);
      return text;
    }
  }

  function sendInput(text, source = "program", options: { skipHooks?: boolean } = {}) {
    if (!wasmReady || !wasm || !wasmHandle) return;
    if (!text) return;
    let intercepted = text;
    if (!options.skipHooks) {
      intercepted =
        source === "pty" ? runBeforeRenderOutputHook(text, source) : runBeforeInputHook(text, source);
    }
    if (!intercepted) return;
    const normalized = source === "pty" ? intercepted : normalizeNewlines(intercepted);
    if (source === "key") {
      const bytes = textEncoder.encode(normalized);
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
      const debugText = `${hex} (${bytes.length})`;
      if (inputDebugEl) inputDebugEl.textContent = debugText;
      callbacks?.onInputDebug?.(debugText);
    }
    if (source === "key") {
      let before = "";
      if (wasmExports?.restty_debug_cursor_x && wasmExports?.restty_debug_cursor_y) {
        const bx = wasmExports.restty_debug_cursor_x(wasmHandle);
        const by = wasmExports.restty_debug_cursor_y(wasmHandle);
        before = ` cursor=${bx},${by}`;
      }
      appendLog(`[key] ${JSON.stringify(normalized)}${before}`);
    }
    if (source === "key" && (selectionState.active || selectionState.dragging)) {
      clearSelection();
    }
    if (source === "pty" && linkState.hoverId) updateLinkHover(null);
    writeToWasm(wasmHandle, normalized);
    flushWasmOutputToPty();
    if (source === "pty" && inputHandler?.isSynchronizedOutput?.()) {
      scheduleSyncOutputReset();
      return;
    }
    cancelSyncOutputReset();
    wasm.renderUpdate(wasmHandle);
    if (
      source === "key" &&
      wasmExports?.restty_debug_cursor_x &&
      wasmExports?.restty_debug_cursor_y
    ) {
      const ax = wasmExports.restty_debug_cursor_x(wasmHandle);
      const ay = wasmExports.restty_debug_cursor_y(wasmHandle);
      appendLog(`[key] after cursor=${ax},${ay}`);
    }
    needsRender = true;
  }

  async function copySelectionToClipboard() {
    const text = getSelectionText();
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      appendLog("[ui] selection copied");
      return true;
    } catch {
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
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sendPasteText(text);
        return true;
      }
    } catch (err) {
      appendLog(`[ui] paste failed: ${err?.message ?? err}`);
    }
    return false;
  }

  async function handlePasteShortcut(event: KeyboardEvent) {
    const pasted = await pasteFromClipboard();
    if (pasted) return;
    const seq = inputHandler.encodeKeyEvent(event);
    if (!seq) return;
    sendKeyInput(seq);
  }

  function clearScreen() {
    sendInput("\x1b[2J\x1b[H");
  }

  if (attachWindowEvents) {
    const hasInputFocus = () => {
      if (typeof document === "undefined") return true;
      const active = document.activeElement;
      return active === canvas || (imeInput ? active === imeInput : false);
    };

    const isMacInputSourceShortcut = (event: KeyboardEvent) =>
      isMacPlatform &&
      event.ctrlKey &&
      !event.metaKey &&
      (event.code === "Space" || event.key === " " || event.key === "Spacebar");

    const shouldSkipKeyEvent = (event: KeyboardEvent) => {
      const imeActive =
        typeof document !== "undefined" && imeInput ? document.activeElement === imeInput : false;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target !== imeInput &&
        ["BUTTON", "SELECT", "INPUT", "TEXTAREA"].includes(target.tagName)
      ) {
        return true;
      }
      if (target === imeInput) {
        if (imeState.composing || event.isComposing) return true;
        if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !event.repeat)
          return true;
      }
      if (
        imeInput &&
        imeActive &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.length === 1 &&
        !event.repeat &&
        !event.isComposing &&
        !imeState.composing
      ) {
        return true;
      }
      return false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isMacInputSourceShortcut(event)) return;
      if (shouldSkipKeyEvent(event)) return;
      if (!hasInputFocus()) return;
      isFocused = true;
      if (!wasmReady || !wasmHandle) return;

      const key = event.key?.toLowerCase?.() ?? "";
      const wantsCopy =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (key === "c" || (event.shiftKey && key === "c"));
      const wantsPaste =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (key === "v" || (event.shiftKey && key === "v"));

      if (wantsCopy && selectionState.active) {
        event.preventDefault();
        copySelectionToClipboard();
        return;
      }
      if (wantsPaste) {
        event.preventDefault();
        if (imeInput) imeInput.focus({ preventScroll: true });
        void handlePasteShortcut(event);
        return;
      }

      const seq = inputHandler.encodeKeyEvent(event);
      if (seq) {
        if (
          event.type === "keydown" &&
          ["Backspace", "Delete", "Del", "Enter"].includes(event.key)
        ) {
          lastKeydownSeq = seq;
          lastKeydownSeqAt = performance.now();
        }
        event.preventDefault();
        sendKeyInput(seq);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isMacInputSourceShortcut(event)) return;
      if (!wasm || !wasmHandle) return;
      if ((wasm.getKittyKeyboardFlags(wasmHandle) & KITTY_FLAG_REPORT_EVENTS) === 0) return;
      if (shouldSkipKeyEvent(event)) return;
      if (!hasInputFocus()) return;
      isFocused = true;
      if (!wasmReady || !wasmHandle) return;

      const seq = inputHandler.encodeKeyEvent(event);
      if (seq) {
        event.preventDefault();
        sendKeyInput(seq);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cleanupFns.push(() => window.removeEventListener("keydown", onKeyDown));
    cleanupFns.push(() => window.removeEventListener("keyup", onKeyUp));
  }

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
        throw new Error("restty create failed (restty_create returned 0)");
      }
      instance.setPixelSize(wasmHandle, canvas.width, canvas.height);
      if (activeTheme) {
        applyTheme(activeTheme, activeTheme.name ?? "cached theme");
      }
      instance.renderUpdate(wasmHandle);
      needsRender = true;
    } catch (err) {
      console.error(`restty error: ${err.message}`);
    }
  }

  async function init() {
    cancelAnimationFrame(rafId);
    updateSize();

    log("initializing...");
    await ensureFont();
    updateGrid();
    const wasmPromise = initWasmHarness();

    // Try WebGPU first (unless WebGL2 is explicitly preferred)
    if (preferredRenderer !== "webgl2") {
      if (currentContextType === "webgl2") {
        replaceCanvas();
      }
      const gpuCore = await session.getWebGPUCore(canvas);
      const gpuState = gpuCore ? await initWebGPU(canvas, { core: gpuCore }) : null;
      if (gpuState) {
        backend = "webgpu";
        currentContextType = "webgpu";
        if (backendEl) backendEl.textContent = "webgpu";
        callbacks?.onBackend?.("webgpu");
        log("webgpu ready");
        activeState = gpuState;
        // Reconfigure context for current canvas size
        gpuState.context.configure({
          device: gpuState.device,
          format: gpuState.format,
          alphaMode: "opaque",
        });
        updateGrid();
        needsRender = true;
        console.log(
          `[init webgpu] canvas=${canvas.width}x${canvas.height} grid=${gridState.cols}x${gridState.rows}`,
        );
        await wasmPromise;
        requestAnimationFrame(() => loop(gpuState));
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
        callbacks?.onBackend?.("webgl2");
        log("webgl2 ready");
        activeState = glState;
        updateGrid();
        needsRender = true;
        console.log(
          `[init webgl2] canvas=${canvas.width}x${canvas.height} grid=${gridState.cols}x${gridState.rows}`,
        );
        await wasmPromise;
        requestAnimationFrame(() => loop(glState));
        return;
      }
    }

    backend = "none";
    if (backendEl) backendEl.textContent = "none";
    callbacks?.onBackend?.("none");
    log("no GPU backend available");
    activeState = null;
    await wasmPromise;
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    if (sizeRaf) cancelAnimationFrame(sizeRaf);
    if (terminalResizeTimer) {
      clearTimeout(terminalResizeTimer);
      terminalResizeTimer = 0;
    }
    cancelSyncOutputReset();
    pendingTerminalResize = null;
    disconnectPty();
    ptyTransport.destroy?.();
    if (wasm && wasmHandle) {
      try {
        wasm.destroy(wasmHandle);
      } catch {
        // ignore wasm destroy errors
      }
      wasmHandle = 0;
    }
    for (const cleanup of cleanupCanvasFns) cleanup();
    cleanupCanvasFns.length = 0;
    for (const cleanup of cleanupFns) cleanup();
    cleanupFns.length = 0;
    for (const entry of kittyImageCache.values()) releaseKittyImage(entry);
    kittyImageCache.clear();
    kittyDecodePending.clear();
    if (kittyOverlayCanvas?.parentElement) {
      kittyOverlayCanvas.parentElement.removeChild(kittyOverlayCanvas);
    }
    kittyOverlayCanvas = null;
    kittyOverlayCtx = null;
  }

  function setRenderer(value: "auto" | "webgpu" | "webgl2") {
    if (value !== "auto" && value !== "webgpu" && value !== "webgl2") return;
    preferredRenderer = value;
    init();
  }

  function setPaused(value: boolean) {
    paused = Boolean(value);
  }

  function togglePause() {
    paused = !paused;
  }

  function setMouseMode(value: MouseMode) {
    inputHandler.setMouseMode(value);
    updateMouseStatus();
  }

  function getMouseStatus() {
    return inputHandler.getMouseStatus();
  }

  setPtyStatus("disconnected");
  updateMouseStatus();

  return {
    init,
    destroy,
    setRenderer,
    setPaused,
    togglePause,
    setFontSize: applyFontSize,
    setFontSources,
    applyTheme,
    resetTheme,
    sendInput,
    sendKeyInput,
    clearScreen,
    connectPty,
    disconnectPty,
    isPtyConnected: () => ptyTransport.isConnected(),
    setMouseMode,
    getMouseStatus,
    copySelectionToClipboard,
    pasteFromClipboard,
    dumpAtlasForCodepoint,
    resize,
    focus,
    blur,
    updateSize,
    getBackend: () => backend,
  };
}

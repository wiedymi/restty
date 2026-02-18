import type { FontEntry, FontManagerState } from "../../fonts";
import type { NerdConstraint } from "../../fonts/nerd-constraints";
import type { Color, WebGPUState } from "../../renderer";
import type { CompiledWebGPUShaderStage, WebGPUStageTargets } from "../create-app-types";
import type { GlyphConstraintMeta } from "../atlas-builder";
import type { KittyPlacement, RenderState, ResttyWasm, ResttyWasmExports } from "../../wasm";
import type { KittyDrawPlan, KittyDrawSlice } from "./kitty-render-runtime";
import type { ResttyFontHintTarget } from "../types";

export type CursorPosition = {
  col: number;
  row: number;
  wideTail: boolean;
};

export type GlyphShape = {
  glyphId: number;
  xAdvance: number;
  xOffset: number;
  yOffset: number;
};

export type ShapedCluster = {
  glyphs: GlyphShape[];
  advance: number;
};

export type NerdMetrics = {
  cellWidth: number;
  cellHeight: number;
  faceWidth: number;
  faceHeight: number;
  faceY: number;
  iconHeight: number;
  iconHeightSingle: number;
};

export type GlyphQueueItem = {
  x: number;
  baseY: number;
  xPad: number;
  fg: Color;
  bg: Color;
  shaped: ShapedCluster;
  fontIndex: number;
  scale: number;
  cellWidth: number;
  symbolLike: boolean;
  symbolConstraint?: boolean;
  constraintWidth?: number;
  forceFit?: boolean;
  glyphWidthPx?: number;
  cp?: number;
  italic?: boolean;
  bold?: boolean;
};

export type WebGPUFrame = {
  bgData: number[];
  selectionData: number[];
  underlineData: number[];
  cursorData: number[];
  fgRectData: number[];
  overlayData: number[];
  glyphDataNearestByFont: Map<number, number[]>;
  glyphDataLinearByFont: Map<number, number[]>;
  glyphQueueByFont: Map<number, GlyphQueueItem[]>;
  overlayGlyphDataNearestByFont: Map<number, number[]>;
  overlayGlyphDataLinearByFont: Map<number, number[]>;
  overlayGlyphQueueByFont: Map<number, GlyphQueueItem[]>;
  neededGlyphIdsByFont: Map<number, Set<number>>;
  neededGlyphMetaByFont: Map<number, Map<number, GlyphConstraintMeta>>;
  scaleByFont: number[];
  bitmapScaleByFont: number[];
  baselineAdjustByFont: number[];
  nerdMetrics: NerdMetrics;
  getGlyphQueue: (fontIndex: number) => GlyphQueueItem[];
  getOverlayGlyphQueue: (fontIndex: number) => GlyphQueueItem[];
  getGlyphSet: (fontIndex: number) => Set<number>;
};

export type WebGPURenderInput = {
  rows: number;
  cols: number;
  codepoints: Uint32Array;
  contentTags: Uint8Array | null;
  wide: Uint8Array | null;
  styleFlags: Uint16Array | null;
  linkIds: Uint32Array | null;
  fgBytes: Uint8Array;
  bgBytes: Uint8Array | null;
  ulBytes: Uint8Array | null;
  ulStyle: Uint8Array | null;
  graphemeOffset: Uint32Array | null;
  graphemeLen: Uint32Array | null;
  graphemeBuffer: Uint32Array | null;
};

export type SharedTickDeps = {
  fontState: FontManagerState;
  fontHeightUnits: (font: FontEntry["font"]) => number;
  fontScaleOverride: (
    entry: FontEntry,
    overrides: Array<{ match: RegExp; scale: number }>,
  ) => number;
  FONT_SCALE_OVERRIDES: Array<{ match: RegExp; scale: number }>;
  getFontHinting: () => boolean;
  getFontHintTarget: () => ResttyFontHintTarget;
  isSymbolFont: (entry: FontEntry) => boolean;
  isColorEmojiFont: (entry: FontEntry) => boolean;
  fontAdvanceUnits: (
    entry: FontEntry,
    shapeClusterWithFont: (entry: FontEntry, text: string) => ShapedCluster,
  ) => number;
  shapeClusterWithFont: (entry: FontEntry, text: string) => ShapedCluster;
  fontMaxCellSpan: (entry: FontEntry) => number;
  clamp: (value: number, min: number, max: number) => number;
  buildNerdMetrics: (
    cellW: number,
    cellH: number,
    lineHeight: number,
    primaryFont: FontEntry["font"] | undefined,
    primaryScale: number,
    iconScale: number,
  ) => NerdMetrics;
  nerdIconScale: number;
  selectionState: { active: boolean; dragging: boolean };
  selectionForRow: (row: number, cols: number) => { start: number; end: number } | null;
  pushRect: (
    target: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ) => void;
  pushRectBox: (
    target: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ) => void;
  selectionColor: Color;
  STYLE_BOLD: number;
  STYLE_ITALIC: number;
  STYLE_FAINT: number;
  STYLE_BLINK: number;
  STYLE_INVERSE: number;
  STYLE_INVISIBLE: number;
  STYLE_STRIKE: number;
  STYLE_OVERLINE: number;
  STYLE_UNDERLINE_MASK: number;
  decodeRGBAWithCache: (
    bytes: Uint8Array | null,
    index: number,
    cache: Map<number, Color>,
  ) => Color;
  brighten: (color: Color, amount: number) => Color;
  BOLD_BRIGHTEN: number;
  fade: (color: Color, alpha: number) => Color;
  FAINT_ALPHA: number;
  linkState: { hoverId: number };
  drawUnderlineStyle: (
    target: number[],
    style: number,
    x: number,
    rowY: number,
    cellW: number,
    cellH: number,
    baseY: number,
    underlineOffsetPx: number,
    underlineThicknessPx: number,
    color: Color,
  ) => void;
  drawStrikethrough: (
    target: number[],
    x: number,
    rowY: number,
    cellW: number,
    cellH: number,
    color: Color,
  ) => void;
  drawOverline: (target: number[], x: number, rowY: number, cellW: number, color: Color) => void;
  KITTY_PLACEHOLDER_CP: number;
  isSpaceCp: (cp: number) => boolean;
  shouldMergeTrailingClusterCodepoint: (cp: number) => boolean;
  isBlockElement: (cp: number) => boolean;
  drawBlockElement: (
    cp: number,
    x: number,
    y: number,
    cellW: number,
    cellH: number,
    fg: Color,
    target: number[],
  ) => boolean;
  isBoxDrawing: (cp: number) => boolean;
  drawBoxDrawing: (
    cp: number,
    x: number,
    y: number,
    cellW: number,
    cellH: number,
    fg: Color,
    target: number[],
    underlineThicknessPx: number,
  ) => boolean;
  isBraille: (cp: number) => boolean;
  drawBraille: (
    cp: number,
    x: number,
    y: number,
    cellW: number,
    cellH: number,
    fg: Color,
    target: number[],
  ) => boolean;
  isPowerline: (cp: number) => boolean;
  drawPowerline: (
    cp: number,
    x: number,
    y: number,
    cellW: number,
    cellH: number,
    fg: Color,
    target: number[],
  ) => boolean;
  pickFontIndexForText: (text: string, expectedSpan?: number, stylePreference?: string) => number;
  stylePreferenceFromFlags: (bold: boolean, italic: boolean) => string;
  noteColorGlyphText: (
    entry: FontEntry,
    text: string,
    shaped: { glyphs: Array<{ glyphId: number }> },
  ) => void;
  isRenderSymbolLike: (cp: number) => boolean;
  resolveSymbolConstraint: (cp: number) => NerdConstraint | null;
  isGraphicsElement: (cp: number) => boolean;
  glyphWidthUnits: (entry: FontEntry, glyphId: number) => number;
  fitTextTailToWidth: (
    text: string,
    maxWidth: number,
    measure: (value: string) => number,
  ) => { text: string; widthPx: number; offset: number };
  PREEDIT_BG: Color;
  PREEDIT_UL: Color;
  PREEDIT_ACTIVE_BG: Color;
  PREEDIT_CARET: Color;
  PREEDIT_FG: Color;
  resizeState: { lastAt: number; cols: number; rows: number };
  RESIZE_OVERLAY_HOLD_MS: number;
  RESIZE_OVERLAY_FADE_MS: number;
  ensureAtlasForFont: (
    device: GPUDevice,
    state: WebGPUState,
    entry: FontEntry,
    neededGlyphIds: Set<number>,
    fontSizePx: number,
    fontIndex: number,
    atlasScale: number,
    glyphMeta?: Map<number, GlyphConstraintMeta>,
    constraintContext?: {
      cellW: number;
      cellH: number;
      yPad: number;
      baselineOffset: number;
      baselineAdjust: number;
      fontScale: number;
      nerdMetrics: NerdMetrics;
      fontEntry: FontEntry;
    } | null,
  ) => boolean;
  defaultBg: Color;
  decodePackedRGBA: (packed: number) => Color;
  cursorFallback: Color;
  scrollbarState: { lastTotal: number; lastOffset: number; lastLen: number };
  appendOverlayScrollbar: (target: number[], total: number, offset: number, len: number) => void;
  webgpuUniforms: Float32Array;
  ensureInstanceBuffer: (state: WebGPUState, kind: "rect" | "glyph", minBytes: number) => void;
  GLYPH_INSTANCE_FLOATS: number;
  wasm: ResttyWasm | null;
  collectKittyDrawPlan: (
    placements: KittyPlacement[],
    cellW: number,
    cellH: number,
  ) => KittyDrawPlan;
  resolveKittyWebGLTexture: (
    gl: WebGL2RenderingContext,
    slice: KittyDrawSlice,
  ) => WebGLTexture | null;
  resolveKittyWebGPUBindGroup: (
    state: WebGPUState,
    slice: KittyDrawSlice,
    nearest?: boolean,
  ) => GPUBindGroup | null;
  isAppleSymbolsFont: (entry: FontEntry) => boolean;
  DEFAULT_APPLE_SYMBOLS_CONSTRAINT: NerdConstraint;
  DEFAULT_SYMBOL_CONSTRAINT: NerdConstraint;
  DEFAULT_EMOJI_CONSTRAINT: NerdConstraint;
  constrainGlyphBox: (
    box: { x: number; y: number; width: number; height: number },
    constraint: NerdConstraint,
    metrics: NerdMetrics,
    constraintWidth: number,
  ) => { x: number; y: number; width: number; height: number };
  tightenNerdConstraintBox: (
    box: { x: number; y: number; width: number; height: number },
    constraint: NerdConstraint | null,
  ) => { x: number; y: number; width: number; height: number };
  fontEntryHasItalicStyle: (entry: FontEntry) => boolean;
  fontEntryHasBoldStyle: (entry: FontEntry) => boolean;
  ITALIC_SLANT: number;
  BOLD_OFFSET: number;
  GLYPH_RENDER_MODE_COLOR: number;
  GLYPH_RENDER_MODE_MONO: number;
};

export type RuntimeTickDeps = SharedTickDeps & {
  isShaderStagesDirty: () => boolean;
  rebuildWebGPUShaderStages: (state: WebGPUState) => void;
  setShaderStagesDirty: (value: boolean) => void;
  getCompiledWebGPUShaderStages: () => CompiledWebGPUShaderStage[];
  ensureWebGPUStageTargets: (state: WebGPUState) => WebGPUStageTargets | null;
  fontError: Error | null;
  termDebug: HTMLElement | null;
  reportDebugText: (text: string) => void;
  updateGrid: () => void;
  getRenderState: () => RenderState | null;
  resolveBlendFlags: (
    alphaMode: string,
    backend: "webgpu",
    state: WebGPUState,
  ) => { useLinearBlending: boolean; useLinearCorrection: boolean };
  alphaBlending: string;
  srgbToLinearColor: (color: Color) => Color;
  reportTermSize: (cols: number, rows: number) => void;
  resolveCursorPosition: (cursor: RenderState["cursor"]) => CursorPosition | null;
  reportCursor: (cursor: { col: number; row: number } | null) => void;
  FORCE_CURSOR_BLINK: boolean;
  CURSOR_BLINK_MS: number;
  imeInput: HTMLTextAreaElement | null;
  resolveCursorStyle: (
    cursor: NonNullable<RenderState["cursor"]>,
    opts: { focused: boolean; preedit: boolean; blinkVisible: boolean },
  ) => number | null;
  isFocused: boolean;
  imeState: { preedit: string; selectionStart: number; selectionEnd: number };
  resolveImeAnchor: (
    cursor: CursorPosition | null,
    cols: number,
    rows: number,
  ) => { row: number; col: number } | null;
  dbgEl: HTMLElement | null;
  wasmExports: ResttyWasmExports | null;
  wasmHandle: number;
  gridState: {
    cellW: number;
    cellH: number;
    fontSizePx: number;
    scale: number;
    lineHeight: number;
    baselineOffset: number;
    yPad: number;
  };
  canvas: HTMLCanvasElement;
  updateImePosition: (cursor: { row: number; col: number }, cellW: number, cellH: number) => void;
  lastRenderState: RenderState | null;
};

export type EmitWebGPUQueuedGlyphsParams = {
  deps: SharedTickDeps;
  state: WebGPUState;
  frame: WebGPUFrame;
  queueByFont: Map<number, GlyphQueueItem[]>;
  targetMaps: {
    nearest: Map<number, number[]>;
    linear: Map<number, number[]>;
  };
  cellW: number;
  cellH: number;
  yPad: number;
  baselineOffset: number;
  primaryScale: number;
};

export type CollectWebGPUCellPassParams = {
  deps: SharedTickDeps;
  render: WebGPURenderInput;
  cellW: number;
  cellH: number;
  fontSizePx: number;
  primaryScale: number;
  lineHeight: number;
  baselineOffset: number;
  yPad: number;
  underlineOffsetPx: number;
  underlineThicknessPx: number;
  cursorBlock: boolean;
  cursorCell: { row: number; col: number; wide: boolean } | null;
  blinkVisible: boolean;
  defaultBg: Color;
};

export type AugmentWebGPUFrameParams = {
  deps: SharedTickDeps & { canvas: HTMLCanvasElement; imeState: RuntimeTickDeps["imeState"] };
  state: WebGPUState;
  frame: WebGPUFrame;
  cursor: RenderState["cursor"];
  cursorImeAnchor: { row: number; col: number } | null;
  cursorCell: { row: number; col: number; wide: boolean } | null;
  cols: number;
  cellW: number;
  cellH: number;
  yPad: number;
  baselineOffset: number;
  underlineOffsetPx: number;
  underlineThicknessPx: number;
  lineHeight: number;
  primaryScale: number;
  fontSizePx: number;
};

export type DrawWebGPUFrameParams = {
  deps: SharedTickDeps & {
    wasmHandle: number;
    wasmExports: ResttyWasmExports | null;
    canvas: HTMLCanvasElement;
  };
  state: WebGPUState;
  frame: WebGPUFrame;
  cursor: RenderState["cursor"];
  cursorPos: CursorPosition | null;
  cursorStyle: number | null;
  rows: number;
  cols: number;
  cellW: number;
  cellH: number;
  yPad: number;
  baselineOffset: number;
  underlineOffsetPx: number;
  underlineThicknessPx: number;
  primaryScale: number;
  useLinearBlending: boolean;
  useLinearCorrection: boolean;
  clearColor: Color;
  hasShaderStages: boolean;
  stageTargets: WebGPUStageTargets | null;
  compiledWebGPUStages: CompiledWebGPUShaderStage[];
};

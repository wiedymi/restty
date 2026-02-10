import type { FontEntry } from "../../fonts";
import type { Color, WebGLState } from "../../renderer";
import type { CursorInfo, RenderState } from "../../wasm";
import type {
  CompiledWebGLShaderStage,
  WebGLStageTargets,
} from "../create-app-types";
import type {
  BuildFontAtlasParams,
  BuildFontAtlasResult,
  GlyphConstraintMeta,
} from "../atlas-builder";
import type { AlphaBlendingMode } from "./blend-utils";
import type {
  CursorPosition,
  GlyphQueueItem,
  NerdMetrics,
  SharedTickDeps,
  WebGPURenderInput,
} from "./render-tick-webgpu.types";

type AtlasBuilderDeps = BuildFontAtlasParams["deps"];

export type WebGLTickDeps = SharedTickDeps & {
  isShaderStagesDirty: () => boolean;
  rebuildWebGLShaderStages: (state: WebGLState) => void;
  setShaderStagesDirty: (value: boolean) => void;
  getCompiledWebGLShaderStages: () => CompiledWebGLShaderStage[];
  ensureWebGLStageTargets: (state: WebGLState) => WebGLStageTargets | null;
  fontError: Error | null;
  termDebug: HTMLElement | null;
  reportDebugText: (text: string) => void;
  updateGrid: () => void;
  getRenderState: () => RenderState | null;
  clearKittyOverlay: () => void;
  resolveBlendFlags: (
    alphaMode: AlphaBlendingMode,
    backend: "webgl2",
  ) => { useLinearBlending: boolean; useLinearCorrection: boolean };
  alphaBlending: AlphaBlendingMode;
  reportTermSize: (cols: number, rows: number) => void;
  resolveCursorPosition: (cursor: CursorInfo | null) => CursorPosition | null;
  reportCursor: (cursor: { col: number; row: number } | null) => void;
  FORCE_CURSOR_BLINK: boolean;
  CURSOR_BLINK_MS: number;
  imeInput: HTMLTextAreaElement | null;
  resolveCursorStyle: (
    cursor: CursorInfo,
    opts: { focused: boolean; preedit: boolean; blinkVisible: boolean },
  ) => number | null;
  isFocused: boolean;
  imeState: { preedit: string; selectionStart: number; selectionEnd: number };
  resolveImeAnchor: (
    cursor: CursorPosition | null,
    cols: number,
    rows: number,
  ) => { row: number; col: number } | null;
  gridState: {
    cellW: number;
    cellH: number;
    fontSizePx: number;
    scale: number;
    lineHeight: number;
    baselineOffset: number;
    yPad: number;
  };
  updateImePosition: (
    cursor: { row: number; col: number },
    cellW: number,
    cellH: number,
  ) => void;
  canvas: HTMLCanvasElement;
  buildFontAtlasIfNeeded: (params: BuildFontAtlasParams) => BuildFontAtlasResult;
  resolveGlyphPixelMode: AtlasBuilderDeps["resolveGlyphPixelMode"];
  atlasBitmapToRGBA: AtlasBuilderDeps["atlasBitmapToRGBA"];
  padAtlasRGBA: AtlasBuilderDeps["padAtlasRGBA"];
  buildAtlas: AtlasBuilderDeps["buildAtlas"];
  buildGlyphAtlasWithConstraints: AtlasBuilderDeps["buildGlyphAtlasWithConstraints"];
  buildColorEmojiAtlasWithCanvas: AtlasBuilderDeps["buildColorEmojiAtlasWithCanvas"];
  rasterizeGlyph: AtlasBuilderDeps["rasterizeGlyph"];
  rasterizeGlyphWithTransform: AtlasBuilderDeps["rasterizeGlyphWithTransform"];
  nerdConstraintSignature: AtlasBuilderDeps["nerdConstraintSignature"];
  ATLAS_PADDING: number;
  SYMBOL_ATLAS_PADDING: number;
  SYMBOL_ATLAS_MAX_SIZE: number;
  PixelMode: { RGBA?: number };
  ensureGLInstanceBuffer: (
    state: WebGLState,
    kind: "rect" | "glyph",
    minBytes: number,
  ) => void;
  GLYPH_INSTANCE_FLOATS: number;
  wasmHandle: number;
  lastRenderState: RenderState | null;
};

export type WebGLCursorCell = { row: number; col: number; wide: boolean };

export type WebGLTickContext = {
  deps: WebGLTickDeps;
  state: WebGLState;
  rows: number;
  cols: number;
  codepoints: WebGPURenderInput["codepoints"];
  contentTags: WebGPURenderInput["contentTags"];
  wide: WebGPURenderInput["wide"];
  styleFlags: WebGPURenderInput["styleFlags"];
  linkIds: WebGPURenderInput["linkIds"];
  fgBytes: WebGPURenderInput["fgBytes"];
  bgBytes: WebGPURenderInput["bgBytes"];
  ulBytes: WebGPURenderInput["ulBytes"];
  ulStyle: WebGPURenderInput["ulStyle"];
  graphemeOffset: WebGPURenderInput["graphemeOffset"];
  graphemeLen: WebGPURenderInput["graphemeLen"];
  graphemeBuffer: WebGPURenderInput["graphemeBuffer"];
  cursor: RenderState["cursor"];
  mergedEmojiSkip: Uint8Array;
  readCellCluster: (cellIndex: number) => { cp: number; text: string; span: number } | null;
  useLinearBlending: boolean;
  useLinearCorrection: boolean;
  blinkVisible: boolean;
  cursorPos: CursorPosition | null;
  cursorStyle: number | null;
  cursorCell: WebGLCursorCell | null;
  cursorImeAnchor: { row: number; col: number } | null;
  cellW: number;
  cellH: number;
  fontSizePx: number;
  primaryEntry: FontEntry | undefined;
  primaryScale: number;
  lineHeight: number;
  baselineOffset: number;
  yPad: number;
  underlineOffsetPx: number;
  underlineThicknessPx: number;
  bgData: number[];
  selectionData: number[];
  underlineData: number[];
  cursorData: number[];
  fgRectData: number[];
  overlayData: number[];
  glyphDataByFont: Map<number, number[]>;
  glyphQueueByFont: Map<number, GlyphQueueItem[]>;
  overlayGlyphDataByFont: Map<number, number[]>;
  overlayGlyphQueueByFont: Map<number, GlyphQueueItem[]>;
  neededGlyphIdsByFont: Map<number, Set<number>>;
  neededGlyphMetaByFont: Map<number, Map<number, GlyphConstraintMeta>>;
  fgColorCache: Map<number, Color>;
  bgColorCache: Map<number, Color>;
  ulColorCache: Map<number, Color>;
  scaleByFont: number[];
  bitmapScaleByFont: number[];
  baselineAdjustByFont: number[];
  nerdMetrics: NerdMetrics;
  getGlyphQueue: (fontIndex: number) => GlyphQueueItem[];
  getOverlayGlyphQueue: (fontIndex: number) => GlyphQueueItem[];
  getGlyphSet: (fontIndex: number) => Set<number>;
  noteGlyphMeta: (fontIndex: number, glyphId: number, cp: number, constraintWidth: number) => void;
  getGlyphData: (map: Map<number, number[]>, fontIndex: number) => number[];
  compiledWebGLStages: CompiledWebGLShaderStage[];
  stageTargets: WebGLStageTargets | null;
  hasShaderStages: boolean;
};

import type {
  Font,
  FontAtlas,
  FontEntry,
  FontManagerState,
  FontSizeMode,
  ShapedGlyph,
} from "../../fonts";
import type { WebGLState, WebGPUState } from "../../renderer";
import type { PtyTransport } from "../../pty";
import type { ResttyWasm } from "../../wasm";
import type { ResttyAppCallbacks, ResttyFontHintTarget } from "../types";
import type {
  AtlasOptions,
  GlyphBuffer,
  GlyphRasterizeOptions,
  Matrix2D,
  Matrix3x3,
  RasterizedGlyph,
  UnicodeBuffer,
} from "text-shaper";

export type GridStateRef = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  fontSizePx: number;
  scale: number;
  lineHeight: number;
  baselineOffset: number;
  yPad: number;
};

export type FontConfigRef = {
  sizePx: number;
};

export type ResizeStateRef = {
  lastAt: number;
};

export type ShapeClusterResult = {
  glyphs: ShapedGlyph[];
  advance: number;
};

export type AtlasBuilderOptions = Omit<AtlasOptions, "sizeMode"> & {
  sizeMode?: FontSizeMode;
};

export type BuildColorEmojiAtlasWithCanvasOptions = {
  font: Font;
  fontEntry: FontEntry;
  glyphIds: number[];
  fontSize: number;
  sizeMode: FontSizeMode;
  padding: number;
  maxWidth: number;
  maxHeight: number;
  pixelMode: number;
};

export type BuildColorEmojiAtlasWithCanvas = (
  options: BuildColorEmojiAtlasWithCanvasOptions,
) => { atlas: FontAtlas; constrainedGlyphWidths?: Map<number, number> | null } | null;
export type AtlasBitmapToRGBA = (atlas: FontAtlas) => Uint8Array | null;
export type PadAtlasRGBAFn = (rgba: Uint8Array, atlas: FontAtlas, padding: number) => Uint8Array;
export type BuildAtlasFn = (
  font: Font,
  glyphIds: number[],
  options: AtlasBuilderOptions,
) => FontAtlas;
export type ResolveGlyphPixelMode = (entry: FontEntry) => number;
export type ShapeFn = (font: Font, buffer: UnicodeBuffer) => GlyphBuffer;
export type GlyphBufferToShapedGlyphsFn = (glyphBuffer: GlyphBuffer) => ShapedGlyph[];
export type UnicodeBufferCtor = new () => UnicodeBuffer;

export type RasterizeGlyphFn = (
  font: Font,
  glyphId: number,
  fontSize: number,
  options?: GlyphRasterizeOptions,
) => RasterizedGlyph | null;

export type RasterizeGlyphTransformOptions = GlyphRasterizeOptions & {
  offsetX26?: number;
  offsetY26?: number;
};

export type GlyphTransformMatrix = Matrix2D | Matrix3x3;

export type RasterizeGlyphWithTransformFn = (
  font: Font,
  glyphId: number,
  fontSize: number,
  matrix: GlyphTransformMatrix,
  options?: RasterizeGlyphTransformOptions,
) => RasterizedGlyph | null;

export type CreateRuntimeFontRuntimeHelpersOptions = {
  fontState: FontManagerState;
  fontConfig: FontConfigRef;
  gridState: GridStateRef;
  callbacks?: ResttyAppCallbacks;
  gridEl: HTMLElement | null;
  cellEl: HTMLElement | null;
  getCanvas: () => HTMLCanvasElement;
  getCurrentDpr: () => number;
  getActiveState: () => WebGPUState | WebGLState | null;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  ptyTransport: PtyTransport;
  setNeedsRender: () => void;
  resizeState: ResizeStateRef;
  resizeActiveMs: number;
  resizeCommitDebounceMs: number;
  getFontHinting: () => boolean;
  getFontHintTarget: () => ResttyFontHintTarget;
  fontScaleOverrides: Array<{ match: RegExp; scale: number }>;
  resolveGlyphPixelMode: ResolveGlyphPixelMode;
  atlasBitmapToRGBA: AtlasBitmapToRGBA;
  padAtlasRGBA: PadAtlasRGBAFn;
  buildAtlas: BuildAtlasFn;
  buildColorEmojiAtlasWithCanvas: BuildColorEmojiAtlasWithCanvas;
  rasterizeGlyph: RasterizeGlyphFn;
  rasterizeGlyphWithTransform: RasterizeGlyphWithTransformFn;
  pixelModeRgbaValue: number;
  atlasPadding: number;
  symbolAtlasPadding: number;
  symbolAtlasMaxSize: number;
  glyphShapeCacheLimit: number;
  fontPickCacheLimit: number;
  UnicodeBuffer: UnicodeBufferCtor;
  shape: ShapeFn;
  glyphBufferToShapedGlyphs: GlyphBufferToShapedGlyphsFn;
};

export type CellMetrics = {
  cellW: number;
  cellH: number;
  fontSizePx: number;
  scale: number;
  lineHeight: number;
  baselineOffset: number;
  yPad: number;
};

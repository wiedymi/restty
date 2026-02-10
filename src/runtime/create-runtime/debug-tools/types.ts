import type {
  fontAdvanceUnits as fontAdvanceUnitsFn,
  fontMaxCellSpan as fontMaxCellSpanFn,
  fontScaleOverride as fontScaleOverrideFn,
  FontEntry,
  FontManagerState,
  NerdConstraint,
  isColorEmojiFont as isColorEmojiFontFn,
  isNerdSymbolCodepoint as isNerdSymbolCodepointFn,
  isSymbolFont as isSymbolFontFn,
} from "../../../fonts";
import type { clamp as clampFn, fontHeightUnits as fontHeightUnitsFn } from "../../../grid";
import type { WebGLState, WebGPUState } from "../../../renderer";
import type { GlyphConstraintMeta, AtlasConstraintContext } from "../../atlas-builder";
import type { NerdMetrics } from "../render-tick-webgpu.types";

export type GridState = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  fontSizePx: number;
  yPad: number;
};

export type FontConfig = {
  sizePx: number;
};

export type ShapeClusterResult = {
  glyphs: Array<{
    glyphId: number;
    xAdvance: number;
    xOffset: number;
    yOffset: number;
  }>;
  advance: number;
};

export type BuildNerdMetricsFn = (
  cellW: number,
  cellH: number,
  lineHeight: number,
  font: FontEntry["font"] | null | undefined,
  primaryScale: number,
  nerdIconScale: number,
) => NerdMetrics;

export type EnsureAtlasForFontFn = (
  device: GPUDevice,
  state: WebGPUState,
  entry: FontEntry,
  neededGlyphIds: Set<number>,
  fontSizePx: number,
  fontIndex: number,
  atlasScale: number,
  glyphMeta?: Map<number, GlyphConstraintMeta>,
  constraintContext?: AtlasConstraintContext | null,
) => boolean;

export type CreateRuntimeDebugToolsOptions = {
  debugExpose: boolean;
  getWindow: () => (Window & typeof globalThis) | undefined;
  getActiveState: () => WebGPUState | WebGLState | null;
  getCanvas: () => HTMLCanvasElement;
  atlasCanvas: HTMLCanvasElement | null;
  atlasInfoEl: HTMLElement | null;
  fontState: FontManagerState;
  gridState: GridState;
  fontConfig: FontConfig;
  pickFontIndexForText: (text: string, expectedSpan?: number) => number;
  ensureAtlasForFont: EnsureAtlasForFontFn;
  formatCodepoint: (cp: number) => string;
  isSymbolFont: typeof isSymbolFontFn;
  isNerdSymbolCodepoint: typeof isNerdSymbolCodepointFn;
  isSymbolCp: (cp: number) => boolean;
  fontHasGlyph: (font: FontEntry["font"], ch: string) => boolean;
  shapeClusterWithFont: (entry: FontEntry, text: string) => ShapeClusterResult;
  getNerdConstraint: (cp: number) => NerdConstraint | null;
  fontHeightUnits: typeof fontHeightUnitsFn;
  fontScaleOverride: typeof fontScaleOverrideFn;
  fontScaleOverrides: Array<{ match: RegExp; scale: number }>;
  fontAdvanceUnits: typeof fontAdvanceUnitsFn;
  fontMaxCellSpan: typeof fontMaxCellSpanFn;
  clamp: typeof clampFn;
  buildNerdMetrics: BuildNerdMetricsFn;
  nerdIconScale: number;
  isColorEmojiFont: typeof isColorEmojiFontFn;
  atlasPadding: number;
  symbolAtlasPadding: number;
  pixelModeGray: number;
  pixelModeRgba: number;
};

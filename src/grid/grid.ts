import type { CellMetrics, GridConfig, GridState } from "./types";

/**
 * Font metrics interface used to measure glyph dimensions and compute cell sizes.
 */
export type FontMetricsProvider = {
  /** Return the scale factor for a given pixel size and sizing mode. */
  scaleForSize(sizePx: number, sizeMode: string): number;
  /** Look up the glyph ID for a character, or null/undefined if missing. */
  glyphIdForChar(char: string): number | undefined | null;
  /** Return the advance width of a glyph in font units. */
  advanceWidth(glyphId: number): number;
  /** Font ascender in font units. */
  readonly ascender: number;
  /** Font descender in font units (typically negative). */
  readonly descender?: number;
  /** Explicit font height in font units, if available. */
  readonly height?: number;
  /** Units per em of the font. */
  readonly upem: number;
};

/** Result of shaping a text cluster, containing its advance width. */
export type ShapeResult = {
  advance: number;
};

/** Resolve the font height in font units, falling back to ascender-descender or upem. */
export function fontHeightUnits(font: FontMetricsProvider): number {
  if (!font) return 0;
  const height = font.height;
  if (height !== undefined && Number.isFinite(height) && height > 0) return height;
  const asc = font.ascender ?? 0;
  const desc = font.descender ?? 0;
  const fallback = asc - desc;
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return font.upem || 1000;
}

/**
 * Compute cell width, height, and baseline from font metrics, grid config,
 * and device pixel ratio. Returns null if the font is unavailable.
 */
export function computeCellMetrics(
  font: FontMetricsProvider,
  config: GridConfig,
  dpr: number,
  shapeCluster: (text: string) => ShapeResult,
): CellMetrics | null {
  if (!font) return null;

  const fontSizePx = Math.max(1, Math.round(config.fontSize * dpr));
  const scale = font.scaleForSize(fontSizePx, config.sizeMode);
  const glyphId = font.glyphIdForChar("M");
  const advanceUnits =
    glyphId !== undefined && glyphId !== null
      ? font.advanceWidth(glyphId)
      : shapeCluster("M").advance;
  const cellW = Math.max(1, Math.round(advanceUnits * scale));
  const lineHeight = fontHeightUnits(font) * scale;
  const cellH = Math.max(1, Math.round(lineHeight));
  const baselineOffset = font.ascender * scale;
  const yPad = Math.max(0, (cellH - lineHeight) * 0.5);

  return { cellW, cellH, fontSizePx, scale, lineHeight, baselineOffset, yPad };
}

/** Create a zeroed-out grid state with default values. */
export function createGridState(): GridState {
  return {
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
}

/**
 * Recompute grid dimensions from cell metrics and canvas size.
 * Mutates state in place and returns whether cols/rows/metrics changed.
 */
export function updateGridState(
  state: GridState,
  metrics: CellMetrics,
  canvasWidth: number,
  canvasHeight: number,
): { changed: boolean; cols: number; rows: number } {
  const cols = Math.max(1, Math.floor(canvasWidth / metrics.cellW));
  const rows = Math.max(1, Math.floor(canvasHeight / metrics.cellH));

  if (!Number.isFinite(cols) || !Number.isFinite(rows)) {
    return { changed: false, cols: state.cols, rows: state.rows };
  }

  const changed =
    cols !== state.cols ||
    rows !== state.rows ||
    metrics.fontSizePx !== state.fontSizePx ||
    metrics.cellW !== state.cellW ||
    metrics.cellH !== state.cellH;

  Object.assign(state, metrics, { cols, rows });

  return { changed, cols, rows };
}

/** Clamp a number to the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Current grid dimensions and cell metrics.
 */
export type GridState = {
  /** Number of columns in the terminal grid. */
  cols: number;
  /** Number of rows in the terminal grid. */
  rows: number;
  /** Cell width in CSS pixels. */
  cellW: number;
  /** Cell height in CSS pixels. */
  cellH: number;
  /** Resolved font size in CSS pixels. */
  fontSizePx: number;
  /** Device pixel ratio (DPR) scale factor. */
  scale: number;
  /** Line height multiplier applied to font metrics. */
  lineHeight: number;
  /** Vertical offset from cell top to text baseline in CSS pixels. */
  baselineOffset: number;
  /** Vertical padding added to the top of the grid in CSS pixels. */
  yPad: number;
};

/**
 * Computed cell measurement values derived from font metrics and DPR.
 */
export type CellMetrics = {
  /** Cell width in CSS pixels. */
  cellW: number;
  /** Cell height in CSS pixels. */
  cellH: number;
  /** Resolved font size in CSS pixels. */
  fontSizePx: number;
  /** Device pixel ratio (DPR) scale factor. */
  scale: number;
  /** Line height multiplier applied to font metrics. */
  lineHeight: number;
  /** Vertical offset from cell top to text baseline in CSS pixels. */
  baselineOffset: number;
  /** Vertical padding added to the top of the grid in CSS pixels. */
  yPad: number;
};

/**
 * Grid configuration for font sizing.
 */
export type GridConfig = {
  /** Base font size value interpreted according to sizeMode. */
  fontSize: number;
  /**
   * How fontSize is interpreted.
   * - height: CSS px height of glyphs
   * - width: CSS px width of a single cell
   * - upem: units-per-em (raw font units)
   */
  sizeMode: "height" | "width" | "upem";
};

/** 0-based cell coordinates within the terminal grid. */
export type CellPosition = {
  row: number;
  col: number;
};

/**
 * Mutable state of the current text selection.
 */
export type SelectionState = {
  /** Whether a selection currently exists. */
  active: boolean;
  /** Whether the user is actively dragging to extend the selection. */
  dragging: boolean;
  /** Cell where the selection was initiated (start point). */
  anchor: CellPosition | null;
  /** Cell where the selection currently ends (moving point). */
  focus: CellPosition | null;
};

/**
 * Column span of a selection within a single row.
 */
export type SelectionRange = {
  /** Inclusive start column index. */
  start: number;
  /** Exclusive end column index. */
  end: number;
};

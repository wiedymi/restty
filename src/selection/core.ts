import { clamp } from "../grid/grid";
import type { CellPosition, SelectionRange, SelectionState } from "./types";

/** Create an empty, inactive selection state. */
export function createSelectionState(): SelectionState {
  return {
    active: false,
    dragging: false,
    anchor: null,
    focus: null,
  };
}

/** Reset the selection state, deactivating any active selection. */
export function clearSelection(state: SelectionState): void {
  state.active = false;
  state.dragging = false;
  state.anchor = null;
  state.focus = null;
}

/** Begin a new selection at the given cell, entering drag mode. */
export function startSelection(state: SelectionState, cell: CellPosition): void {
  state.active = true;
  state.dragging = true;
  state.anchor = cell;
  state.focus = cell;
}

/** Extend the active selection to a new focus cell while dragging. */
export function updateSelection(state: SelectionState, cell: CellPosition): void {
  if (!state.dragging) return;
  state.focus = cell;
}

/**
 * Finish a drag selection at the given cell. Returns true if a non-empty
 * selection was created, or false if anchor and focus are the same cell.
 */
export function endSelection(state: SelectionState, cell: CellPosition): boolean {
  if (!state.dragging) return false;
  state.dragging = false;
  state.focus = cell;

  if (
    state.anchor &&
    state.focus &&
    state.anchor.row === state.focus.row &&
    state.anchor.col === state.focus.col
  ) {
    clearSelection(state);
    return false;
  }
  return true;
}

/**
 * Return the selected column range for a given row, or null if the row
 * is outside the selection.
 */
export function selectionForRow(
  state: SelectionState,
  row: number,
  cols: number,
): SelectionRange | null {
  if (!state.active || !state.anchor || !state.focus) return null;

  const a = state.anchor;
  const f = state.focus;
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

/**
 * Clamp a cell position to the grid bounds and snap wide-character
 * continuation cells back to the leading cell.
 */
export function normalizeSelectionCell(
  cell: CellPosition | null,
  rows: number,
  cols: number,
  wideFlags?: Uint8Array | null,
): CellPosition | null {
  if (!cell) return cell;
  if (!rows || !cols) return cell;

  const row = clamp(cell.row, 0, rows - 1);
  const col = clamp(cell.col, 0, cols - 1);

  if (!wideFlags) return { row, col };

  const idx = row * cols + col;
  const flag = wideFlags[idx] ?? 0;

  if (flag === 2) {
    const left = col > 0 ? col - 1 : col;
    return { row, col: left };
  }

  if (flag === 3 && row > 0) {
    const prevRow = row - 1;
    for (let c = cols - 1; c >= 0; c -= 1) {
      const f = wideFlags[prevRow * cols + c] ?? 0;
      if (f !== 2 && f !== 3) return { row: prevRow, col: c };
    }
  }

  return { row, col };
}

/** Convert client pixel coordinates to a grid cell position. */
export function positionToCell(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  dpr: number,
  cellW: number,
  cellH: number,
  cols: number,
  rows: number,
): CellPosition {
  const safeCols = cols || 1;
  const safeRows = rows || 1;
  const safeCellW = cellW || 1;
  const safeCellH = cellH || 1;
  const scaleX = canvasRect.width > 0 ? (safeCols * safeCellW) / canvasRect.width : dpr;
  const scaleY = canvasRect.height > 0 ? (safeRows * safeCellH) / canvasRect.height : dpr;
  const x = (clientX - canvasRect.left) * scaleX;
  const y = (clientY - canvasRect.top) * scaleY;
  const col = clamp(Math.floor(x / safeCellW), 0, safeCols - 1);
  const row = clamp(Math.floor(y / safeCellH), 0, safeRows - 1);
  return { row, col };
}

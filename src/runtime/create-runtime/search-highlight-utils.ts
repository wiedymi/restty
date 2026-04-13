import type { Color } from "../../renderer";
import type { ResttySearchViewportMatch } from "../core/models";

export type SearchCellHighlightKind = 0 | 1 | 2;

type AppendSearchHighlightsOptions = {
  target: number[];
  matches: ResttySearchViewportMatch[];
  rows: number;
  cols: number;
  cellW: number;
  cellH: number;
  inactiveColor: Color;
  activeColor: Color;
  pushRect: (
    target: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ) => void;
};

export function appendSearchHighlightsForRow(
  target: number[],
  matches: readonly ResttySearchViewportMatch[],
  startIndex: number,
  row: number,
  rowY: number,
  cols: number,
  cellW: number,
  cellH: number,
  inactiveColor: Color,
  activeColor: Color,
  pushRect: (
    target: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    color: Color,
  ) => void,
): number {
  let nextIndex = startIndex;

  while (nextIndex < matches.length) {
    const match = matches[nextIndex]!;
    if (match.row < row) {
      nextIndex += 1;
      continue;
    }
    if (match.row > row) break;
    const start = Math.max(0, Math.min(cols, match.startCol));
    const end = Math.max(start, Math.min(cols, match.endCol));
    if (end > start) {
      pushRect(
        target,
        start * cellW,
        rowY,
        (end - start) * cellW,
        cellH,
        match.selected ? activeColor : inactiveColor,
      );
    }
    nextIndex += 1;
  }

  return nextIndex;
}

export function appendSearchHighlights(options: AppendSearchHighlightsOptions): void {
  const { target, matches, rows, cols, cellW, cellH, inactiveColor, activeColor, pushRect } =
    options;

  if (!matches.length || rows <= 0 || cols <= 0 || cellW <= 0 || cellH <= 0) return;

  let nextIndex = 0;
  for (let row = 0; row < rows && nextIndex < matches.length; row += 1) {
    nextIndex = appendSearchHighlightsForRow(
      target,
      matches,
      nextIndex,
      row,
      row * cellH,
      cols,
      cellW,
      cellH,
      inactiveColor,
      activeColor,
      pushRect,
    );
  }
}

export function searchHighlightForColumn(
  matches: readonly ResttySearchViewportMatch[],
  startIndex: number,
  endIndex: number,
  col: number,
  cols: number,
): { nextIndex: number; kind: SearchCellHighlightKind } {
  let nextIndex = startIndex;

  while (nextIndex < endIndex) {
    const match = matches[nextIndex]!;
    const start = Math.max(0, Math.min(cols, match.startCol));
    const end = Math.max(start, Math.min(cols, match.endCol));
    if (end <= col) {
      nextIndex += 1;
      continue;
    }
    if (start > col) break;
    return {
      nextIndex,
      kind: match.selected ? 2 : 1,
    };
  }

  return {
    nextIndex,
    kind: 0,
  };
}

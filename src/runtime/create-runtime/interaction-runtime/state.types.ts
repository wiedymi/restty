import type { createSelectionState } from "../../../selection";

export type RuntimeCell = {
  row: number;
  col: number;
};

export type RuntimeGridState = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
};

export type RuntimeImeState = {
  composing: boolean;
  preedit: string;
  selectionStart: number;
  selectionEnd: number;
};

export type RuntimeTouchSelectionState = {
  pendingPointerId: number | null;
  activePointerId: number | null;
  panPointerId: number | null;
  pendingCell: RuntimeCell | null;
  pendingStartedAt: number;
  pendingStartX: number;
  pendingStartY: number;
  panLastY: number;
  pendingTimer: number;
};

export type RuntimeDesktopSelectionState = {
  pendingPointerId: number | null;
  pendingCell: RuntimeCell | null;
  startedWithActiveSelection: boolean;
  lastPrimaryClickAt: number;
  lastPrimaryClickCell: RuntimeCell | null;
  lastPrimaryClickCount: number;
};

export type RuntimeLinkState = {
  hoverId: number;
  hoverUri: string;
};

export type RuntimeScrollbarState = {
  lastInputAt: number;
  lastTotal: number;
  lastOffset: number;
  lastLen: number;
};

export type RuntimeSelectionState = ReturnType<typeof createSelectionState>;

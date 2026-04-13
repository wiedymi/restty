import type { createSelectionState } from "../../../selection";
import type { ResttyWasm, ResttyWasmExports } from "../../../wasm";

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

export type CreateScrollbarRuntimeOptions = {
  scrollbarState: RuntimeScrollbarState;
  selectionState: RuntimeSelectionState;
  linkState: RuntimeLinkState;
  getCanvas: () => HTMLCanvasElement;
  getGridState: () => RuntimeGridState;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  getWasmExports: () => ResttyWasmExports | null;
  updateLinkHover: (cell: null) => void;
  markNeedsRender: () => void;
  markSearchDirty?: () => void;
};

export type ScrollbarRuntime = {
  destroy: () => void;
  noteScrollActivity: () => void;
  scrollViewportByLines: (lines: number) => void;
  scrollViewportByWheel: (event: WheelEvent) => void;
  syncScrollbar: (total: number, offset: number, len: number) => void;
};

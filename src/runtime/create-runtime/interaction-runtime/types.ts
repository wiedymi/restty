import type { InputHandler } from "../../../input";
import type { createSelectionState } from "../../../selection";
import type { RenderState, ResttyWasm, ResttyWasmExports } from "../../../wasm";

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

export type BindCanvasEventsOptions = {
  inputHandler: InputHandler;
  sendKeyInput: (text: string) => void;
  sendPasteText: (text: string) => void;
  sendPastePayloadFromDataTransfer: (dataTransfer: DataTransfer | null | undefined) => boolean;
  getLastKeydownSeq: () => string;
  getLastKeydownSeqAt: () => number;
  keydownBeforeinputDedupeMs: number;
  openLink: (url: string) => void;
};

export type CreateRuntimeInteractionOptions = {
  attachCanvasEvents: boolean;
  touchSelectionMode: "off" | "drag" | "long-press";
  touchSelectionLongPressMs: number;
  touchSelectionMoveThresholdPx: number;
  imeInput: HTMLTextAreaElement | null;
  cleanupCanvasFns: Array<() => void>;
  getCanvas: () => HTMLCanvasElement;
  getCurrentDpr: () => number;
  getGridState: () => RuntimeGridState;
  getLastRenderState: () => RenderState | null;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  getWasmExports: () => ResttyWasmExports | null;
  updateLinkHover: (cell: RuntimeCell | null) => void;
  markNeedsRender: () => void;
  markSearchDirty?: () => void;
};

export type RuntimeInteraction = {
  selectionState: RuntimeSelectionState;
  linkState: RuntimeLinkState;
  scrollbarState: RuntimeScrollbarState;
  imeState: RuntimeImeState;
  updateCanvasCursor: () => void;
  updateLinkHover: (cell: RuntimeCell | null) => void;
  positionToCell: (event: { clientX: number; clientY: number }) => RuntimeCell;
  positionToPixel: (event: { clientX: number; clientY: number }) => { x: number; y: number };
  selectWordAtClientPoint: (clientX: number, clientY: number) => boolean;
  clearSelection: () => void;
  updateImePosition: (
    cursor: { row: number; col: number } | null | undefined,
    cellW: number,
    cellH: number,
  ) => void;
  syncScrollbar: (total: number, offset: number, len: number) => void;
  bindCanvasEvents: (bindOptions: BindCanvasEventsOptions) => void;
};

import type { InputHandler } from "../../../input";
import type { RenderState, ResttyWasm, ResttyWasmExports } from "../../../wasm";
import type {
  RuntimeCell,
  RuntimeGridState,
  RuntimeImeState,
  RuntimeLinkState,
  RuntimeScrollbarState,
  RuntimeSelectionState,
} from "./state.types";

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

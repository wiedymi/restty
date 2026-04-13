import type { ResttyWasm, ResttyWasmExports } from "../../../wasm";
import type {
  RuntimeGridState,
  RuntimeLinkState,
  RuntimeScrollbarState,
  RuntimeSelectionState,
} from "./state.types";

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

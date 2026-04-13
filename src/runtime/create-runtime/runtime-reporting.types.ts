import type { RenderState, ResttyWasm, ResttyWasmExports } from "../../wasm";
import type { ResttyRuntimeEvent } from "../core/runtime-events";
import type { RuntimeSelectionState } from "./interaction-runtime/state.types";

export type RuntimeReportingOptions = {
  selectionState: RuntimeSelectionState;
  getLastRenderState: () => RenderState | null;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  getWasmExports: () => ResttyWasmExports | null;
  emitRuntimeEvent?: (event: Extract<ResttyRuntimeEvent, { type: "term-size" }>) => void;
  setCursorForCpr: (pos: { row: number; col: number }) => void;
};

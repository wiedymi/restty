import type { RenderState, ResttyWasm, ResttyWasmExports } from "../../wasm";
import type { ResttyAppCallbacks } from "../core/resources";
import type { RuntimeSelectionState } from "./interaction-runtime/types";

export type RuntimeReportingOptions = {
  selectionState: RuntimeSelectionState;
  getLastRenderState: () => RenderState | null;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  getWasmExports: () => ResttyWasmExports | null;
  callbacks?: ResttyAppCallbacks;
  termSizeEl: HTMLElement | null;
  cursorPosEl: HTMLElement | null;
  setCursorForCpr: (pos: { row: number; col: number }) => void;
};

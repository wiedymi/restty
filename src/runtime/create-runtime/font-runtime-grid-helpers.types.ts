import type { FontEntry, FontManagerState } from "../../fonts";
import type { WebGLState, WebGPUState } from "../../renderer";
import type { PtyTransport } from "../../pty";
import type { ResttyWasm } from "../../wasm";
import type { FontConfigRef, GridStateRef } from "./font-runtime-helpers.types";

export type CreateFontRuntimeGridHelpersOptions = {
  fontState: FontManagerState;
  fontConfig: FontConfigRef;
  gridState: GridStateRef;
  getCanvas: () => HTMLCanvasElement;
  getCurrentDpr: () => number;
  getActiveState: () => WebGPUState | WebGLState | null;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  ptyTransport: PtyTransport;
  setNeedsRender: () => void;
  markSearchDirty?: () => void;
  shapeClusterWithFont: (entry: FontEntry, text: string) => { advance: number };
};

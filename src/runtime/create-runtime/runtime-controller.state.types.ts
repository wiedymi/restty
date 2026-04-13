import type { WebGPUState, WebGLState } from "../../renderer";
import type { ResttyWasm, ResttyWasmExports } from "../../wasm";

export type RuntimeControllerSharedState = {
  wasm: ResttyWasm | null;
  wasmExports: ResttyWasmExports | null;
  wasmHandle: number;
  wasmReady: boolean;
  activeState: WebGPUState | WebGLState | null;
  needsRender: boolean;
  lastRenderTime: number;
  currentContextType: "webgpu" | "webgl2" | null;
  isFocused: boolean;
  lastKeydownSeq: string;
  lastKeydownSeqAt: number;
};

export type RuntimeBackend = "none" | "webgpu" | "webgl2";
export type PreferredRenderer = "auto" | "webgpu" | "webgl2";

export type RuntimeControllerInternalState = {
  paused: boolean;
  backend: RuntimeBackend;
  preferredRenderer: PreferredRenderer;
  rafId: number;
  nextBlinkTime: number;
};

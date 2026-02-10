import type { WebGLState, WebGPUState } from "../../renderer";
import { tickWebGL as tickWebGLImpl } from "./render-tick-webgl";
import { tickWebGPU as tickWebGPUImpl } from "./render-tick-webgpu";
import type { WebGLTickDeps } from "./render-tick-webgl.types";
import type { RuntimeTickDeps } from "./render-tick-webgpu.types";

type RuntimeRenderTickDeps = RuntimeTickDeps & WebGLTickDeps;

export function createRuntimeRenderTicks(deps: RuntimeRenderTickDeps) {
  function tickWebGPU(state: WebGPUState) {
    return tickWebGPUImpl(deps, state);
  }

  function tickWebGL(state: WebGLState) {
    return tickWebGLImpl(deps, state);
  }

  return { tickWebGPU, tickWebGL };
}

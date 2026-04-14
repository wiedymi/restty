import type { WebGPUState, WebGLState } from "../../renderer";
import type {
  RuntimeControllerInternalState,
  RuntimeControllerSharedState,
} from "./runtime-controller.state.types";

type CreateRuntimeControllerRenderLoopOptions = {
  internalState: RuntimeControllerInternalState;
  readState: () => RuntimeControllerSharedState;
  writeState: (patch: Partial<RuntimeControllerSharedState>) => void;
  resizeState: { lastAt: number };
  CURSOR_BLINK_MS: number;
  RESIZE_ACTIVE_MS: number;
  TARGET_RENDER_FPS: number;
  BACKGROUND_RENDER_FPS: number;
  tickWebGPU: (state: WebGPUState) => void;
  tickWebGL: (state: WebGLState) => void;
};

export function createRuntimeControllerRenderLoop(
  options: CreateRuntimeControllerRenderLoopOptions,
) {
  function canRenderFrame(shared: RuntimeControllerSharedState): boolean {
    return Boolean(shared.wasmReady && shared.wasm && shared.wasmHandle);
  }

  function loop(state: WebGPUState | WebGLState) {
    if (!options.internalState.paused) {
      const now = performance.now();
      if (now >= options.internalState.nextBlinkTime) {
        options.internalState.nextBlinkTime = now + options.CURSOR_BLINK_MS;
        options.writeState({ needsRender: true });
      }
      const resizeActive = now - options.resizeState.lastAt <= options.RESIZE_ACTIVE_MS;
      if (resizeActive) {
        options.writeState({ needsRender: true });
      }
      const hidden =
        typeof document !== "undefined" &&
        typeof document.visibilityState === "string" &&
        document.visibilityState !== "visible";
      const targetRenderFps = hidden ? options.BACKGROUND_RENDER_FPS : options.TARGET_RENDER_FPS;
      const shared = options.readState();
      const renderBudget = resizeActive
        ? true
        : now - shared.lastRenderTime >= 1000 / targetRenderFps;
      if (shared.needsRender && renderBudget) {
        // Avoid presenting a cleared frame before the terminal core has a live handle.
        // Leaving needsRender=true retries immediately once startup finishes.
        if (canRenderFrame(shared)) {
          if (options.internalState.backend === "webgpu" && "device" in state) {
            options.tickWebGPU(state);
          }
          if (options.internalState.backend === "webgl2" && "gl" in state) {
            options.tickWebGL(state);
          }
          options.writeState({ lastRenderTime: now, needsRender: false });
        }
      }
    }
    options.internalState.rafId = requestAnimationFrame(() => loop(state));
  }

  return {
    loop,
  };
}

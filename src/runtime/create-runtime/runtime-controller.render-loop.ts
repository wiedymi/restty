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
  BACKGROUND_RENDER_FPS: number;
  isSynchronizedOutput: () => boolean;
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
      const shared = options.readState();
      // Foreground frames present on every rAF tick when dirty; rAF is
      // already vsync-aligned, so an elapsed-time budget only drops frames.
      // Hidden surfaces keep a low-rate budget.
      const renderBudget = hidden
        ? now - shared.lastRenderTime >= 1000 / options.BACKGROUND_RENDER_FPS
        : true;
      const imageChanged =
        canRenderFrame(shared) && shared.wasm!.tickKittyAnimations(shared.wasmHandle, now);
      if (imageChanged) options.writeState({ needsRender: true });
      if ((shared.needsRender || imageChanged) && renderBudget) {
        // Avoid presenting a cleared frame before the terminal core has a live handle.
        // Leaving needsRender=true retries immediately once startup finishes.
        // While the app holds synchronized output (mode 2026) presentation
        // pauses on the last stable frame; needsRender stays pending so the
        // frame right after the end sequence presents the complete update.
        if (canRenderFrame(shared) && !options.isSynchronizedOutput()) {
          shared.wasm!.renderUpdate(shared.wasmHandle);
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

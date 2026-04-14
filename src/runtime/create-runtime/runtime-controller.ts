import { createRuntimeControllerClipboard } from "./runtime-controller.clipboard";
import { resolveMaxScrollbackBytes } from "./max-scrollback";
import { createRuntimeControllerInput } from "./runtime-controller.input";
import { attachRuntimeControllerKeyboardEvents } from "./runtime-controller.keyboard";
import { createRuntimeControllerLifecycle } from "./runtime-controller.lifecycle";
import { createRuntimePublicApi } from "./runtime-controller.public-api";
import { createRuntimeControllerRenderLoop } from "./runtime-controller.render-loop";
import type { RuntimeController, RuntimeControllerOptions } from "./runtime-controller.api.types";
import type {
  RuntimeControllerSharedState,
  RuntimeControllerInternalState,
} from "./runtime-controller.state.types";

export type { RuntimeControllerSharedState } from "./runtime-controller.state.types";

export function createRuntimeController(options: RuntimeControllerOptions): RuntimeController {
  const { runtime, state, platform, hooks, render, lifecycle: lifecycleDeps } = options;

  const internalState: RuntimeControllerInternalState = {
    paused: false,
    backend: "none",
    preferredRenderer: render.initialPreferredRenderer,
    rafId: 0,
    nextBlinkTime: performance.now() + render.CURSOR_BLINK_MS,
  };
  const maxScrollbackBytes = resolveMaxScrollbackBytes(lifecycleDeps);
  const { loop } = createRuntimeControllerRenderLoop({
    internalState,
    readState: state.readState,
    writeState: state.writeState,
    resizeState: state.resizeState,
    CURSOR_BLINK_MS: render.CURSOR_BLINK_MS,
    RESIZE_ACTIVE_MS: render.RESIZE_ACTIVE_MS,
    TARGET_RENDER_FPS: render.TARGET_RENDER_FPS,
    BACKGROUND_RENDER_FPS: render.BACKGROUND_RENDER_FPS,
    tickWebGPU: render.tickWebGPU,
    tickWebGL: render.tickWebGL,
  });
  const { sendInput, clearScreen } = createRuntimeControllerInput({
    ptyTransport: runtime.ptyTransport,
    inputHandler: runtime.inputHandler,
    ptyInputRuntime: runtime.ptyInputRuntime,
    interaction: runtime.interaction,
    readState: state.readState,
    writeState: state.writeState,
    getCanvas: state.getCanvas,
    markSearchDirty: hooks.markSearchDirty,
    runBeforeInputHook: hooks.runBeforeInputHook,
    runBeforeRenderOutputHook: hooks.runBeforeRenderOutputHook,
  });
  const { copySelectionToClipboard, pasteFromClipboard } = createRuntimeControllerClipboard({
    getSelectionText: hooks.getSelectionText,
    ptyInputRuntime: runtime.ptyInputRuntime,
  });

  if (platform.attachWindowEvents) {
    attachRuntimeControllerKeyboardEvents({
      cleanupFns: lifecycleDeps.cleanupFns,
      imeInput: platform.imeInput,
      isMacPlatform: platform.isMacPlatform,
      inputHandler: runtime.inputHandler,
      ptyInputRuntime: runtime.ptyInputRuntime,
      interaction: runtime.interaction,
      readState: state.readState,
      writeState: state.writeState,
      getCanvas: state.getCanvas,
      copySelectionToClipboard,
      KITTY_FLAG_REPORT_EVENTS: platform.KITTY_FLAG_REPORT_EVENTS,
    });
  }

  const lifecycle = createRuntimeControllerLifecycle({
    runtimeEvents: options.runtimeEvents,
    session: runtime.session,
    ptyTransport: runtime.ptyTransport,
    ptyInputRuntime: runtime.ptyInputRuntime,
    lifecycleThemeSizeRuntime: runtime.lifecycleThemeSizeRuntime,
    cleanupFns: lifecycleDeps.cleanupFns,
    cleanupCanvasFns: lifecycleDeps.cleanupCanvasFns,
    readState: state.readState,
    writeState: state.writeState,
    gridState: state.gridState,
    getCanvas: state.getCanvas,
    applyTheme: lifecycleDeps.applyTheme,
    ensureFont: lifecycleDeps.ensureFont,
    updateSize: lifecycleDeps.updateSize,
    updateGrid: lifecycleDeps.updateGrid,
    replaceCanvas: lifecycleDeps.replaceCanvas,
    rebuildWebGPUShaderStages: lifecycleDeps.rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages: lifecycleDeps.rebuildWebGLShaderStages,
    setShaderStagesDirty: lifecycleDeps.setShaderStagesDirty,
    clearWebGPUShaderStages: lifecycleDeps.clearWebGPUShaderStages,
    destroyWebGPUStageTargets: lifecycleDeps.destroyWebGPUStageTargets,
    clearWebGLShaderStages: lifecycleDeps.clearWebGLShaderStages,
    destroyWebGLStageTargets: lifecycleDeps.destroyWebGLStageTargets,
    handleSearchWasmReset: hooks.handleSearchWasmReset,
    internalState,
    maxScrollbackBytes,
    loop,
  });

  return {
    sendInput,
    createPublicApi: (publicApiCapabilities) =>
      createRuntimePublicApi({
        runtimeEvents: options.runtimeEvents,
        getLifecycleState: lifecycle.getLifecycleState,
        internalState,
        inputHandler: runtime.inputHandler,
        ptyInputRuntime: runtime.ptyInputRuntime,
        ptyTransport: runtime.ptyTransport,
        interaction: runtime.interaction,
        init: lifecycle.init,
        destroy: lifecycle.destroy,
        applyTheme: lifecycleDeps.applyTheme,
        clearScreen,
        sendInput,
        copySelectionToClipboard,
        pasteFromClipboard,
        publicApiCapabilities,
      }),
  };
}

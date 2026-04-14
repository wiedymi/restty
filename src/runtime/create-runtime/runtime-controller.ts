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
  const {
    session,
    ptyTransport,
    inputHandler,
    ptyInputRuntime,
    interaction,
    lifecycleThemeSizeRuntime,
    cleanupFns,
    cleanupCanvasFns,
    imeInput,
    attachWindowEvents,
    isMacPlatform,
    readState,
    writeState,
    runBeforeInputHook,
    runBeforeRenderOutputHook,
    CURSOR_BLINK_MS,
    RESIZE_ACTIVE_MS,
    TARGET_RENDER_FPS,
    BACKGROUND_RENDER_FPS,
    KITTY_FLAG_REPORT_EVENTS,
    resizeState,
    tickWebGPU,
    tickWebGL,
    updateGrid,
    gridState,
    getCanvas,
    applyTheme,
    ensureFont,
    updateSize,
    replaceCanvas,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    clearWebGPUShaderStages,
    destroyWebGPUStageTargets,
    clearWebGLShaderStages,
    destroyWebGLStageTargets,
    markSearchDirty,
    handleSearchWasmReset,
  } = options;

  const internalState: RuntimeControllerInternalState = {
    paused: false,
    backend: "none",
    preferredRenderer: options.initialPreferredRenderer,
    rafId: 0,
    nextBlinkTime: performance.now() + CURSOR_BLINK_MS,
  };
  const maxScrollbackBytes = resolveMaxScrollbackBytes(options);
  const { loop } = createRuntimeControllerRenderLoop({
    internalState,
    readState,
    writeState,
    resizeState,
    CURSOR_BLINK_MS,
    RESIZE_ACTIVE_MS,
    TARGET_RENDER_FPS,
    BACKGROUND_RENDER_FPS,
    tickWebGPU,
    tickWebGL,
  });
  const { sendInput, clearScreen } = createRuntimeControllerInput({
    ptyTransport,
    inputHandler,
    ptyInputRuntime,
    interaction,
    readState,
    writeState,
    getCanvas,
    markSearchDirty,
    runBeforeInputHook,
    runBeforeRenderOutputHook,
  });
  const { copySelectionToClipboard, pasteFromClipboard } = createRuntimeControllerClipboard({
    getSelectionText: options.getSelectionText,
    ptyInputRuntime,
  });

  if (attachWindowEvents) {
    attachRuntimeControllerKeyboardEvents({
      cleanupFns,
      imeInput,
      isMacPlatform,
      inputHandler,
      ptyInputRuntime,
      interaction,
      readState,
      writeState,
      getCanvas,
      copySelectionToClipboard,
      KITTY_FLAG_REPORT_EVENTS,
    });
  }

  const lifecycle = createRuntimeControllerLifecycle({
    runtimeEvents: options.runtimeEvents,
    session,
    ptyTransport,
    ptyInputRuntime,
    lifecycleThemeSizeRuntime,
    cleanupFns,
    cleanupCanvasFns,
    readState,
    writeState,
    gridState,
    getCanvas,
    applyTheme,
    ensureFont,
    updateSize,
    updateGrid,
    replaceCanvas,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    clearWebGPUShaderStages,
    destroyWebGPUStageTargets,
    clearWebGLShaderStages,
    destroyWebGLStageTargets,
    handleSearchWasmReset,
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
        inputHandler,
        ptyInputRuntime,
        ptyTransport,
        interaction,
        init: lifecycle.init,
        destroy: lifecycle.destroy,
        applyTheme,
        clearScreen,
        sendInput,
        copySelectionToClipboard,
        pasteFromClipboard,
        publicApiCapabilities,
      }),
  };
}

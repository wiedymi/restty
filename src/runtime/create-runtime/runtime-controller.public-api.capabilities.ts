import type { InputHandler } from "../../input";
import type { PtyTransport } from "../../pty";
import type {
  ResttyRuntimeEventsView,
  ResttyRuntimeInteractionApi,
  ResttyRuntimeIoApi,
  ResttyRuntimeLifecycleView,
  ResttyRuntimeRenderApi,
  ResttyRuntimeSearchApi,
  ResttyRuntimeTerminalApi,
} from "../core/api";
import type { ResttyRuntimeLifecycleState } from "../core/lifecycle";
import type { ResttyRuntimeEvent, ResttyRuntimeEventHub } from "../core/runtime-events";
import type { RuntimeInteraction } from "./interaction-runtime/runtime.types";
import type { PtyInputRuntime } from "./pty-input-runtime.types";
import type {
  RuntimeControllerPublicOptions,
  RuntimeSendInput,
} from "./runtime-controller.api.types";
import type { RuntimeControllerInternalState } from "./runtime-controller.state.types";

type RuntimeLifecycleDeps = {
  init: () => Promise<void>;
  destroy: () => void;
  getLifecycleState: () => ResttyRuntimeLifecycleState;
};

type RuntimeEventsDeps = {
  runtimeEvents: ResttyRuntimeEventHub;
  getLifecycleState: () => ResttyRuntimeLifecycleState;
};

type RuntimeTerminalDeps = {
  init: () => Promise<void>;
  getLifecycleState: () => ResttyRuntimeLifecycleState;
  internalState: RuntimeControllerInternalState;
  applyTheme: ResttyRuntimeTerminalApi["applyTheme"];
  clearScreen: () => void;
  publicApiOptions: RuntimeControllerPublicOptions;
};

type RuntimeIoDeps = {
  sendInput: RuntimeSendInput;
  ptyInputRuntime: PtyInputRuntime;
  ptyTransport: Pick<PtyTransport, "isConnected">;
};

type RuntimeInteractionDeps = {
  inputHandler: InputHandler;
  ptyInputRuntime: PtyInputRuntime;
  interaction: Pick<RuntimeInteraction, "selectWordAtClientPoint">;
  publicApiOptions: RuntimeControllerPublicOptions;
  copySelectionToClipboard: ResttyRuntimeInteractionApi["copySelectionToClipboard"];
  pasteFromClipboard: ResttyRuntimeInteractionApi["pasteFromClipboard"];
};

type RuntimeSearchDeps = {
  publicApiOptions: RuntimeControllerPublicOptions;
};

type RuntimeRenderDeps = {
  internalState: RuntimeControllerInternalState;
  publicApiOptions: RuntimeControllerPublicOptions;
};

export function createRuntimeLifecycleView({
  init,
  destroy,
  getLifecycleState,
}: RuntimeLifecycleDeps): ResttyRuntimeLifecycleView {
  return {
    init,
    destroy,
    state: () => getLifecycleState(),
  };
}

export function createRuntimeEventsView({
  runtimeEvents,
  getLifecycleState,
}: RuntimeEventsDeps): ResttyRuntimeEventsView {
  return {
    subscribe: (listener: (event: ResttyRuntimeEvent) => void) => {
      const dispose = runtimeEvents.subscribe(listener);
      try {
        listener({ type: "state", state: getLifecycleState() });
      } catch {
        // Ignore runtime event listener errors.
      }
      return dispose;
    },
  };
}

export function createRuntimeTerminalView({
  init,
  getLifecycleState,
  internalState,
  applyTheme,
  clearScreen,
  publicApiOptions,
}: RuntimeTerminalDeps): ResttyRuntimeTerminalApi {
  function setRenderer(value: "auto" | "webgpu" | "webgl2") {
    if (getLifecycleState() === "destroyed") return;
    if (value !== "auto" && value !== "webgpu" && value !== "webgl2") return;
    internalState.preferredRenderer = value;
    void init();
  }

  return {
    setRenderer,
    setPaused: (value: boolean) => {
      internalState.paused = Boolean(value);
    },
    togglePause: () => {
      internalState.paused = !internalState.paused;
    },
    setFontSize: publicApiOptions.setFontSize,
    setLigatures: publicApiOptions.setLigatures,
    setFontHinting: publicApiOptions.setFontHinting,
    setFontHintTarget: publicApiOptions.setFontHintTarget,
    setFontSources: publicApiOptions.setFontSources,
    applyTheme,
    resetTheme: publicApiOptions.resetTheme,
    clearScreen,
  };
}

export function createRuntimeIoView({
  sendInput,
  ptyInputRuntime,
  ptyTransport,
}: RuntimeIoDeps): ResttyRuntimeIoApi {
  return {
    sendInput,
    sendKeyInput: ptyInputRuntime.sendKeyInput,
    connectPty: ptyInputRuntime.connectPty,
    disconnectPty: ptyInputRuntime.disconnectPty,
    isPtyConnected: () => ptyTransport.isConnected(),
  };
}

export function createRuntimeInteractionView({
  inputHandler,
  ptyInputRuntime,
  interaction,
  publicApiOptions,
  copySelectionToClipboard,
  pasteFromClipboard,
}: RuntimeInteractionDeps): ResttyRuntimeInteractionApi {
  function setMouseMode(value: Parameters<InputHandler["setMouseMode"]>[0]) {
    inputHandler.setMouseMode(value);
    ptyInputRuntime.updateMouseStatus();
  }

  return {
    setMouseMode,
    getMouseStatus: () => inputHandler.getMouseStatus(),
    copySelectionToClipboard,
    pasteFromClipboard,
    selectWordAtClientPoint: interaction.selectWordAtClientPoint,
    resize: publicApiOptions.resize,
    focus: publicApiOptions.focus,
    blur: publicApiOptions.blur,
    updateSize: publicApiOptions.updateSize,
  };
}

export function createRuntimeSearchView({
  publicApiOptions,
}: RuntimeSearchDeps): ResttyRuntimeSearchApi {
  return {
    setQuery: publicApiOptions.setSearchQuery,
    clear: publicApiOptions.clearSearch,
    next: publicApiOptions.searchNext,
    previous: publicApiOptions.searchPrevious,
    getState: publicApiOptions.getSearchState,
  };
}

export function createRuntimeRenderView({
  internalState,
  publicApiOptions,
}: RuntimeRenderDeps): ResttyRuntimeRenderApi {
  return {
    getBackend: () => internalState.backend,
    setShaderStages: publicApiOptions.setShaderStages,
    getShaderStages: publicApiOptions.getShaderStages,
  };
}

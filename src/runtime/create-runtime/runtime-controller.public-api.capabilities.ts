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
  RuntimeControllerPublicCapabilities,
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
  terminalCapabilities: RuntimeControllerPublicCapabilities["terminal"];
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
  interactionCapabilities: RuntimeControllerPublicCapabilities["interaction"];
  copySelectionToClipboard: ResttyRuntimeInteractionApi["copySelectionToClipboard"];
  pasteFromClipboard: ResttyRuntimeInteractionApi["pasteFromClipboard"];
};

type RuntimeSearchDeps = {
  searchCapabilities: RuntimeControllerPublicCapabilities["search"];
};

type RuntimeRenderDeps = {
  internalState: RuntimeControllerInternalState;
  renderCapabilities: RuntimeControllerPublicCapabilities["render"];
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
  terminalCapabilities,
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
    setFontSize: terminalCapabilities.setFontSize,
    setLigatures: terminalCapabilities.setLigatures,
    setFontHinting: terminalCapabilities.setFontHinting,
    setFontHintTarget: terminalCapabilities.setFontHintTarget,
    setFonts: terminalCapabilities.setFonts,
    applyTheme,
    resetTheme: terminalCapabilities.resetTheme,
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
  interactionCapabilities,
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
    resize: interactionCapabilities.resize,
    focus: interactionCapabilities.focus,
    blur: interactionCapabilities.blur,
    updateSize: interactionCapabilities.updateSize,
  };
}

export function createRuntimeSearchView({
  searchCapabilities,
}: RuntimeSearchDeps): ResttyRuntimeSearchApi {
  return {
    setQuery: searchCapabilities.setQuery,
    clear: searchCapabilities.clear,
    next: searchCapabilities.next,
    previous: searchCapabilities.previous,
    getState: searchCapabilities.getState,
  };
}

export function createRuntimeRenderView({
  internalState,
  renderCapabilities,
}: RuntimeRenderDeps): ResttyRuntimeRenderApi {
  return {
    getBackend: () => internalState.backend,
    setShaderStages: renderCapabilities.setShaderStages,
    getShaderStages: renderCapabilities.getShaderStages,
  };
}

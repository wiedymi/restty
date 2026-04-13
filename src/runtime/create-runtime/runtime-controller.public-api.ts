import type { InputHandler } from "../../input";
import type { PtyTransport } from "../../pty";
import type {
  ResttyRuntime,
  ResttyRuntimeInteractionApi,
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

type RuntimeControllerPublicApiDeps = {
  runtimeEvents: ResttyRuntimeEventHub;
  getLifecycleState: () => ResttyRuntimeLifecycleState;
  internalState: RuntimeControllerInternalState;
  inputHandler: InputHandler;
  ptyInputRuntime: PtyInputRuntime;
  ptyTransport: Pick<PtyTransport, "isConnected">;
  interaction: Pick<RuntimeInteraction, "selectWordAtClientPoint">;
  init: () => Promise<void>;
  destroy: () => void;
  applyTheme: ResttyRuntimeTerminalApi["applyTheme"];
  clearScreen: () => void;
  sendInput: RuntimeSendInput;
  copySelectionToClipboard: ResttyRuntimeInteractionApi["copySelectionToClipboard"];
  pasteFromClipboard: ResttyRuntimeInteractionApi["pasteFromClipboard"];
  publicApiOptions: RuntimeControllerPublicOptions;
};

export function createRuntimePublicApi(deps: RuntimeControllerPublicApiDeps): ResttyRuntime {
  deps.ptyInputRuntime.setPtyStatus("disconnected");
  deps.ptyInputRuntime.updateMouseStatus();

  function setRenderer(value: "auto" | "webgpu" | "webgl2") {
    if (deps.getLifecycleState() === "destroyed") return;
    if (value !== "auto" && value !== "webgpu" && value !== "webgl2") return;
    deps.internalState.preferredRenderer = value;
    void deps.init();
  }

  function setPaused(value: boolean) {
    deps.internalState.paused = Boolean(value);
  }

  function togglePause() {
    deps.internalState.paused = !deps.internalState.paused;
  }

  function setMouseMode(value: Parameters<InputHandler["setMouseMode"]>[0]) {
    deps.inputHandler.setMouseMode(value);
    deps.ptyInputRuntime.updateMouseStatus();
  }

  function getMouseStatus() {
    return deps.inputHandler.getMouseStatus();
  }

  const lifecycle = {
    init: deps.init,
    destroy: deps.destroy,
    state: () => deps.getLifecycleState(),
  };
  const terminal = {
    setRenderer,
    setPaused,
    togglePause,
    setFontSize: deps.publicApiOptions.setFontSize,
    setLigatures: deps.publicApiOptions.setLigatures,
    setFontHinting: deps.publicApiOptions.setFontHinting,
    setFontHintTarget: deps.publicApiOptions.setFontHintTarget,
    setFontSources: deps.publicApiOptions.setFontSources,
    applyTheme: deps.applyTheme,
    resetTheme: deps.publicApiOptions.resetTheme,
    clearScreen: deps.clearScreen,
  };
  const io = {
    sendInput: deps.sendInput,
    sendKeyInput: deps.ptyInputRuntime.sendKeyInput,
    connectPty: deps.ptyInputRuntime.connectPty,
    disconnectPty: deps.ptyInputRuntime.disconnectPty,
    isPtyConnected: () => deps.ptyTransport.isConnected(),
  };
  const interaction = {
    setMouseMode,
    getMouseStatus,
    copySelectionToClipboard: deps.copySelectionToClipboard,
    pasteFromClipboard: deps.pasteFromClipboard,
    selectWordAtClientPoint: deps.interaction.selectWordAtClientPoint,
    resize: deps.publicApiOptions.resize,
    focus: deps.publicApiOptions.focus,
    blur: deps.publicApiOptions.blur,
    updateSize: deps.publicApiOptions.updateSize,
  };
  const search = {
    setQuery: deps.publicApiOptions.setSearchQuery,
    clear: deps.publicApiOptions.clearSearch,
    next: deps.publicApiOptions.searchNext,
    previous: deps.publicApiOptions.searchPrevious,
    getState: deps.publicApiOptions.getSearchState,
  };
  const render = {
    getBackend: () => deps.internalState.backend,
    setShaderStages: deps.publicApiOptions.setShaderStages,
    getShaderStages: deps.publicApiOptions.getShaderStages,
  };
  const events = {
    subscribe: (listener: (event: ResttyRuntimeEvent) => void) => {
      const dispose = deps.runtimeEvents.subscribe(listener);
      try {
        listener({ type: "state", state: deps.getLifecycleState() });
      } catch {
        // Ignore runtime event listener errors.
      }
      return dispose;
    },
  };

  return {
    lifecycle,
    events,
    terminal,
    io,
    interaction,
    search,
    render,
  };
}

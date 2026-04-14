import type { InputHandler } from "../../input";
import type { PtyTransport } from "../../pty";
import type {
  ResttyRuntime,
  ResttyRuntimeInteractionApi,
  ResttyRuntimeTerminalApi,
} from "../core/api";
import type { ResttyRuntimeLifecycleState } from "../core/lifecycle";
import type { ResttyRuntimeEventHub } from "../core/runtime-events";
import type { RuntimeInteraction } from "./interaction-runtime/runtime.types";
import type { PtyInputRuntime } from "./pty-input-runtime.types";
import {
  createRuntimeEventsView,
  createRuntimeInteractionView,
  createRuntimeIoView,
  createRuntimeLifecycleView,
  createRuntimeRenderView,
  createRuntimeSearchView,
  createRuntimeTerminalView,
} from "./runtime-controller.public-api.capabilities";
import type {
  RuntimeControllerPublicCapabilities,
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
  publicApiCapabilities: RuntimeControllerPublicCapabilities;
};

export function createRuntimePublicApi(deps: RuntimeControllerPublicApiDeps): ResttyRuntime {
  return {
    lifecycle: createRuntimeLifecycleView({
      init: deps.init,
      destroy: deps.destroy,
      getLifecycleState: deps.getLifecycleState,
    }),
    events: createRuntimeEventsView({
      runtimeEvents: deps.runtimeEvents,
      getLifecycleState: deps.getLifecycleState,
    }),
    terminal: createRuntimeTerminalView({
      init: deps.init,
      getLifecycleState: deps.getLifecycleState,
      internalState: deps.internalState,
      applyTheme: deps.applyTheme,
      clearScreen: deps.clearScreen,
      terminalCapabilities: deps.publicApiCapabilities.terminal,
    }),
    io: createRuntimeIoView({
      sendInput: deps.sendInput,
      ptyInputRuntime: deps.ptyInputRuntime,
      ptyTransport: deps.ptyTransport,
    }),
    interaction: createRuntimeInteractionView({
      inputHandler: deps.inputHandler,
      ptyInputRuntime: deps.ptyInputRuntime,
      interaction: deps.interaction,
      interactionCapabilities: deps.publicApiCapabilities.interaction,
      copySelectionToClipboard: deps.copySelectionToClipboard,
      pasteFromClipboard: deps.pasteFromClipboard,
    }),
    search: createRuntimeSearchView({
      searchCapabilities: deps.publicApiCapabilities.search,
    }),
    render: createRuntimeRenderView({
      internalState: deps.internalState,
      renderCapabilities: deps.publicApiCapabilities.render,
    }),
  };
}

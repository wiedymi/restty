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
      publicApiOptions: deps.publicApiOptions,
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
      publicApiOptions: deps.publicApiOptions,
      copySelectionToClipboard: deps.copySelectionToClipboard,
      pasteFromClipboard: deps.pasteFromClipboard,
    }),
    search: createRuntimeSearchView({
      publicApiOptions: deps.publicApiOptions,
    }),
    render: createRuntimeRenderView({
      internalState: deps.internalState,
      publicApiOptions: deps.publicApiOptions,
    }),
  };
}

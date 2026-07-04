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
  runtimeEvents: Pick<ResttyRuntimeEventHub, "subscribe">;
  init: () => Promise<void>;
  getLifecycleState: () => ResttyRuntimeLifecycleState;
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
  runtimeEvents,
  init,
  getLifecycleState,
  sendInput,
  ptyInputRuntime,
  ptyTransport,
}: RuntimeIoDeps): ResttyRuntimeIoApi {
  type QueuedInput = {
    text: string;
    source?: string;
  };

  let initTask: Promise<void> | null = null;
  let pendingConnectUrl: string | null = null;
  const pendingInputs: QueuedInput[] = [];

  function flushPendingIo(): void {
    if (getLifecycleState() !== "ready") return;

    const inputs = pendingInputs.splice(0);
    for (const input of inputs) {
      sendInput(input.text, input.source);
    }

    const connectUrl = pendingConnectUrl;
    pendingConnectUrl = null;
    if (connectUrl !== null && !ptyTransport.isConnected()) {
      ptyInputRuntime.connectPty(connectUrl);
    }
  }

  function waitForActiveInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      let dispose: (() => void) | null = null;

      const settle = (callback: () => void) => {
        dispose?.();
        dispose = null;
        callback();
      };

      dispose = runtimeEvents.subscribe((event) => {
        if (event.type !== "state") return;
        if (event.state === "ready" || event.state === "destroyed") {
          settle(resolve);
        } else if (event.state === "failed") {
          settle(() => reject(new Error("runtime init failed")));
        }
      });

      const state = getLifecycleState();
      if (state === "ready" || state === "destroyed") {
        settle(resolve);
      } else if (state === "failed") {
        settle(() => reject(new Error("runtime init failed")));
      }
    });
  }

  function ensureReady(): void {
    const lifecycleState = getLifecycleState();
    if (lifecycleState === "destroyed") return;
    if (lifecycleState === "ready") {
      flushPendingIo();
      return;
    }

    if (!initTask) {
      const readinessTask = lifecycleState === "initializing" ? waitForActiveInit() : init();
      initTask = readinessTask
        .then(flushPendingIo)
        .catch((err: unknown) => {
          pendingConnectUrl = null;
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[restty] runtime init error: ${message}`);
        })
        .finally(() => {
          initTask = null;
        });
    }
  }

  function sendReadyInput(text: string, source?: string): void {
    if (getLifecycleState() === "destroyed") return;
    if (getLifecycleState() === "ready") {
      sendInput(text, source);
      return;
    }
    pendingInputs.push({ text, source });
    ensureReady();
  }

  function connectReadyPty(url = ""): void {
    if (getLifecycleState() === "destroyed") return;
    if (ptyTransport.isConnected()) return;
    pendingConnectUrl = url;
    ensureReady();
  }

  function disconnectReadyPty(): void {
    pendingConnectUrl = null;
    ptyInputRuntime.disconnectPty();
  }

  return {
    sendInput: sendReadyInput,
    sendKeyInput: ptyInputRuntime.sendKeyInput,
    connectPty: connectReadyPty,
    disconnectPty: disconnectReadyPty,
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

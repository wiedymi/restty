import type { InputHandler } from "../../input";
import type { PtyTransport } from "../../pty";
import type { RuntimeInteraction } from "./interaction-runtime/runtime.types";
import type { PtyInputRuntime } from "./pty-input-runtime.types";
import type { RuntimeSendInput } from "./runtime-controller.api.types";
import type { RuntimeControllerSharedState } from "./runtime-controller.state.types";
import { normalizeNewlines } from "./runtime-io-utils";

type CreateRuntimeControllerInputOptions = {
  ptyTransport: PtyTransport;
  inputHandler: InputHandler;
  ptyInputRuntime: PtyInputRuntime;
  interaction: RuntimeInteraction;
  readState: () => RuntimeControllerSharedState;
  writeState: (patch: Partial<RuntimeControllerSharedState>) => void;
  getCanvas: () => HTMLCanvasElement;
  markSearchDirty: () => void;
  runBeforeInputHook: (text: string, source: string) => string | null;
  runBeforeRenderOutputHook: (text: string, source: string) => string | null;
};

export function createRuntimeControllerInput(options: CreateRuntimeControllerInputOptions) {
  function writeToWasm(handle: number, text: string) {
    const shared = options.readState();
    if (!shared.wasm) return;
    shared.wasm.write(handle, text);
  }

  function flushWasmOutputToPty() {
    const shared = options.readState();
    if (!shared.wasm || !shared.wasmHandle) return;
    if (!options.ptyTransport.isConnected()) return;

    let iterations = 0;
    while (iterations < 32) {
      const out = shared.wasm.drainOutput(shared.wasmHandle);
      if (!out) break;
      options.ptyTransport.sendInput(out);
      iterations += 1;
    }
  }

  const sendInput: RuntimeSendInput = (text, source = "program", config = {}) => {
    const shared = options.readState();
    if (!shared.wasmReady || !shared.wasm || !shared.wasmHandle) return;
    if (!text) return;
    let intercepted = text;
    if (!config.skipHooks) {
      intercepted =
        source === "pty"
          ? options.runBeforeRenderOutputHook(text, source)
          : options.runBeforeInputHook(text, source);
    }
    if (!intercepted) return;
    const normalized = source === "pty" ? intercepted : normalizeNewlines(intercepted);
    if (
      source === "key" &&
      (options.interaction.selectionState.active || options.interaction.selectionState.dragging)
    ) {
      options.interaction.clearSelection();
    }
    if (source === "pty" && options.interaction.linkState.hoverId) {
      options.interaction.updateLinkHover(null);
    }
    const canvas = options.getCanvas();
    shared.wasm.setPixelSize(shared.wasmHandle, canvas.width, canvas.height);
    writeToWasm(shared.wasmHandle, normalized);
    flushWasmOutputToPty();
    options.markSearchDirty();
    // While the app holds synchronized output (mode 2026), keep feeding the
    // terminal but arm the reset fallback in case the end sequence never
    // arrives. The render loop skips presentation until the mode clears, so
    // needsRender stays pending instead of dropping the frame.
    if (source === "pty" && options.inputHandler.isSynchronizedOutput?.()) {
      options.ptyInputRuntime.scheduleSyncOutputReset();
    } else {
      options.ptyInputRuntime.cancelSyncOutputReset();
    }
    options.writeState({ needsRender: true });
  };

  function clearScreen() {
    sendInput("\x1b[2J\x1b[H");
  }

  return {
    clearScreen,
    sendInput,
  };
}

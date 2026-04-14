import {
  copyToClipboard as writeClipboardText,
  pasteFromClipboard as readClipboardText,
} from "../../selection";
import { normalizeNewlines } from "./runtime-io-utils";
import { resolveMaxScrollbackBytes } from "./max-scrollback";
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

  function writeToWasm(handle: number, text: string) {
    const shared = readState();
    if (!shared.wasm) return;
    shared.wasm.write(handle, text);
  }

  function flushWasmOutputToPty() {
    const shared = readState();
    if (!shared.wasm || !shared.wasmHandle) return;
    if (!ptyTransport.isConnected()) return;

    let iterations = 0;
    while (iterations < 32) {
      const out = shared.wasm.drainOutput(shared.wasmHandle);
      if (!out) break;
      ptyTransport.sendInput(out);
      iterations += 1;
    }
  }

  function sendInput(text: string, source = "program", config: { skipHooks?: boolean } = {}) {
    const shared = readState();
    if (!shared.wasmReady || !shared.wasm || !shared.wasmHandle) return;
    if (!text) return;
    let intercepted = text;
    if (!config.skipHooks) {
      intercepted =
        source === "pty"
          ? runBeforeRenderOutputHook(text, source)
          : runBeforeInputHook(text, source);
    }
    if (!intercepted) return;
    const normalized = source === "pty" ? intercepted : normalizeNewlines(intercepted);
    if (
      source === "key" &&
      (interaction.selectionState.active || interaction.selectionState.dragging)
    ) {
      interaction.clearSelection();
    }
    if (source === "pty" && interaction.linkState.hoverId) interaction.updateLinkHover(null);
    const canvas = getCanvas();
    shared.wasm.setPixelSize(shared.wasmHandle, canvas.width, canvas.height);
    writeToWasm(shared.wasmHandle, normalized);
    flushWasmOutputToPty();
    markSearchDirty();
    if (source === "pty" && inputHandler.isSynchronizedOutput?.()) {
      ptyInputRuntime.scheduleSyncOutputReset();
      return;
    }
    ptyInputRuntime.cancelSyncOutputReset();
    shared.wasm.renderUpdate(shared.wasmHandle);
    writeState({ needsRender: true });
  }

  async function copySelectionToClipboard() {
    const text = options.getSelectionText();
    if (!text) return false;
    return writeClipboardText(text);
  }

  async function pasteFromClipboard() {
    const text = await readClipboardText();
    if (text === null) return false;
    if (text) {
      ptyInputRuntime.sendPasteText(text);
      return true;
    }
    return false;
  }

  function clearScreen() {
    sendInput("\x1b[2J\x1b[H");
  }

  if (attachWindowEvents) {
    const hasInputFocus = () => {
      if (typeof document === "undefined") return true;
      const active = document.activeElement;
      const canvas = getCanvas();
      return active === canvas || (imeInput ? active === imeInput : false);
    };
    const ensureImeInputFocus = () => {
      if (!imeInput || typeof document === "undefined") return;
      if (document.activeElement === imeInput) return;
      imeInput.focus({ preventScroll: true });
    };

    const isMacInputSourceShortcut = (event: KeyboardEvent) =>
      isMacPlatform &&
      event.ctrlKey &&
      !event.metaKey &&
      (event.code === "Space" || event.key === " " || event.key === "Spacebar");

    const shouldSkipKeyEvent = (event: KeyboardEvent) => {
      const imeActive =
        typeof document !== "undefined" && imeInput ? document.activeElement === imeInput : false;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target !== imeInput &&
        ["BUTTON", "SELECT", "INPUT", "TEXTAREA"].includes(target.tagName)
      ) {
        return true;
      }
      if (target === imeInput) {
        if (interaction.imeState.composing || event.isComposing) return true;
        if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !event.repeat)
          return true;
      }
      if (
        imeInput &&
        imeActive &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.length === 1 &&
        !event.repeat &&
        !event.isComposing &&
        !interaction.imeState.composing
      ) {
        return true;
      }
      return false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isMacInputSourceShortcut(event)) {
        if (hasInputFocus()) ensureImeInputFocus();
        return;
      }
      if (shouldSkipKeyEvent(event)) return;
      if (!hasInputFocus()) return;
      ensureImeInputFocus();
      writeState({ isFocused: true });
      const shared = readState();
      if (!shared.wasmReady || !shared.wasmHandle) return;

      const key = event.key?.toLowerCase?.() ?? "";
      const hasPrimaryShortcutModifier = isMacPlatform ? event.metaKey : event.ctrlKey;
      const wantsCopy =
        hasPrimaryShortcutModifier &&
        !event.altKey &&
        (key === "c" || (event.shiftKey && key === "c"));
      const wantsPaste =
        hasPrimaryShortcutModifier &&
        !event.altKey &&
        (key === "v" || (event.shiftKey && key === "v"));

      if (wantsCopy && interaction.selectionState.active) {
        event.preventDefault();
        void copySelectionToClipboard();
        return;
      }
      if (wantsPaste) {
        if (imeInput) {
          ensureImeInputFocus();
          return;
        }
        event.preventDefault();
        const seq = inputHandler.encodeKeyEvent(event);
        if (seq) {
          ptyInputRuntime.sendKeyInput(seq);
        }
        return;
      }

      const seq = inputHandler.encodeKeyEvent(event);
      if (seq) {
        if (
          event.type === "keydown" &&
          ["Backspace", "Delete", "Del", "Enter"].includes(event.key)
        ) {
          writeState({
            lastKeydownSeq: seq,
            lastKeydownSeqAt: performance.now(),
          });
        }
        event.preventDefault();
        ptyInputRuntime.sendKeyInput(seq);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isMacInputSourceShortcut(event)) return;
      const shared = readState();
      if (!shared.wasm || !shared.wasmHandle) return;
      if ((shared.wasm.getKittyKeyboardFlags(shared.wasmHandle) & KITTY_FLAG_REPORT_EVENTS) === 0) {
        return;
      }
      if (shouldSkipKeyEvent(event)) return;
      if (!hasInputFocus()) return;
      writeState({ isFocused: true });
      const nextShared = readState();
      if (!nextShared.wasmReady || !nextShared.wasmHandle) return;

      const seq = inputHandler.encodeKeyEvent(event);
      if (seq) {
        event.preventDefault();
        ptyInputRuntime.sendKeyInput(seq);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cleanupFns.push(() => window.removeEventListener("keydown", onKeyDown));
    cleanupFns.push(() => window.removeEventListener("keyup", onKeyUp));
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
    createPublicApi: (publicApiOptions) =>
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
        publicApiOptions,
      }),
  };
}

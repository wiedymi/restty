import type { InputHandler } from "../../input";
import type { RuntimeInteraction } from "./interaction-runtime/runtime.types";
import type { PtyInputRuntime } from "./pty-input-runtime.types";
import type { RuntimeControllerSharedState } from "./runtime-controller.state.types";

type CreateRuntimeControllerKeyboardOptions = {
  cleanupFns: Array<() => void>;
  imeInput: HTMLTextAreaElement | null;
  isMacPlatform: boolean;
  inputHandler: InputHandler;
  ptyInputRuntime: PtyInputRuntime;
  interaction: RuntimeInteraction;
  readState: () => RuntimeControllerSharedState;
  writeState: (patch: Partial<RuntimeControllerSharedState>) => void;
  getCanvas: () => HTMLCanvasElement;
  copySelectionToClipboard: () => Promise<boolean>;
  KITTY_FLAG_REPORT_EVENTS: number;
};

export function attachRuntimeControllerKeyboardEvents(
  options: CreateRuntimeControllerKeyboardOptions,
) {
  const hasInputFocus = () => {
    if (typeof document === "undefined") return true;
    const active = document.activeElement;
    const canvas = options.getCanvas();
    return active === canvas || (options.imeInput ? active === options.imeInput : false);
  };

  const ensureImeInputFocus = () => {
    if (!options.imeInput || typeof document === "undefined") return;
    if (document.activeElement === options.imeInput) return;
    options.imeInput.focus({ preventScroll: true });
  };

  const isMacInputSourceShortcut = (event: KeyboardEvent) =>
    options.isMacPlatform &&
    event.ctrlKey &&
    !event.metaKey &&
    (event.code === "Space" || event.key === " " || event.key === "Spacebar");

  const shouldSkipKeyEvent = (event: KeyboardEvent) => {
    const imeActive =
      typeof document !== "undefined" && options.imeInput
        ? document.activeElement === options.imeInput
        : false;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      target !== options.imeInput &&
      ["BUTTON", "SELECT", "INPUT", "TEXTAREA"].includes(target.tagName)
    ) {
      return true;
    }
    if (target === options.imeInput) {
      if (options.interaction.imeState.composing || event.isComposing) return true;
      if (!event.ctrlKey && !event.metaKey && event.key.length === 1 && !event.repeat) {
        return true;
      }
    }
    if (
      options.imeInput &&
      imeActive &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key.length === 1 &&
      !event.repeat &&
      !event.isComposing &&
      !options.interaction.imeState.composing
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
    options.writeState({ isFocused: true });
    const shared = options.readState();
    if (!shared.wasmReady || !shared.wasmHandle) return;

    const key = event.key?.toLowerCase?.() ?? "";
    const hasPrimaryShortcutModifier = options.isMacPlatform ? event.metaKey : event.ctrlKey;
    const wantsCopy =
      hasPrimaryShortcutModifier &&
      !event.altKey &&
      (key === "c" || (event.shiftKey && key === "c"));
    const wantsPaste =
      hasPrimaryShortcutModifier &&
      !event.altKey &&
      (key === "v" || (event.shiftKey && key === "v"));

    if (wantsCopy && options.interaction.selectionState.active) {
      event.preventDefault();
      void options.copySelectionToClipboard();
      return;
    }
    if (wantsPaste) {
      if (options.imeInput) {
        ensureImeInputFocus();
        return;
      }
      event.preventDefault();
      const seq = options.inputHandler.encodeKeyEvent(event);
      if (seq) {
        options.ptyInputRuntime.sendKeyInput(seq);
      }
      return;
    }

    const seq = options.inputHandler.encodeKeyEvent(event);
    if (seq) {
      if (event.type === "keydown" && ["Backspace", "Delete", "Del", "Enter"].includes(event.key)) {
        options.writeState({
          lastKeydownSeq: seq,
          lastKeydownSeqAt: performance.now(),
        });
      }
      event.preventDefault();
      options.ptyInputRuntime.sendKeyInput(seq);
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (isMacInputSourceShortcut(event)) return;
    const shared = options.readState();
    if (!shared.wasm || !shared.wasmHandle) return;
    if (
      (shared.wasm.getKittyKeyboardFlags(shared.wasmHandle) & options.KITTY_FLAG_REPORT_EVENTS) ===
      0
    ) {
      return;
    }
    if (shouldSkipKeyEvent(event)) return;
    if (!hasInputFocus()) return;
    options.writeState({ isFocused: true });
    const nextShared = options.readState();
    if (!nextShared.wasmReady || !nextShared.wasmHandle) return;

    const seq = options.inputHandler.encodeKeyEvent(event);
    if (seq) {
      event.preventDefault();
      options.ptyInputRuntime.sendKeyInput(seq);
    }
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  options.cleanupFns.push(() => window.removeEventListener("keydown", onKeyDown));
  options.cleanupFns.push(() => window.removeEventListener("keyup", onKeyUp));
}

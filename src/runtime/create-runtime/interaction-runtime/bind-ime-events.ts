import type { BindCanvasEventsOptions } from "./runtime.types";
import type { RuntimeImeState } from "./state.types";

export type BindImeEventsOptions = {
  bindOptions: BindCanvasEventsOptions;
  imeInput: HTMLTextAreaElement;
  imeState: RuntimeImeState;
  cleanupCanvasFns: Array<() => void>;
  getWasmReady: () => boolean;
  getWasmHandle: () => number;
  setPreedit: (text: string, updateInput?: boolean) => void;
  syncImeSelection: () => void;
};

export function bindImeEvents(options: BindImeEventsOptions) {
  const {
    bindOptions,
    imeInput,
    imeState,
    cleanupCanvasFns,
    getWasmReady,
    getWasmHandle,
    setPreedit,
    syncImeSelection,
  } = options;

  const {
    inputHandler,
    sendKeyInput,
    sendPasteText,
    sendPastePayloadFromDataTransfer,
    getLastKeydownSeq,
    getLastKeydownSeqAt,
    keydownBeforeinputDedupeMs,
  } = bindOptions;

  let suppressNextInput = false;
  let lastNormalizedKeydownSeq = "";
  let lastNormalizedKeydownSeqSource = "";

  const getNormalizedLastKeydownSeq = () => {
    const source = getLastKeydownSeq();
    if (!source) {
      lastNormalizedKeydownSeqSource = "";
      lastNormalizedKeydownSeq = "";
      return "";
    }
    if (source === lastNormalizedKeydownSeqSource) return lastNormalizedKeydownSeq;
    lastNormalizedKeydownSeqSource = source;
    lastNormalizedKeydownSeq = inputHandler.mapKeyForPty(source);
    return lastNormalizedKeydownSeq;
  };

  const onCompositionStart = (event: CompositionEvent) => {
    imeState.composing = true;
    setPreedit(event.data || imeInput.value || "");
    requestAnimationFrame(syncImeSelection);
  };

  const onCompositionUpdate = (event: CompositionEvent) => {
    setPreedit(event.data || imeInput.value || "");
    requestAnimationFrame(syncImeSelection);
  };

  const onCompositionEnd = (event: CompositionEvent) => {
    imeState.composing = false;
    setPreedit("", true);
    imeState.selectionStart = 0;
    imeState.selectionEnd = 0;
    // Some browsers can deliver empty compositionend.data for committed text.
    const text = event.data || imeInput.value || "";
    if (text && getWasmReady() && getWasmHandle()) {
      suppressNextInput = true;
      sendKeyInput(text);
    }
    imeInput.value = "";
  };

  const onBeforeInput = (event: InputEvent) => {
    if (!getWasmReady() || !getWasmHandle()) return;
    if (imeState.composing) return;

    if (event.inputType === "insertFromPaste") {
      event.preventDefault();
      suppressNextInput = true;
      const pasteText = event.dataTransfer?.getData("text/plain") || event.data || "";
      if (pasteText) {
        sendPasteText(pasteText);
        imeInput.value = "";
        return;
      }
      sendPastePayloadFromDataTransfer(event.dataTransfer);
      imeInput.value = "";
      return;
    }

    const text = inputHandler.encodeBeforeInput(event);

    if (text) {
      const normalizedText = inputHandler.mapKeyForPty(text);
      const normalizedLastKeydownSeq = getNormalizedLastKeydownSeq();
      const now = performance.now();
      if (
        normalizedLastKeydownSeq &&
        normalizedText === normalizedLastKeydownSeq &&
        now - getLastKeydownSeqAt() <= keydownBeforeinputDedupeMs
      ) {
        event.preventDefault();
        suppressNextInput = true;
        imeInput.value = "";
        return;
      }
      event.preventDefault();
      suppressNextInput = true;
      sendKeyInput(text);
      imeInput.value = "";
    }
  };

  const onInput = (event: InputEvent) => {
    if (!getWasmReady() || !getWasmHandle()) return;
    if (imeState.composing) return;
    if (suppressNextInput) {
      suppressNextInput = false;
      imeInput.value = "";
      return;
    }
    const text = event.data || imeInput.value;
    if (text) {
      sendKeyInput(text);
      imeInput.value = "";
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    if (!getWasmReady() || !getWasmHandle()) return;
    event.preventDefault();
    suppressNextInput = true;
    const text = event.clipboardData?.getData("text/plain") || "";
    if (text) {
      sendPasteText(text);
      imeInput.value = "";
      return;
    }
    sendPastePayloadFromDataTransfer(event.clipboardData);
    imeInput.value = "";
  };

  imeInput.addEventListener("compositionstart", onCompositionStart);
  imeInput.addEventListener("compositionupdate", onCompositionUpdate);
  imeInput.addEventListener("compositionend", onCompositionEnd);
  imeInput.addEventListener("beforeinput", onBeforeInput);
  imeInput.addEventListener("input", onInput);
  imeInput.addEventListener("paste", onPaste);

  cleanupCanvasFns.push(() => {
    imeInput.removeEventListener("compositionstart", onCompositionStart);
    imeInput.removeEventListener("compositionupdate", onCompositionUpdate);
    imeInput.removeEventListener("compositionend", onCompositionEnd);
    imeInput.removeEventListener("beforeinput", onBeforeInput);
    imeInput.removeEventListener("input", onInput);
    imeInput.removeEventListener("paste", onPaste);
  });
}

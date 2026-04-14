import {
  copyToClipboard as writeClipboardText,
  pasteFromClipboard as readClipboardText,
} from "../../selection";
import type { PtyInputRuntime } from "./pty-input-runtime.types";

type CreateRuntimeControllerClipboardOptions = {
  getSelectionText: () => string;
  ptyInputRuntime: Pick<PtyInputRuntime, "sendPasteText">;
};

export function createRuntimeControllerClipboard(options: CreateRuntimeControllerClipboardOptions) {
  async function copySelectionToClipboard() {
    const text = options.getSelectionText();
    if (!text) return false;
    return writeClipboardText(text);
  }

  async function pasteFromClipboard() {
    const text = await readClipboardText();
    if (text === null) return false;
    if (text) {
      options.ptyInputRuntime.sendPasteText(text);
      return true;
    }
    return false;
  }

  return {
    copySelectionToClipboard,
    pasteFromClipboard,
  };
}

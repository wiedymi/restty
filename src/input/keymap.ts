import type { InputHandlerConfig } from "./types";
import { encodeBeforeInputEvent } from "./keymap/before-input";
import { ctrlCharForKey } from "./keymap/control";
import { DEFAULT_CONFIG, sequences } from "./keymap/constants";
import { encodeCommandNavigationKeyEvent, encodeDefaultKeyEvent } from "./keymap/default-mapping";
import { encodeKittyKeyEvent } from "./keymap/kitty";
import { mapKeySequenceForPty } from "./keymap/pty-map";

export { sequences };

/**
 * Encode a KeyboardEvent into a terminal byte sequence.
 */
export function encodeKeyEvent(
  event: KeyboardEvent,
  config: InputHandlerConfig = DEFAULT_CONFIG,
  kittyFlags = 0,
): string {
  if (!event) return "";
  if (event.isComposing) return "";
  if (kittyFlags !== 0) {
    return encodeKittyKeyEvent(event, kittyFlags);
  }
  if (event.metaKey) return encodeCommandNavigationKeyEvent(event);

  const cfg = { ...DEFAULT_CONFIG, ...config };
  let seq = "";

  if (cfg.enableCtrlCombos && event.ctrlKey) {
    seq = ctrlCharForKey(event.key);
    if (event.altKey && seq) seq = `\x1b${seq}`;
  }

  if (!seq) {
    seq = encodeDefaultKeyEvent(event);
  }

  return seq;
}

/**
 * Encode beforeinput events (IME/paste/backspace) into terminal sequences.
 */
export function encodeBeforeInput(event: InputEvent): string {
  return encodeBeforeInputEvent(event);
}

/**
 * Map input sequences to PTY expectations (e.g., DEL vs backspace).
 */
export function mapKeyForPty(seq: string): string {
  return mapKeySequenceForPty(seq);
}

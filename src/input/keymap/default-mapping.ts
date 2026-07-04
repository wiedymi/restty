import { modifierCode } from "./control";
import { sequences } from "./constants";

const FUNCTION_KEY_SEQUENCE_BY_NUMBER: Record<number, string> = {
  1: "\x1bOP",
  2: "\x1bOQ",
  3: "\x1bOR",
  4: "\x1bOS",
  5: "\x1b[15~",
  6: "\x1b[17~",
  7: "\x1b[18~",
  8: "\x1b[19~",
  9: "\x1b[20~",
  10: "\x1b[21~",
  11: "\x1b[23~",
  12: "\x1b[24~",
};

const MODIFIER_CAPABLE_CSI_FINAL_BY_KEY: Record<string, string> = {
  ArrowUp: "A",
  ArrowDown: "B",
  ArrowRight: "C",
  ArrowLeft: "D",
  Home: "H",
  End: "F",
};

const SIMPLE_KEY_SEQUENCES: Record<string, string> = {
  Enter: sequences.enter,
  Backspace: sequences.backspace,
  Delete: sequences.delete,
  Del: sequences.delete,
  Escape: sequences.escape,
  PageUp: "\x1b[5~",
  PageDown: "\x1b[6~",
  Insert: "\x1b[2~",
};

const LINE_EDIT_WORD_NAVIGATION_SEQUENCES: Record<string, string> = {
  ArrowLeft: "\x1bb",
  ArrowRight: "\x1bf",
};

export function encodeCommandNavigationKeyEvent(event: KeyboardEvent): string {
  if (!event.metaKey || event.altKey || event.shiftKey) return "";
  return LINE_EDIT_WORD_NAVIGATION_SEQUENCES[event.key ?? ""] ?? "";
}

export function encodeDefaultKeyEvent(event: KeyboardEvent): string {
  const key = event.key ?? "";
  if (key === "Tab") {
    return event.shiftKey ? sequences.shiftTab : sequences.tab;
  }

  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
    const lineEditWordSeq = LINE_EDIT_WORD_NAVIGATION_SEQUENCES[key];
    if (lineEditWordSeq) return lineEditWordSeq;
  }

  const modifierFinal = MODIFIER_CAPABLE_CSI_FINAL_BY_KEY[key];
  if (modifierFinal) {
    return event.shiftKey || event.altKey || event.ctrlKey
      ? `\x1b[1;${modifierCode(event)}${modifierFinal}`
      : `\x1b[${modifierFinal}`;
  }

  const direct = SIMPLE_KEY_SEQUENCES[key];
  if (direct) return direct;

  if (key.startsWith("F")) {
    const fn = Number(key.slice(1));
    return FUNCTION_KEY_SEQUENCE_BY_NUMBER[fn] ?? "";
  }

  if (key.length === 1) {
    return event.altKey ? `\x1b${key}` : key;
  }

  return "";
}

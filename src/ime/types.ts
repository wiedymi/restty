/**
 * Current state of an active IME composition session.
 */
export type ImeState = {
  /** Whether a composition is currently in progress. */
  composing: boolean;
  /** The uncommitted preedit string shown during composition. */
  preedit: string;
  /** Start offset of the selected range within the preedit string. */
  selectionStart: number;
  /** End offset of the selected range within the preedit string. */
  selectionEnd: number;
};

/** Cursor position in terminal row/column coordinates. */
export type CursorPosition = {
  row: number;
  col: number;
};

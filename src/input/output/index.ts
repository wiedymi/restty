import type { CellPosition, CursorPosition, DesktopNotification, WindowOp } from "../types";
import type { MouseController } from "../mouse";
import {
  applyTrackedPrivateModes,
  deriveAltScreen,
  handleCoreCsiSequence,
  handleWindowOpSequence,
} from "./csi";
import { handleOscSequence } from "./osc";
import { createPromptState, isPromptClickEventsEnabled, observeOscPromptState } from "./prompt";

function normalizeCursorPosition(value: CursorPosition | null | undefined): CursorPosition | null {
  if (!value) return null;
  const row = Number(value.row);
  const col = Number(value.col);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return {
    row: Math.max(1, Math.floor(row)),
    col: Math.max(1, Math.floor(col)),
  };
}

function resolveCursorStepParam(raw: string | undefined): number {
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

function resolveCursorSetParam(raw: string | undefined): number {
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
}

function applyTextToCursorHint(cursor: CursorPosition, text: string, cols: number): void {
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code === 0x0d) {
      cursor.col = 1;
      continue;
    }
    if (code === 0x0a) {
      cursor.row += 1;
      continue;
    }
    if (code === 0x08) {
      cursor.col = Math.max(1, cursor.col - 1);
      continue;
    }
    if (code === 0x09) {
      const nextTabCol = Math.floor((cursor.col - 1) / 8) * 8 + 9;
      cursor.col = cols > 0 ? Math.min(cols, nextTabCol) : nextTabCol;
      continue;
    }
    if (code < 0x20 || code === 0x7f) continue;
    cursor.col += 1;
    if (cols > 0 && cursor.col > cols) {
      cursor.col = 1;
      cursor.row += 1;
    }
  }
}

function applyCsiToCursorHint(cursor: CursorPosition, seq: string, cols: number): void {
  if (!seq.startsWith("\x1b[") || seq.length < 3) return;
  const final = seq[seq.length - 1];
  const body = seq.slice(2, -1);
  if (!/^[0-9;]*$/.test(body)) return;
  const parts = body.length ? body.split(";") : [];
  switch (final) {
    case "A": {
      cursor.row = Math.max(1, cursor.row - resolveCursorStepParam(parts[0]));
      return;
    }
    case "B": {
      cursor.row += resolveCursorStepParam(parts[0]);
      return;
    }
    case "C": {
      const next = cursor.col + resolveCursorStepParam(parts[0]);
      cursor.col = cols > 0 ? Math.min(cols, next) : next;
      return;
    }
    case "D": {
      cursor.col = Math.max(1, cursor.col - resolveCursorStepParam(parts[0]));
      return;
    }
    case "E": {
      cursor.row += resolveCursorStepParam(parts[0]);
      cursor.col = 1;
      return;
    }
    case "F": {
      cursor.row = Math.max(1, cursor.row - resolveCursorStepParam(parts[0]));
      cursor.col = 1;
      return;
    }
    case "G": {
      const next = resolveCursorSetParam(parts[0]);
      cursor.col = cols > 0 ? Math.min(cols, next) : next;
      return;
    }
    case "H":
    case "f": {
      cursor.row = resolveCursorSetParam(parts[0]);
      const next = resolveCursorSetParam(parts[1]);
      cursor.col = cols > 0 ? Math.min(cols, next) : next;
      return;
    }
    case "d": {
      cursor.row = resolveCursorSetParam(parts[0]);
      return;
    }
  }
}

/**
 * Construction options for OutputFilter.
 */
export type OutputFilterOptions = {
  /** Provide the current 1-based cursor position for CPR replies. */
  getCursorPosition: () => CursorPosition;
  /** Sink for reply sequences (CPR, DA, OSC color queries). */
  sendReply: (data: string) => void;
  /** MouseController instance for delegating mouse mode toggling. */
  mouse: MouseController;
  /** Provide default colors for OSC 10/11/12 queries (RGB 0-255). */
  getDefaultColors?: () => {
    fg?: [number, number, number];
    bg?: [number, number, number];
    cursor?: [number, number, number];
  };
  /** Handler for OSC 52 clipboard write requests. */
  onClipboardWrite?: (text: string) => void | Promise<void>;
  /** Handler for OSC 52 clipboard read requests. */
  onClipboardRead?: () => string | null | Promise<string | null>;
  /** Handler for window manipulation sequences (CSI ... t). */
  onWindowOp?: (op: WindowOp) => void;
  /** Provider for XTWINOPS report queries (CSI 14/16/18 t). */
  getWindowMetrics?: () => {
    rows: number;
    cols: number;
    widthPx: number;
    heightPx: number;
    cellWidthPx: number;
    cellHeightPx: number;
  };
  /** Handler for desktop notifications (OSC 9 / OSC 777). */
  onDesktopNotification?: (notification: DesktopNotification) => void;
};

/**
 * Parses output for control queries (CPR/DA) and mouse mode toggles,
 * returning the sanitized output for rendering.
 */
export class OutputFilter {
  private remainder = "";
  private getCursorPosition: () => CursorPosition;
  private sendReply: (data: string) => void;
  private mouse: MouseController;
  private altScreen = false;
  private bracketedPaste = false;
  private focusReporting = false;
  private synchronizedOutput = false;
  private windowOpHandler?: (op: WindowOp) => void;
  private getWindowMetrics?: () => {
    rows: number;
    cols: number;
    widthPx: number;
    heightPx: number;
    cellWidthPx: number;
    cellHeightPx: number;
  };
  private clipboardWrite?: (text: string) => void | Promise<void>;
  private clipboardRead?: () => string | null | Promise<string | null>;
  private getDefaultColors?: () => {
    fg?: [number, number, number];
    bg?: [number, number, number];
    cursor?: [number, number, number];
  };
  private desktopNotificationHandler?: (notification: DesktopNotification) => void;
  private promptState = createPromptState();
  private cursorHint: CursorPosition | null = null;

  constructor(options: OutputFilterOptions) {
    this.getCursorPosition = options.getCursorPosition;
    this.sendReply = options.sendReply;
    this.mouse = options.mouse;
    this.getDefaultColors = options.getDefaultColors;
    this.clipboardWrite = options.onClipboardWrite;
    this.clipboardRead = options.onClipboardRead;
    this.windowOpHandler = options.onWindowOp;
    this.getWindowMetrics = options.getWindowMetrics;
    this.desktopNotificationHandler = options.onDesktopNotification;
  }

  setCursorProvider(fn: () => CursorPosition) {
    this.getCursorPosition = fn;
    this.cursorHint = null;
  }

  setReplySink(fn: (data: string) => void) {
    this.sendReply = fn;
  }

  setWindowOpHandler(fn: (op: WindowOp) => void) {
    this.windowOpHandler = fn;
  }

  isAltScreen() {
    return this.altScreen;
  }

  isBracketedPaste() {
    return this.bracketedPaste;
  }

  isFocusReporting() {
    return this.focusReporting;
  }

  isSynchronizedOutput() {
    return this.synchronizedOutput;
  }

  isPromptClickEventsEnabled() {
    return isPromptClickEventsEnabled(this.promptState, this.altScreen);
  }

  encodePromptClickEvent(cell: CellPosition): string {
    if (!this.isPromptClickEventsEnabled()) return "";
    const row = Math.max(1, Math.floor(cell.row) + 1);
    const col = Math.max(1, Math.floor(cell.col) + 1);
    return `\x1b[<0;${col};${row}M`;
  }

  private observeOsc(seq: string) {
    observeOscPromptState(this.promptState, seq);
  }

  private handleOsc(seq: string) {
    return handleOscSequence(seq, {
      sendReply: this.sendReply,
      getDefaultColors: this.getDefaultColors,
      onClipboardWrite: this.clipboardWrite,
      onClipboardRead: this.clipboardRead,
      onDesktopNotification: this.desktopNotificationHandler,
    });
  }

  private handleModeSeq(seq: string) {
    const modeState = {
      bracketedPaste: this.bracketedPaste,
      focusReporting: this.focusReporting,
      synchronizedOutput: this.synchronizedOutput,
    };
    const handled = applyTrackedPrivateModes(seq, modeState);
    this.bracketedPaste = modeState.bracketedPaste;
    this.focusReporting = modeState.focusReporting;
    this.synchronizedOutput = modeState.synchronizedOutput;
    return handled;
  }

  private handleWindowOp(seq: string) {
    return handleWindowOpSequence(seq, {
      sendReply: this.sendReply,
      getWindowMetrics: this.getWindowMetrics,
      onWindowOp: this.windowOpHandler,
    });
  }

  filter(output: string) {
    if (!output) return output;
    let data = this.remainder + output;
    this.remainder = "";
    const metricCols = this.getWindowMetrics?.()?.cols;
    const colsHint =
      Number.isFinite(metricCols) && Number(metricCols) > 1 ? Math.floor(Number(metricCols)) : 0;
    let trackedCursor = this.cursorHint ?? normalizeCursorPosition(this.getCursorPosition()) ?? { row: 1, col: 1 };
    const getReplyCursor = (): CursorPosition => trackedCursor;
    let result = "";
    let i = 0;

    while (i < data.length) {
      const ch = data[i];
      if (ch !== "\x1b") {
        result += ch;
        applyTextToCursorHint(trackedCursor, ch, colsHint);
        i += 1;
        continue;
      }
      if (i + 1 >= data.length) {
        this.remainder = data.slice(i);
        break;
      }
      if (data[i + 1] === "]") {
        let j = i + 2;
        let terminatorLen = 0;
        while (j < data.length) {
          const code = data.charCodeAt(j);
          if (code === 0x07) {
            terminatorLen = 1;
            break;
          }
          if (code === 0x1b && j + 1 < data.length && data[j + 1] === "\\") {
            terminatorLen = 2;
            break;
          }
          j += 1;
        }
        if (!terminatorLen) {
          this.remainder = data.slice(i);
          break;
        }
        const seq = data.slice(i, j);
        this.observeOsc(seq);
        if (!this.handleOsc(seq)) {
          // Preserve full OSC bytes (including terminator) for sequences
          // we don't intercept, e.g. OSC 8 hyperlinks.
          result += data.slice(i, j + terminatorLen);
        }
        i = j + terminatorLen;
        continue;
      }
      if (data[i + 1] !== "[") {
        result += ch;
        i += 1;
        continue;
      }
      let j = i + 2;
      while (j < data.length) {
        const code = data.charCodeAt(j);
        if (code >= 0x40 && code <= 0x7e) break;
        j += 1;
      }
      if (j >= data.length) {
        this.remainder = data.slice(i);
        break;
      }

      const seq = data.slice(i, j + 1);
      this.altScreen = deriveAltScreen(seq, this.altScreen);
      const mouseHandled = this.mouse.handleModeSeq(seq);
      const modeHandled = this.handleModeSeq(seq);
      if (mouseHandled || modeHandled) {
        i = j + 1;
        continue;
      }
      if (seq.endsWith("t") && this.handleWindowOp(seq)) {
        i = j + 1;
        continue;
      }
      if (
        !handleCoreCsiSequence(seq, {
          sendReply: this.sendReply,
          getCursorPosition: getReplyCursor,
        })
      ) {
        result += seq;
        applyCsiToCursorHint(trackedCursor, seq, colsHint);
      }
      i = j + 1;
    }
    this.cursorHint = { ...trackedCursor };
    return result;
  }
}

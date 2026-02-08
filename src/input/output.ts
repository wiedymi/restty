import type { CursorPosition, WindowOp } from "./types";
import type { MouseController } from "./mouse";
import { isDeviceAttributesQuery, parsePrivateModeSeq, parseWindowOpSeq } from "./ansi";

export type OutputFilterOptions = {
  getCursorPosition: () => CursorPosition;
  sendReply: (data: string) => void;
  mouse: MouseController;
  getDefaultColors?: () => {
    fg?: [number, number, number];
    bg?: [number, number, number];
    cursor?: [number, number, number];
  };
  onClipboardWrite?: (text: string) => void | Promise<void>;
  onClipboardRead?: () => string | null | Promise<string | null>;
  onWindowOp?: (op: WindowOp) => void;
  getWindowMetrics?: () => {
    rows: number;
    cols: number;
    widthPx: number;
    heightPx: number;
    cellWidthPx: number;
    cellHeightPx: number;
  };
};

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function decodeBase64(data: string): Uint8Array {
  if (!data) return new Uint8Array();
  const cleaned = data.replace(/\s+/g, "");
  if (typeof atob === "function") {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i) & 0xff;
    }
    return bytes;
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(cleaned, "base64"));
  }
  return new Uint8Array();
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  return "";
}

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

  constructor(options: OutputFilterOptions) {
    this.getCursorPosition = options.getCursorPosition;
    this.sendReply = options.sendReply;
    this.mouse = options.mouse;
    this.getDefaultColors = options.getDefaultColors;
    this.clipboardWrite = options.onClipboardWrite;
    this.clipboardRead = options.onClipboardRead;
    this.windowOpHandler = options.onWindowOp;
    this.getWindowMetrics = options.getWindowMetrics;
  }

  setCursorProvider(fn: () => CursorPosition) {
    this.getCursorPosition = fn;
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

  private replyOscColor(code: string, rgb: [number, number, number]) {
    const toHex4 = (value: number) =>
      Math.round(Math.max(0, Math.min(255, value)) * 257)
        .toString(16)
        .padStart(4, "0");
    const r = toHex4(rgb[0]);
    const g = toHex4(rgb[1]);
    const b = toHex4(rgb[2]);
    this.sendReply(`\x1b]${code};rgb:${r}/${g}/${b}\x07`);
  }

  private handleOsc(seq: string) {
    const content = seq.slice(2);
    const parts = content.split(";");
    const code = parts[0] ?? "";
    if (code === "52") {
      const target = parts[1] ?? "c";
      const payload = parts.slice(2).join(";");
      if (payload === "?") {
        if (!this.clipboardRead) return true;
        Promise.resolve(this.clipboardRead())
          .then((text) => {
            const safeText = text ?? "";
            const bytes = textEncoder.encode(safeText);
            const encoded = encodeBase64(bytes);
            this.sendReply(`\x1b]52;${target};${encoded}\x07`);
          })
          .catch(() => {});
        return true;
      }
      if (!this.clipboardWrite) return true;
      const bytes = decodeBase64(payload);
      const text = textDecoder.decode(bytes);
      Promise.resolve(this.clipboardWrite(text)).catch(() => {});
      return true;
    }
    const param = parts[1];
    if (param !== "?") return false;
    const colors = this.getDefaultColors?.();
    if (!colors) return false;
    if (code === "10" && colors.fg) {
      this.replyOscColor(code, colors.fg);
      return true;
    }
    if (code === "11" && colors.bg) {
      this.replyOscColor(code, colors.bg);
      return true;
    }
    if (code === "12" && colors.cursor) {
      this.replyOscColor(code, colors.cursor);
      return true;
    }
    return false;
  }

  private handleModeSeq(seq: string) {
    const mode = parsePrivateModeSeq(seq);
    if (!mode) return false;
    const { enabled, codes } = mode;
    let handled = false;
    for (const code of codes) {
      if (code === 2004) {
        this.bracketedPaste = enabled;
        handled = true;
      } else if (code === 1004) {
        this.focusReporting = enabled;
        handled = true;
      } else if (code === 2026) {
        // Track synchronized output mode for renderer scheduling, but let the
        // sequence continue to the terminal core for full VT parity.
        this.synchronizedOutput = enabled;
      }
    }
    return handled;
  }

  private handleWindowOp(seq: string) {
    const params = parseWindowOpSeq(seq);
    if (!params) return false;
    const op = params[0] ?? 0;
    const metrics = this.getWindowMetrics?.();

    if (metrics && op === 14 && params.length === 1) {
      this.sendReply(`\x1b[4;${metrics.heightPx};${metrics.widthPx}t`);
      return true;
    }
    if (metrics && op === 16 && params.length === 1) {
      this.sendReply(`\x1b[6;${metrics.cellHeightPx};${metrics.cellWidthPx}t`);
      return true;
    }
    if (metrics && op === 18 && params.length === 1) {
      this.sendReply(`\x1b[8;${metrics.rows};${metrics.cols}t`);
      return true;
    }

    if (!this.windowOpHandler) return false;
    if (params[0] === 8 && params.length >= 3) {
      this.windowOpHandler({
        type: "resize",
        rows: params[1] ?? 0,
        cols: params[2] ?? 0,
        params,
        raw: seq,
      });
    } else {
      this.windowOpHandler({ type: "unknown", params, raw: seq });
    }
    return true;
  }

  filter(output: string) {
    if (!output) return output;
    let data = this.remainder + output;
    this.remainder = "";
    let result = "";
    let i = 0;

    while (i < data.length) {
      const ch = data[i];
      if (ch !== "\x1b") {
        result += ch;
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
      const altMode = parsePrivateModeSeq(seq);
      if (altMode) {
        const { enabled, codes } = altMode;
        if (codes.some((code) => code === 47 || code === 1047 || code === 1048 || code === 1049)) {
          this.altScreen = enabled;
        }
      }
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
      if (seq === "\x1b[6n") {
        const { row, col } = this.getCursorPosition();
        this.sendReply(`\x1b[${row};${col}R`);
      } else if (seq === "\x1b[>q") {
        // XTVERSION query used by plugins (e.g. snacks.nvim) to detect
        // kitty/ghostty/wezterm support. Reply with a ghostty-compatible id.
        this.sendReply("\x1bP>|ghostty 1.0\x1b\\");
      } else if (isDeviceAttributesQuery(seq)) {
        this.sendReply("\x1b[?1;2c");
      } else {
        result += seq;
      }
      i = j + 1;
    }
    return result;
  }
}

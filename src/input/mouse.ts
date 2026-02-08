import type { CellPosition, MouseMode, MouseStatus } from "./types";
import { parsePrivateModeSeq } from "./ansi";

/**
 * Construction options for MouseController.
 */
export type MouseControllerOptions = {
  /** Sink for mouse report sequences sent back to the PTY. */
  sendReply: (data: string) => void;
  /** Map pointer events to 0-based cell coordinates. */
  positionToCell: (event: MouseEvent | PointerEvent | WheelEvent) => CellPosition;
  /** Map pointer events to 1-based pixel coordinates (for SGR-Pixels mode). */
  positionToPixel?: (event: MouseEvent | PointerEvent | WheelEvent) => { x: number; y: number };
};

type MotionMode = "none" | "drag" | "any";
type MouseFormat = "x10" | "utf8" | "sgr" | "urxvt" | "sgr_pixels";

/**
 * Tracks mouse reporting state (mode, format, motion tracking) and encodes
 * pointer events into terminal mouse sequences (X10, UTF-8, URxvt, SGR).
 */
export class MouseController {
  private mode: MouseMode = "auto";
  private enabled = false;
  private format: MouseFormat = "x10";
  private motion: MotionMode = "none";
  private pressed = false;
  private button = 0;
  private flags = { 1000: false, 1002: false, 1003: false };
  private x10Event = false;

  private sendReply: (data: string) => void;
  private positionToCell: (event: MouseEvent | PointerEvent | WheelEvent) => CellPosition;
  private positionToPixel?: (event: MouseEvent | PointerEvent | WheelEvent) => {
    x: number;
    y: number;
  };

  constructor(options: MouseControllerOptions) {
    this.sendReply = options.sendReply;
    this.positionToCell = options.positionToCell;
    this.positionToPixel = options.positionToPixel;
  }

  setReplySink(fn: (data: string) => void) {
    this.sendReply = fn;
  }

  setPositionToCell(fn: (event: MouseEvent | PointerEvent | WheelEvent) => CellPosition) {
    this.positionToCell = fn;
  }

  setPositionToPixel(
    fn: (event: MouseEvent | PointerEvent | WheelEvent) => { x: number; y: number },
  ) {
    this.positionToPixel = fn;
  }

  setMode(mode: MouseMode) {
    this.mode = mode;
    if (mode === "on") {
      this.enabled = true;
      this.format = "sgr";
      this.motion = "drag";
    } else if (mode === "off") {
      this.enabled = false;
      this.format = "x10";
      this.motion = "none";
    } else {
      this.enabled = this.x10Event || this.flags[1000] || this.flags[1002] || this.flags[1003];
      if (this.flags[1003]) this.motion = "any";
      else if (this.flags[1002]) this.motion = "drag";
      else this.motion = "none";
    }
  }

  handleModeSeq(seq: string) {
    const mode = parsePrivateModeSeq(seq);
    if (!mode) return false;
    const { enabled, codes } = mode;
    let handled = false;
    for (const code of codes) {
      if (code === 9) {
        this.x10Event = enabled;
        handled = true;
        continue;
      }
      if (code === 1006) {
        this.format = enabled ? "sgr" : "x10";
        handled = true;
        continue;
      }
      if (code === 1016) {
        this.format = enabled ? "sgr_pixels" : "x10";
        handled = true;
        continue;
      }
      if (code === 1005) {
        this.format = enabled ? "utf8" : "x10";
        handled = true;
        continue;
      }
      if (code === 1015) {
        this.format = enabled ? "urxvt" : "x10";
        handled = true;
        continue;
      }
      if (code === 1000 || code === 1002 || code === 1003) {
        this.updateFlags(code, enabled);
        handled = true;
      }
    }
    return handled;
  }

  isActive() {
    if (this.mode === "off") return false;
    if (this.mode === "on") return true;
    return this.enabled;
  }

  getStatus(): MouseStatus {
    return { mode: this.mode, active: this.isActive(), detail: this.format, enabled: this.enabled };
  }

  sendMouseEvent(kind: "down" | "up" | "move" | "wheel", event: PointerEvent | WheelEvent) {
    if (!this.isActive()) return false;
    if (!this.positionToCell) return false;

    if (this.isX10EventMode() && kind !== "down") return false;

    const cell = this.positionToCell(event);
    const col = cell.col + 1;
    const row = cell.row + 1;
    const pixel = this.positionToPixel ? this.positionToPixel(event) : null;
    const isSgr = this.format === "sgr" || this.format === "sgr_pixels";
    const base =
      "button" in event && event.button === 1 ? 1 : "button" in event && event.button === 2 ? 2 : 0;
    const mods = this.modifiers(event, !this.isX10EventMode());

    if (kind === "down") {
      this.pressed = true;
      this.button = base;
      const code = base + mods;
      return this.sendMouse(code, col, row, pixel, false);
    }
    if (kind === "up") {
      const btn = this.pressed ? this.button : base;
      this.pressed = false;
      const code = isSgr ? btn + mods : 3 + mods;
      return this.sendMouse(code, col, row, pixel, true);
    }
    if (kind === "move") {
      if (this.motion === "none") return false;
      if (this.motion === "drag" && !this.pressed) return false;
      const btn = this.pressed ? this.button : 3;
      const code = btn + mods + 32;
      return this.sendMouse(code, col, row, pixel, false);
    }
    if (kind === "wheel") {
      const delta = Math.sign((event as WheelEvent).deltaY);
      if (!delta) return false;
      const code = (delta < 0 ? 64 : 65) + mods;
      return this.sendMouse(code, col, row, pixel, false);
    }
    return false;
  }

  private updateFlags(code: number, enabled: boolean) {
    if (!(code in this.flags)) return;
    this.flags[code as 1000 | 1002 | 1003] = enabled;
    this.enabled = this.x10Event || this.flags[1000] || this.flags[1002] || this.flags[1003];
    if (this.flags[1003]) this.motion = "any";
    else if (this.flags[1002]) this.motion = "drag";
    else this.motion = "none";
  }

  private isX10EventMode() {
    if (!this.x10Event) return false;
    return !(this.flags[1000] || this.flags[1002] || this.flags[1003]);
  }

  private modifiers(event: MouseEvent | PointerEvent | WheelEvent, enabled: boolean) {
    if (!enabled) return 0;
    let mod = 0;
    if (event.shiftKey) mod |= 4;
    if (event.altKey) mod |= 8;
    if (event.ctrlKey) mod |= 16;
    return mod;
  }

  private sendMouse(
    code: number,
    col: number,
    row: number,
    pixel: { x: number; y: number } | null,
    release: boolean,
  ) {
    if (this.format === "x10") {
      if (col > 223 || row > 223) return false;
      const cb = 32 + code;
      const cx = 32 + col;
      const cy = 32 + row;
      this.sendReply(`\x1b[M${String.fromCharCode(cb, cx, cy)}`);
      return true;
    }
    if (this.format === "utf8") {
      const cb = String.fromCharCode(32 + code);
      const cx = String.fromCodePoint(32 + col);
      const cy = String.fromCodePoint(32 + row);
      this.sendReply(`\x1b[M${cb}${cx}${cy}`);
      return true;
    }
    if (this.format === "urxvt") {
      this.sendReply(`\x1b[${32 + code};${col};${row}M`);
      return true;
    }
    const suffix = release ? "m" : "M";
    if (this.format === "sgr_pixels" && pixel) {
      this.sendReply(`\x1b[<${code};${pixel.x};${pixel.y}${suffix}`);
      return true;
    }
    this.sendReply(`\x1b[<${code};${col};${row}${suffix}`);
    return true;
  }
}

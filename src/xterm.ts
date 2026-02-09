import { createRestty, type Restty, type ResttyOptions } from "./app/restty";

/**
 * Subset of xterm.js addon contract supported by the restty compatibility layer.
 */
export type TerminalAddon = {
  activate: (terminal: Terminal) => void;
  dispose: () => void;
};

/**
 * Options for the xterm compatibility terminal.
 *
 * `root` is intentionally omitted because xterm-style flow mounts via `open(element)`.
 */
export type TerminalOptions = Omit<ResttyOptions, "root"> & {
  cols?: number;
  rows?: number;
};

/**
 * xterm.js-style compatibility wrapper backed by `Restty`.
 *
 * This intentionally implements a focused subset needed for migration:
 * `open`, `write`, `writeln`, `resize`, `focus`, `blur`, `loadAddon`, `dispose`.
 */
export class Terminal {
  private readonly resttyOptions: Omit<ResttyOptions, "root">;
  private readonly addons = new Set<TerminalAddon>();
  private readonly pendingOutput: string[] = [];

  private resttyInstance: Restty | null = null;
  private elementRef: HTMLElement | null = null;
  private disposed = false;
  private opened = false;
  private pendingSize: { cols: number; rows: number } | null = null;

  cols: number;
  rows: number;

  constructor(options: TerminalOptions = {}) {
    const { cols, rows, ...resttyOptions } = options;
    this.resttyOptions = resttyOptions;
    this.cols = this.normalizeDimension(cols, 80);
    this.rows = this.normalizeDimension(rows, 24);
    if (Number.isFinite(cols) && Number.isFinite(rows)) {
      this.pendingSize = { cols: this.cols, rows: this.rows };
    }
  }

  /** Mounted root passed to `open`, null before mount/dispose. */
  get element(): HTMLElement | null {
    return this.elementRef;
  }

  /** Underlying restty instance after `open`, null otherwise. */
  get restty(): Restty | null {
    return this.resttyInstance;
  }

  open(parent: HTMLElement): void {
    this.ensureUsable();
    if (this.opened) {
      throw new Error("xterm compatibility Terminal is already opened");
    }
    this.opened = true;
    this.elementRef = parent;
    this.resttyInstance = createRestty({
      ...this.resttyOptions,
      root: parent,
    });

    if (this.pendingSize) {
      this.resttyInstance.resize(this.pendingSize.cols, this.pendingSize.rows);
    }

    if (this.pendingOutput.length > 0) {
      for (let i = 0; i < this.pendingOutput.length; i += 1) {
        this.resttyInstance.sendInput(this.pendingOutput[i], "pty");
      }
      this.pendingOutput.length = 0;
    }
  }

  write(data: string, callback?: () => void): void {
    this.ensureUsable();
    if (!data) {
      callback?.();
      return;
    }
    if (this.resttyInstance) {
      this.resttyInstance.sendInput(data, "pty");
    } else {
      this.pendingOutput.push(data);
    }
    callback?.();
  }

  writeln(data = "", callback?: () => void): void {
    this.write(`${data}\r\n`, callback);
  }

  resize(cols: number, rows: number): void {
    this.ensureUsable();
    const next = {
      cols: this.normalizeDimension(cols, this.cols),
      rows: this.normalizeDimension(rows, this.rows),
    };
    this.cols = next.cols;
    this.rows = next.rows;
    this.pendingSize = next;
    this.resttyInstance?.resize(next.cols, next.rows);
  }

  focus(): void {
    if (this.disposed) return;
    this.resttyInstance?.focus();
  }

  blur(): void {
    if (this.disposed) return;
    this.resttyInstance?.blur();
  }

  loadAddon(addon: TerminalAddon): void {
    this.ensureUsable();
    if (!addon || typeof addon.activate !== "function" || typeof addon.dispose !== "function") {
      throw new Error("xterm compatibility addon must define activate() and dispose()");
    }
    if (this.addons.has(addon)) return;
    addon.activate(this);
    this.addons.add(addon);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    const addons = Array.from(this.addons);
    this.addons.clear();
    for (let i = 0; i < addons.length; i += 1) {
      try {
        addons[i].dispose();
      } catch {
        // Ignore addon cleanup errors to keep terminal disposal resilient.
      }
    }

    this.pendingOutput.length = 0;
    this.pendingSize = null;
    this.opened = false;
    this.elementRef = null;

    if (this.resttyInstance) {
      this.resttyInstance.destroy();
      this.resttyInstance = null;
    }
  }

  private ensureUsable(): void {
    if (this.disposed) {
      throw new Error("xterm compatibility Terminal is disposed");
    }
  }

  private normalizeDimension(value: number | undefined, fallback: number): number {
    if (!Number.isFinite(value) || (value as number) <= 0) return fallback;
    return Math.max(1, Math.trunc(value as number));
  }
}

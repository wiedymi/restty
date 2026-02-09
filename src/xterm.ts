import { createRestty, type Restty, type ResttyOptions } from "./app/restty";

export type IDisposable = {
  dispose: () => void;
};

export type TerminalResizeEvent = {
  cols: number;
  rows: number;
};

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
 * Additional unknown keys are accepted for migration ergonomics and kept in
 * the terminal option bag, but are not forwarded to restty internals.
 */
export type TerminalOptions = Omit<ResttyOptions, "root"> & {
  cols?: number;
  rows?: number;
  [key: string]: unknown;
};

/**
 * xterm.js-style compatibility wrapper backed by `Restty`.
 *
 * This intentionally implements a focused subset needed for migration.
 */
export class Terminal {
  private readonly resttyOptionsBase: Omit<ResttyOptions, "root" | "appOptions">;
  private readonly userAppOptions: ResttyOptions["appOptions"];
  private readonly addons = new Set<TerminalAddon>();
  private readonly pendingOutput: string[] = [];
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly resizeListeners = new Set<(size: TerminalResizeEvent) => void>();
  private readonly optionValues: Record<string, unknown>;

  private resttyInstance: Restty | null = null;
  private elementRef: HTMLElement | null = null;
  private disposed = false;
  private opened = false;
  private pendingSize: { cols: number; rows: number } | null = null;

  cols: number;
  rows: number;

  constructor(options: TerminalOptions = {}) {
    const { cols, rows, appOptions, ...resttyOptionsBase } = options;
    this.resttyOptionsBase = resttyOptionsBase as Omit<ResttyOptions, "root" | "appOptions">;
    this.userAppOptions = appOptions;
    this.optionValues = { ...options };
    delete this.optionValues.cols;
    delete this.optionValues.rows;

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

  /** xterm-like option bag (compat-focused subset). */
  get options(): Record<string, unknown> {
    return {
      ...this.optionValues,
      cols: this.cols,
      rows: this.rows,
    };
  }

  set options(next: Record<string, unknown>) {
    this.ensureUsable();
    this.applyOptions(next);
  }

  open(parent: HTMLElement): void {
    this.ensureUsable();
    if (this.opened) {
      throw new Error("xterm compatibility Terminal is already opened");
    }
    this.opened = true;
    this.elementRef = parent;
    this.resttyInstance = createRestty({
      ...this.resttyOptionsBase,
      appOptions: this.createCompatAppOptions(),
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
    this.emitResize(next);
  }

  focus(): void {
    if (this.disposed) return;
    this.resttyInstance?.focus();
  }

  blur(): void {
    if (this.disposed) return;
    this.resttyInstance?.blur();
  }

  clear(): void {
    this.ensureUsable();
    if (this.resttyInstance) {
      this.resttyInstance.clearScreen();
      return;
    }
    this.pendingOutput.length = 0;
  }

  reset(): void {
    this.ensureUsable();
    this.clear();
    if (this.resttyInstance) {
      // ESC c (RIS) is the classic terminal reset control sequence.
      this.resttyInstance.sendInput("\u001bc", "pty");
    }
  }

  onData(listener: (data: string) => void): IDisposable {
    this.ensureUsable();
    return this.addListener(this.dataListeners, listener);
  }

  onResize(listener: (size: TerminalResizeEvent) => void): IDisposable {
    this.ensureUsable();
    return this.addListener(this.resizeListeners, listener);
  }

  setOption(key: string, value: unknown): void {
    this.ensureUsable();
    this.applyOptions({ [key]: value });
  }

  getOption(key: string): unknown {
    if (key === "cols") return this.cols;
    if (key === "rows") return this.rows;
    return this.optionValues[key];
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
    this.dataListeners.clear();
    this.resizeListeners.clear();

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

  private applyOptions(next: Record<string, unknown>): void {
    const hasCols = Object.prototype.hasOwnProperty.call(next, "cols");
    const hasRows = Object.prototype.hasOwnProperty.call(next, "rows");
    if (hasCols || hasRows) {
      const cols = hasCols ? this.normalizeDimension(next.cols as number, this.cols) : this.cols;
      const rows = hasRows ? this.normalizeDimension(next.rows as number, this.rows) : this.rows;
      this.resize(cols, rows);
    }

    const keys = Object.keys(next);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (key === "cols" || key === "rows") continue;
      this.optionValues[key] = next[key];
    }
  }

  private createCompatAppOptions(): ResttyOptions["appOptions"] {
    return (context) => {
      const resolved =
        typeof this.userAppOptions === "function"
          ? this.userAppOptions(context)
          : (this.userAppOptions ?? {});
      const userBeforeInput = resolved.beforeInput;
      return {
        ...resolved,
        beforeInput: ({ text, source }) => {
          const maybeNext = userBeforeInput?.({ text, source });
          if (maybeNext === null) return null;
          const nextText = maybeNext === undefined ? text : maybeNext;
          if (source !== "pty" && nextText) {
            this.emitData(nextText);
          }
          return nextText;
        },
      };
    };
  }

  private emitData(data: string): void {
    const listeners = Array.from(this.dataListeners);
    for (let i = 0; i < listeners.length; i += 1) {
      try {
        listeners[i](data);
      } catch (error) {
        console.error("[restty/xterm] onData listener error:", error);
      }
    }
  }

  private emitResize(size: TerminalResizeEvent): void {
    const listeners = Array.from(this.resizeListeners);
    for (let i = 0; i < listeners.length; i += 1) {
      try {
        listeners[i](size);
      } catch (error) {
        console.error("[restty/xterm] onResize listener error:", error);
      }
    }
  }

  private addListener<T>(
    bucket: Set<(payload: T) => void>,
    listener: (payload: T) => void,
  ): IDisposable {
    bucket.add(listener);
    return {
      dispose: () => {
        bucket.delete(listener);
      },
    };
  }

  private normalizeDimension(value: number | undefined, fallback: number): number {
    if (!Number.isFinite(value) || (value as number) <= 0) return fallback;
    return Math.max(1, Math.trunc(value as number));
  }
}

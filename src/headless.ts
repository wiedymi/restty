import type { CursorInfo, RenderState, ResttyWasm } from "./wasm";
import { loadResttyWasm } from "./wasm";
import { addListener, emitWithGuard } from "./xterm/listeners";
import { normalizeDimension } from "./xterm/dimensions";

export type IDisposable = {
  dispose: () => void;
};

export type TerminalResizeEvent = {
  cols: number;
  rows: number;
};

export type TerminalAddon = {
  activate: (terminal: Terminal) => void;
  dispose: () => void;
};

export type HeadlessTerminalOptions = {
  cols?: number;
  rows?: number;
  maxScrollbackBytes?: number;
};

export type HeadlessTerminalSnapshot = {
  cols: number;
  rows: number;
  cursor: CursorInfo | null;
  historyByteLength: number;
  renderState: RenderState | null;
};

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_MAX_SCROLLBACK_BYTES = 10_000_000;
const HARD_RESET_SEQUENCE = "\u001bc";
const JOURNAL_COMPACT_CHUNK_COUNT = 128;

function decodeInputPayload(
  payload: string | Uint8Array | ArrayBuffer,
  decoder: TextDecoder,
): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload instanceof Uint8Array) {
    return decoder.decode(payload);
  }
  return decoder.decode(new Uint8Array(payload));
}

export class Terminal {
  private readonly addons = new Set<TerminalAddon>();
  private readonly dataListeners = new Set<(data: string) => void>();
  private readonly resizeListeners = new Set<(size: TerminalResizeEvent) => void>();
  private readonly textDecoder = new TextDecoder();
  private readonly textEncoder = new TextEncoder();
  private readonly maxScrollbackBytes: number;
  private readonly startupPromise: Promise<void>;

  private operationQueue: Promise<void> = Promise.resolve();
  private wasm: ResttyWasm | null = null;
  private wasmHandle = 0;
  private disposed = false;
  private lastRenderState: RenderState | null = null;
  private journalChunks: string[] = [];
  private journalByteLength = 0;
  private journalCache = "";
  private journalDirty = false;

  cols: number;
  rows: number;

  constructor(options: HeadlessTerminalOptions = {}) {
    this.cols = normalizeDimension(options.cols, DEFAULT_COLS);
    this.rows = normalizeDimension(options.rows, DEFAULT_ROWS);
    this.maxScrollbackBytes = Number.isFinite(options.maxScrollbackBytes)
      ? Math.max(0, Number(options.maxScrollbackBytes))
      : DEFAULT_MAX_SCROLLBACK_BYTES;
    this.startupPromise = this.initialize();
  }

  public whenReady(): Promise<void> {
    return this.startupPromise;
  }

  public whenIdle(): Promise<void> {
    return this.operationQueue;
  }

  public getSnapshot(): HeadlessTerminalSnapshot {
    return {
      cols: this.cols,
      rows: this.rows,
      cursor: this.lastRenderState?.cursor ?? null,
      historyByteLength: this.journalByteLength,
      renderState: this.lastRenderState,
    };
  }

  public serializeReplay(): string {
    if (!this.journalDirty) {
      return this.journalCache;
    }
    this.journalCache = this.journalChunks.join("");
    this.journalDirty = false;
    return this.journalCache;
  }

  public write(data: string | Uint8Array | ArrayBuffer, callback?: () => void): void {
    const text = decodeInputPayload(data, this.textDecoder);
    if (!text) {
      callback?.();
      return;
    }

    this.appendToJournal(text);
    void this.enqueue(async () => {
      this.writeToWasm(text);
      callback?.();
    });
  }

  public writeln(data = "", callback?: () => void): void {
    this.write(`${data}\r\n`, callback);
  }

  public resize(cols: number, rows: number): void {
    const nextCols = normalizeDimension(cols, this.cols);
    const nextRows = normalizeDimension(rows, this.rows);
    void this.enqueue(async () => {
      this.cols = nextCols;
      this.rows = nextRows;
      if (this.wasm && this.wasmHandle) {
        this.wasm.resize(this.wasmHandle, nextCols, nextRows);
        this.refreshRenderState();
      }
      emitWithGuard(this.resizeListeners, { cols: nextCols, rows: nextRows }, "onResize");
    });
  }

  public clear(): void {
    this.write("\u001b[H\u001b[2J");
  }

  public reset(): void {
    this.resetJournal(HARD_RESET_SEQUENCE);
    void this.enqueue(async () => {
      this.writeToWasm(HARD_RESET_SEQUENCE);
    });
  }

  public onData(listener: (data: string) => void): IDisposable {
    return addListener(this.dataListeners, listener);
  }

  public onResize(listener: (size: TerminalResizeEvent) => void): IDisposable {
    return addListener(this.resizeListeners, listener);
  }

  public loadAddon(addon: TerminalAddon): void {
    this.ensureUsable();
    if (!addon || typeof addon.activate !== "function" || typeof addon.dispose !== "function") {
      throw new Error("headless addon must define activate() and dispose()");
    }
    if (this.addons.has(addon)) {
      return;
    }
    addon.activate(this);
    this.addons.add(addon);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    const addons = Array.from(this.addons);
    this.addons.clear();
    for (let i = 0; i < addons.length; i += 1) {
      try {
        addons[i].dispose();
      } catch {
        // Ignore addon cleanup errors to keep disposal resilient.
      }
    }

    this.dataListeners.clear();
    this.resizeListeners.clear();

    const destroy = async () => {
      await this.startupPromise.catch(() => undefined);
      if (this.wasm && this.wasmHandle) {
        this.wasm.destroy(this.wasmHandle);
        this.wasmHandle = 0;
      }
      this.wasm = null;
      this.lastRenderState = null;
      this.journalChunks = [];
      this.journalCache = "";
      this.journalDirty = false;
      this.journalByteLength = 0;
    };

    this.operationQueue = this.operationQueue.then(destroy, destroy);
  }

  private ensureUsable(): void {
    if (this.disposed) {
      throw new Error("headless Terminal is disposed");
    }
  }

  private async initialize(): Promise<void> {
    const wasm = await loadResttyWasm();
    if (this.disposed) {
      return;
    }
    this.wasm = wasm;
    this.wasmHandle = wasm.create(this.cols, this.rows, this.maxScrollbackBytes);
    this.refreshRenderState();
  }

  private enqueue(run: () => void | Promise<void>): Promise<void> {
    this.ensureUsable();
    const wrapped = async () => {
      await this.startupPromise;
      if (this.disposed) {
        return;
      }
      await run();
    };
    this.operationQueue = this.operationQueue.then(wrapped, wrapped);
    return this.operationQueue;
  }

  private writeToWasm(text: string): void {
    if (!this.wasm || !this.wasmHandle) {
      return;
    }
    this.wasm.write(this.wasmHandle, text);
    this.refreshRenderState();
    this.flushTerminalReplies();
  }

  private refreshRenderState(): void {
    if (!this.wasm || !this.wasmHandle) {
      return;
    }
    this.wasm.renderUpdate(this.wasmHandle);
    this.lastRenderState = this.wasm.getRenderState(this.wasmHandle);
  }

  private flushTerminalReplies(): void {
    if (!this.wasm || !this.wasmHandle) {
      return;
    }
    let iterations = 0;
    while (iterations < 32) {
      const reply = this.wasm.drainOutput(this.wasmHandle);
      if (!reply) {
        break;
      }
      emitWithGuard(this.dataListeners, reply, "onData");
      iterations += 1;
    }
  }

  private appendToJournal(text: string): void {
    const hardResetIndex = text.lastIndexOf(HARD_RESET_SEQUENCE);
    if (hardResetIndex >= 0) {
      this.resetJournal(text.slice(hardResetIndex));
      return;
    }

    this.journalChunks.push(text);
    this.journalByteLength += this.textEncoder.encode(text).length;
    this.journalDirty = true;

    if (this.journalChunks.length >= JOURNAL_COMPACT_CHUNK_COUNT) {
      this.journalChunks = [this.serializeReplay()];
      this.journalDirty = false;
    }
  }

  private resetJournal(text: string): void {
    this.journalChunks = [text];
    this.journalCache = text;
    this.journalDirty = false;
    this.journalByteLength = this.textEncoder.encode(text).length;
  }
}

import type {
  CursorInfo,
  KittyPlacement,
  RenderState,
  ResttyWasmOptions,
  SearchStatus,
  SearchViewportMatch,
} from "./wasm";
import { loadResttyWasm } from "./wasm";
import type { ResttyWasm } from "./wasm";

export type ResttyHeadlessInput = string | ArrayBuffer | ArrayBufferView;

export type ResttyHeadlessReplayOptions = {
  /** Maximum replay journal size in UTF-8 bytes. Default: 10MB. */
  maxBytes?: number;
};

export type ResttyHeadlessReplayWriteEvent = {
  type: "write";
  data: string;
  byteLength: number;
};

export type ResttyHeadlessReplayResizeEvent = {
  type: "resize";
  cols: number;
  rows: number;
};

export type ResttyHeadlessReplayEvent =
  | ResttyHeadlessReplayWriteEvent
  | ResttyHeadlessReplayResizeEvent;

export type ResttyHeadlessTerminalOptions = {
  /** Initial terminal width in columns. Default: 80. */
  cols?: number;
  /** Initial terminal height in rows. Default: 24. */
  rows?: number;
  /** Maximum scrollback buffer size in bytes. Default: 10MB. */
  maxScrollbackBytes?: number;
  /** Initial pixel width used by protocols such as Kitty graphics. */
  pixelWidth?: number;
  /** Initial pixel height used by protocols such as Kitty graphics. */
  pixelHeight?: number;
  /**
   * Replay journal config. Set to false when reconnect replay is not needed.
   * The journal is a bounded input replay stream, not a binary terminal-state snapshot.
   */
  replay?: false | ResttyHeadlessReplayOptions;
  /** Reuse an existing WASM runtime instance. */
  wasm?: ResttyWasm;
  /** WASM loader options used when wasm is not provided. */
  wasmOptions?: ResttyWasmOptions;
};

export type ResttyHeadlessReplay = {
  kind: "restty-headless-replay";
  version: 1;
  initialCols: number;
  initialRows: number;
  cols: number;
  rows: number;
  events: ResttyHeadlessReplayEvent[];
  data: string;
  byteLength: number;
  truncated: boolean;
};

export type ResttyHeadlessSnapshot = RenderState;

export type ResttyHeadlessWriteOptions = {
  recordReplay?: boolean;
};

export type ResttyHeadlessApplyReplayOptions = {
  resize?: boolean;
};

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_MAX_SCROLLBACK_BYTES = 10_000_000;
const MAX_MAX_SCROLLBACK_BYTES = 256_000_000;
const DEFAULT_REPLAY_MAX_BYTES = 10_000_000;
const HARD_RESET_SEQUENCE = "\x1bc";

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const asInt = Math.trunc(Number(value));
  return asInt > 0 ? asInt : fallback;
}

function normalizeMaxBytes(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const asInt = Math.trunc(Number(value));
  if (asInt <= 0) return 0;
  return Math.min(asInt, MAX_MAX_SCROLLBACK_BYTES);
}

function decodeInput(input: ResttyHeadlessInput): string {
  if (typeof input === "string") return input;
  return textDecoder.decode(input);
}

function copyCursor(cursor: CursorInfo | null): CursorInfo | null {
  return cursor ? { ...cursor } : null;
}

function copyRenderState(state: RenderState | null): ResttyHeadlessSnapshot | null {
  if (!state) return null;
  return {
    rows: state.rows,
    cols: state.cols,
    cellCount: state.cellCount,
    codepoints: state.codepoints ? new Uint32Array(state.codepoints) : null,
    contentTags: state.contentTags ? new Uint8Array(state.contentTags) : null,
    wide: state.wide ? new Uint8Array(state.wide) : null,
    cellFlags: state.cellFlags ? new Uint16Array(state.cellFlags) : null,
    styleFlags: state.styleFlags ? new Uint16Array(state.styleFlags) : null,
    linkIds: state.linkIds ? new Uint32Array(state.linkIds) : null,
    fgBytes: state.fgBytes ? new Uint8Array(state.fgBytes) : null,
    bgBytes: state.bgBytes ? new Uint8Array(state.bgBytes) : null,
    ulBytes: state.ulBytes ? new Uint8Array(state.ulBytes) : null,
    ulStyle: state.ulStyle ? new Uint8Array(state.ulStyle) : null,
    linkOffsets: state.linkOffsets ? new Uint32Array(state.linkOffsets) : null,
    linkLengths: state.linkLengths ? new Uint32Array(state.linkLengths) : null,
    linkBuffer: state.linkBuffer ? new Uint8Array(state.linkBuffer) : null,
    graphemeOffset: state.graphemeOffset ? new Uint32Array(state.graphemeOffset) : null,
    graphemeLen: state.graphemeLen ? new Uint32Array(state.graphemeLen) : null,
    graphemeBuffer: state.graphemeBuffer ? new Uint32Array(state.graphemeBuffer) : null,
    selectionStart: state.selectionStart ? new Int16Array(state.selectionStart) : null,
    selectionEnd: state.selectionEnd ? new Int16Array(state.selectionEnd) : null,
    cursor: copyCursor(state.cursor),
  };
}

export class ResttyHeadlessTerminal {
  readonly wasm: ResttyWasm;

  private wasmHandle: number;
  private replayEnabled: boolean;
  private replayMaxBytes: number;
  private replayEvents: ResttyHeadlessReplayEvent[] = [];
  private replayByteLength = 0;
  private replayTruncated = false;
  private replayStartCols: number;
  private replayStartRows: number;
  private disposed = false;

  cols: number;
  rows: number;

  constructor(wasm: ResttyWasm, options: ResttyHeadlessTerminalOptions = {}) {
    this.wasm = wasm;
    this.cols = normalizePositiveInt(options.cols, DEFAULT_COLS);
    this.rows = normalizePositiveInt(options.rows, DEFAULT_ROWS);
    const maxScrollbackBytes = normalizeMaxBytes(
      options.maxScrollbackBytes,
      DEFAULT_MAX_SCROLLBACK_BYTES,
    );
    const replayOptions = options.replay === false ? null : (options.replay ?? {});
    this.replayEnabled = !!replayOptions;
    this.replayMaxBytes = replayOptions
      ? normalizeMaxBytes(replayOptions.maxBytes, DEFAULT_REPLAY_MAX_BYTES)
      : 0;
    if (this.replayMaxBytes <= 0) {
      this.replayEnabled = false;
    }
    this.wasmHandle = this.wasm.create(this.cols, this.rows, maxScrollbackBytes);
    if (!this.wasmHandle) {
      throw new Error("restty headless create failed (restty_create returned 0)");
    }
    this.replayStartCols = this.cols;
    this.replayStartRows = this.rows;
    if (options.pixelWidth !== undefined || options.pixelHeight !== undefined) {
      this.setPixelSize(options.pixelWidth ?? 0, options.pixelHeight ?? 0);
    }
    this.renderUpdate();
  }

  get handle(): number {
    return this.wasmHandle;
  }

  write(input: ResttyHeadlessInput, options: ResttyHeadlessWriteOptions = {}): void {
    this.assertUsable();
    const text = decodeInput(input);
    if (!text) return;
    if (options.recordReplay !== false) {
      this.appendReplay(text);
    }
    this.wasm.write(this.wasmHandle, text);
    this.renderUpdate();
  }

  writeln(input: ResttyHeadlessInput = ""): void {
    this.write(`${decodeInput(input)}\r\n`);
  }

  resize(cols: number, rows: number): void {
    this.applyResize(cols, rows);
  }

  private applyResize(cols: number, rows: number, options: ResttyHeadlessWriteOptions = {}): void {
    this.assertUsable();
    const previousCols = this.cols;
    const previousRows = this.rows;
    this.cols = normalizePositiveInt(cols, this.cols);
    this.rows = normalizePositiveInt(rows, this.rows);
    this.wasm.resize(this.wasmHandle, this.cols, this.rows);
    if (
      options.recordReplay !== false &&
      (this.cols !== previousCols || this.rows !== previousRows)
    ) {
      this.appendReplayResize(this.cols, this.rows);
    }
    this.renderUpdate();
  }

  setPixelSize(widthPx: number, heightPx: number): void {
    this.assertUsable();
    this.wasm.setPixelSize(
      this.wasmHandle,
      Math.max(0, Math.trunc(Number(widthPx) || 0)),
      Math.max(0, Math.trunc(Number(heightPx) || 0)),
    );
  }

  renderUpdate(): void {
    this.assertUsable();
    this.wasm.renderUpdate(this.wasmHandle);
  }

  getRenderState(): RenderState | null {
    this.assertUsable();
    return this.wasm.getRenderState(this.wasmHandle);
  }

  snapshot(): ResttyHeadlessSnapshot | null {
    return copyRenderState(this.getRenderState());
  }

  drainOutput(): string {
    this.assertUsable();
    return this.wasm.drainOutput(this.wasmHandle);
  }

  getKittyKeyboardFlags(): number {
    this.assertUsable();
    return this.wasm.getKittyKeyboardFlags(this.wasmHandle);
  }

  getKittyPlacements(): KittyPlacement[] {
    this.assertUsable();
    return this.wasm.getKittyPlacements(this.wasmHandle);
  }

  scrollViewport(delta: number): void {
    this.assertUsable();
    this.wasm.scrollViewport(this.wasmHandle, Math.trunc(delta));
    this.renderUpdate();
  }

  setSearchQuery(query: string): void {
    this.assertUsable();
    this.wasm.setSearchQuery(this.wasmHandle, query);
  }

  clearSearch(): void {
    this.assertUsable();
    this.wasm.clearSearch(this.wasmHandle);
    this.renderUpdate();
  }

  stepSearch(budget = 1000): void {
    this.assertUsable();
    this.wasm.stepSearch(this.wasmHandle, budget);
  }

  searchNext(): void {
    this.assertUsable();
    this.wasm.searchNext(this.wasmHandle);
    this.renderUpdate();
  }

  searchPrevious(): void {
    this.assertUsable();
    this.wasm.searchPrevious(this.wasmHandle);
    this.renderUpdate();
  }

  getSearchStatus(): SearchStatus {
    this.assertUsable();
    return this.wasm.getSearchStatus(this.wasmHandle);
  }

  getSearchViewportMatches(): SearchViewportMatch[] {
    this.assertUsable();
    return this.wasm.getSearchViewportMatches(this.wasmHandle);
  }

  createReplay(): ResttyHeadlessReplay {
    this.assertUsable();
    const events = this.replayEvents.map((event) => ({ ...event }));
    const data = events
      .filter((event): event is ResttyHeadlessReplayWriteEvent => event.type === "write")
      .map((event) => event.data)
      .join("");
    return {
      kind: "restty-headless-replay",
      version: 1,
      initialCols: this.replayStartCols,
      initialRows: this.replayStartRows,
      cols: this.cols,
      rows: this.rows,
      events,
      data,
      byteLength: this.replayByteLength,
      truncated: this.replayTruncated,
    };
  }

  applyReplay(
    replay: ResttyHeadlessReplay | string,
    options: ResttyHeadlessApplyReplayOptions = {},
  ): void {
    this.assertUsable();
    if (typeof replay === "string") {
      if (replay) {
        this.write(replay, { recordReplay: false });
      }
      this.replaceReplay(replay, false);
      return;
    }

    const shouldResize = options.resize !== false;
    const events = replay.events?.length
      ? replay.events
      : ([
          {
            type: "write",
            data: replay.data,
            byteLength: replay.byteLength,
          },
        ] satisfies ResttyHeadlessReplayEvent[]);

    if (shouldResize) {
      this.applyResize(replay.initialCols ?? replay.cols, replay.initialRows ?? replay.rows, {
        recordReplay: false,
      });
    }
    for (const event of events) {
      if (event.type === "resize") {
        if (shouldResize) {
          this.applyResize(event.cols, event.rows, { recordReplay: false });
        }
        continue;
      }
      if (event.data) {
        this.write(event.data, { recordReplay: false });
      }
    }
    if (shouldResize && (this.cols !== replay.cols || this.rows !== replay.rows)) {
      this.applyResize(replay.cols, replay.rows, { recordReplay: false });
    }
    this.replaceReplay(replay);
  }

  clearReplay(): void {
    this.replayEvents = [];
    this.replayByteLength = 0;
    this.replayTruncated = false;
    this.replayStartCols = this.cols;
    this.replayStartRows = this.rows;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.wasmHandle) {
      this.wasm.destroy(this.wasmHandle);
      this.wasmHandle = 0;
    }
    this.clearReplay();
  }

  private appendReplay(text: string): void {
    if (!this.replayEnabled || !text) return;
    const hardResetIndex = text.lastIndexOf(HARD_RESET_SEQUENCE);
    const replayText = hardResetIndex >= 0 ? text.slice(hardResetIndex) : text;
    if (hardResetIndex >= 0) {
      this.clearReplay();
    }
    const byteLength = textEncoder.encode(replayText).byteLength;
    if (byteLength > this.replayMaxBytes) {
      this.clearReplay();
      this.replayTruncated = true;
      return;
    }
    while (
      this.replayEvents.length > 0 &&
      this.replayByteLength + byteLength > this.replayMaxBytes
    ) {
      const removed = this.replayEvents.shift();
      if (removed?.type === "write") {
        this.replayByteLength -= removed.byteLength;
      }
      this.replayTruncated = true;
    }
    this.replayEvents.push({ type: "write", data: replayText, byteLength });
    this.replayByteLength += byteLength;
  }

  private appendReplayResize(cols: number, rows: number): void {
    if (!this.replayEnabled) return;
    const previous = this.replayEvents.at(-1);
    if (previous?.type === "resize") {
      previous.cols = cols;
      previous.rows = rows;
      return;
    }
    this.replayEvents.push({ type: "resize", cols, rows });
  }

  private replaceReplay(replay: ResttyHeadlessReplay | string, truncated = false): void {
    if (!this.replayEnabled) return;
    if (typeof replay !== "string") {
      const events = replay.events?.length
        ? replay.events
        : ([
            {
              type: "write",
              data: replay.data,
              byteLength: replay.byteLength,
            },
          ] satisfies ResttyHeadlessReplayEvent[]);
      this.replayStartCols = replay.initialCols ?? replay.cols;
      this.replayStartRows = replay.initialRows ?? replay.rows;
      this.replayEvents = events.map((event) => ({ ...event }));
      this.replayByteLength = this.replayEvents.reduce(
        (sum, event) => sum + (event.type === "write" ? event.byteLength : 0),
        0,
      );
      this.replayTruncated = replay.truncated || this.replayByteLength > this.replayMaxBytes;
      if (this.replayByteLength <= this.replayMaxBytes) return;
      this.replayEvents = [];
      this.replayByteLength = 0;
      return;
    }

    this.clearReplay();
    this.replayTruncated = truncated;
    if (!replay) return;
    const byteLength = textEncoder.encode(replay).byteLength;
    if (byteLength > this.replayMaxBytes) {
      this.replayTruncated = true;
      return;
    }
    this.replayEvents = [{ type: "write", data: replay, byteLength }];
    this.replayByteLength = byteLength;
  }

  private assertUsable(): void {
    if (this.disposed || !this.wasmHandle) {
      throw new Error("ResttyHeadlessTerminal is disposed");
    }
  }
}

export async function createHeadlessTerminal(
  options: ResttyHeadlessTerminalOptions = {},
): Promise<ResttyHeadlessTerminal> {
  const wasm = options.wasm ?? (await loadResttyWasm(options.wasmOptions));
  return new ResttyHeadlessTerminal(wasm, options);
}

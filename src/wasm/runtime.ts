import { WASM_BASE64 } from "./embedded";

export type WasmAbiKind = "info" | "render" | "cells";

export type WasmAbi = {
  kind: WasmAbiKind;
};

export type CursorInfo = {
  row: number;
  col: number;
  visible: number;
  style: number;
  blinking: number;
  wideTail: number;
  color: number;
};

export type KittyPlacement = {
  imageId: number;
  imageFormat: number;
  imageWidth: number;
  imageHeight: number;
  imageDataPtr: number;
  imageDataLen: number;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  cellOffsetX: number;
  cellOffsetY: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
};

export type RenderState = {
  rows: number;
  cols: number;
  cellCount: number;
  codepoints: Uint32Array | null;
  contentTags: Uint8Array | null;
  wide: Uint8Array | null;
  cellFlags: Uint16Array | null;
  styleFlags: Uint16Array | null;
  linkIds: Uint32Array | null;
  fgBytes: Uint8Array | null;
  bgBytes: Uint8Array | null;
  ulBytes: Uint8Array | null;
  ulStyle: Uint8Array | null;
  linkOffsets: Uint32Array | null;
  linkLengths: Uint32Array | null;
  linkBuffer: Uint8Array | null;
  graphemeOffset: Uint32Array | null;
  graphemeLen: Uint32Array | null;
  graphemeBuffer: Uint32Array | null;
  selectionStart: Int16Array | null;
  selectionEnd: Int16Array | null;
  cursor: CursorInfo | null;
};

export type ResttyWasmExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  restty_create: (cols: number, rows: number, maxScrollback: number) => number;
  restty_destroy: (handle: number) => void;
  restty_write: (handle: number, ptr: number, len: number) => void;
  restty_resize: (handle: number, cols: number, rows: number) => void;
  restty_set_pixel_size?: (handle: number, widthPx: number, heightPx: number) => number;
  restty_render_update: (handle: number) => void;
  restty_alloc: (len: number) => number;
  restty_free: (ptr: number, len: number) => void;
  restty_set_default_colors?: (handle: number, fg: number, bg: number, cursor: number) => number;
  restty_set_palette?: (handle: number, ptr: number, len: number) => number;
  restty_reset_palette?: (handle: number) => number;
  restty_scroll_viewport?: (handle: number, delta: number) => number;
  restty_scrollbar_total?: (handle: number) => number;
  restty_scrollbar_offset?: (handle: number) => number;
  restty_scrollbar_len?: (handle: number) => number;
  restty_render_info?: (handle: number) => number;
  restty_render_rows?: (handle: number) => number;
  restty_render_cols?: (handle: number) => number;
  restty_render_codepoints_ptr?: (handle: number) => number;
  restty_render_fg_rgba_ptr?: (handle: number) => number;
  restty_render_bg_rgba_ptr?: (handle: number) => number;
  restty_render_ul_rgba_ptr?: (handle: number) => number;
  restty_render_ul_style_ptr?: (handle: number) => number;
  restty_render_grapheme_offset_ptr?: (handle: number) => number;
  restty_render_grapheme_len_ptr?: (handle: number) => number;
  restty_render_grapheme_buffer_ptr?: (handle: number) => number;
  restty_render_grapheme_buffer_len?: (handle: number) => number;
  restty_render_selection_start_ptr?: (handle: number) => number;
  restty_render_selection_end_ptr?: (handle: number) => number;
  restty_render_cursor_ptr?: (handle: number) => number;
  restty_rows?: (handle: number) => number;
  restty_cols?: (handle: number) => number;
  restty_cell_codepoints_ptr?: (handle: number) => number;
  restty_cell_content_tags_ptr?: (handle: number) => number;
  restty_cell_wide_ptr?: (handle: number) => number;
  restty_cell_flags_ptr?: (handle: number) => number;
  restty_cell_style_flags_ptr?: (handle: number) => number;
  restty_cell_link_ids_ptr?: (handle: number) => number;
  restty_cell_fg_rgba_ptr?: (handle: number) => number;
  restty_cell_bg_rgba_ptr?: (handle: number) => number;
  restty_cell_ul_rgba_ptr?: (handle: number) => number;
  restty_cell_underline_styles_ptr?: (handle: number) => number;
  restty_cell_grapheme_offsets_ptr?: (handle: number) => number;
  restty_cell_grapheme_lengths_ptr?: (handle: number) => number;
  restty_grapheme_buffer_ptr?: (handle: number) => number;
  restty_grapheme_buffer_len?: (handle: number) => number;
  restty_row_selection_start_ptr?: (handle: number) => number;
  restty_row_selection_end_ptr?: (handle: number) => number;
  restty_cursor_info_ptr?: (handle: number) => number;
  restty_link_offsets_ptr?: (handle: number) => number;
  restty_link_lengths_ptr?: (handle: number) => number;
  restty_link_buffer_ptr?: (handle: number) => number;
  restty_link_count?: (handle: number) => number;
  restty_link_buffer_len?: (handle: number) => number;
  restty_debug_cursor_x?: (handle: number) => number;
  restty_debug_cursor_y?: (handle: number) => number;
  restty_debug_scroll_left?: (handle: number) => number;
  restty_debug_scroll_right?: (handle: number) => number;
  restty_debug_term_cols?: (handle: number) => number;
  restty_debug_term_rows?: (handle: number) => number;
  restty_debug_page_cols?: (handle: number) => number;
  restty_debug_page_rows?: (handle: number) => number;
  restty_output_ptr?: (handle: number) => number;
  restty_output_len?: (handle: number) => number;
  restty_output_consume?: (handle: number, len: number) => number;
  restty_kitty_keyboard_flags?: (handle: number) => number;
  restty_kitty_placement_stride?: () => number;
  restty_kitty_placement_count?: (handle: number) => number;
  restty_kitty_placements_ptr?: (handle: number) => number;
};

export type ResttyWasmOptions = {
  log?: (message: string) => void;
};

type RenderPtrs = {
  rows: number;
  cols: number;
  codepointsPtr: number;
  contentTagsPtr: number;
  widePtr: number;
  flagsPtr: number;
  styleFlagsPtr: number;
  linkIdsPtr: number;
  fgPtr: number;
  bgPtr: number;
  ulPtr: number;
  ulStylePtr: number;
  graphemeOffsetPtr: number;
  graphemeLenPtr: number;
  graphemeBufferPtr: number;
  graphemeBufferLen: number;
  selectionStartPtr: number;
  selectionEndPtr: number;
  cursorPtr: number;
};

type ViewEntry<T extends ArrayBufferView> = {
  buffer: ArrayBufferLike | null;
  ptr: number;
  len: number;
  view: T | null;
};

type RenderViewCache = {
  codepoints: ViewEntry<Uint32Array>;
  contentTags: ViewEntry<Uint8Array>;
  wide: ViewEntry<Uint8Array>;
  cellFlags: ViewEntry<Uint16Array>;
  styleFlags: ViewEntry<Uint16Array>;
  linkIds: ViewEntry<Uint32Array>;
  fgBytes: ViewEntry<Uint8Array>;
  bgBytes: ViewEntry<Uint8Array>;
  ulBytes: ViewEntry<Uint8Array>;
  ulStyle: ViewEntry<Uint8Array>;
  linkOffsets: ViewEntry<Uint32Array>;
  linkLengths: ViewEntry<Uint32Array>;
  linkBuffer: ViewEntry<Uint8Array>;
  graphemeOffset: ViewEntry<Uint32Array>;
  graphemeLen: ViewEntry<Uint32Array>;
  graphemeBuffer: ViewEntry<Uint32Array>;
  selectionStart: ViewEntry<Int16Array>;
  selectionEnd: ViewEntry<Int16Array>;
};

type TypedArrayCtor<T extends ArrayBufferView> = new (
  buffer: ArrayBufferLike,
  byteOffset: number,
  length: number,
) => T;

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function makeViewEntry<T extends ArrayBufferView>(): ViewEntry<T> {
  return { buffer: null, ptr: 0, len: 0, view: null };
}

function makeRenderViewCache(): RenderViewCache {
  return {
    codepoints: makeViewEntry<Uint32Array>(),
    contentTags: makeViewEntry<Uint8Array>(),
    wide: makeViewEntry<Uint8Array>(),
    cellFlags: makeViewEntry<Uint16Array>(),
    styleFlags: makeViewEntry<Uint16Array>(),
    linkIds: makeViewEntry<Uint32Array>(),
    fgBytes: makeViewEntry<Uint8Array>(),
    bgBytes: makeViewEntry<Uint8Array>(),
    ulBytes: makeViewEntry<Uint8Array>(),
    ulStyle: makeViewEntry<Uint8Array>(),
    linkOffsets: makeViewEntry<Uint32Array>(),
    linkLengths: makeViewEntry<Uint32Array>(),
    linkBuffer: makeViewEntry<Uint8Array>(),
    graphemeOffset: makeViewEntry<Uint32Array>(),
    graphemeLen: makeViewEntry<Uint32Array>(),
    graphemeBuffer: makeViewEntry<Uint32Array>(),
    selectionStart: makeViewEntry<Int16Array>(),
    selectionEnd: makeViewEntry<Int16Array>(),
  };
}

function getCachedView<T extends ArrayBufferView>(
  entry: ViewEntry<T>,
  buffer: ArrayBufferLike,
  ptr: number,
  len: number,
  Ctor: TypedArrayCtor<T>,
): T | null {
  if (!ptr || len <= 0) {
    entry.buffer = buffer;
    entry.ptr = 0;
    entry.len = 0;
    entry.view = null;
    return null;
  }
  if (entry.view && entry.buffer === buffer && entry.ptr === ptr && entry.len === len) {
    return entry.view;
  }
  const view = new Ctor(buffer, ptr, len);
  entry.buffer = buffer;
  entry.ptr = ptr;
  entry.len = len;
  entry.view = view;
  return view;
}

function decodeBase64(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s+/g, "");
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
  throw new Error("No base64 decoder available in this environment.");
}

function resolveWasmAbi(exports: ResttyWasmExports): WasmAbi | null {
  if (exports.restty_render_info) {
    return { kind: "info" };
  }
  if (exports.restty_render_codepoints_ptr) {
    return { kind: "render" };
  }
  if (exports.restty_cell_codepoints_ptr) {
    return { kind: "cells" };
  }
  return null;
}

function ptrFromOffset(base: number, offset: number, memSize: number): number {
  if (!offset) return 0;
  const absolute = base + offset;
  if (absolute > 0 && absolute < memSize) return absolute;
  if (offset > 0 && offset < memSize) return offset;
  return 0;
}

function unpackCursor(buffer: ArrayBufferLike, ptr: number): CursorInfo | null {
  if (!ptr) return null;
  const view = new DataView(buffer, ptr, 16);
  return {
    row: view.getUint16(0, true),
    col: view.getUint16(2, true),
    visible: view.getUint8(4),
    style: view.getUint8(5),
    blinking: view.getUint8(6),
    wideTail: view.getUint8(7),
    color: view.getUint32(8, true),
  };
}

function readRenderInfo(exports: ResttyWasmExports, handle: number): RenderPtrs | null {
  if (!exports.restty_render_info) return null;
  const base = exports.restty_render_info(handle);
  if (!base) return null;
  const mem = exports.memory;
  const view = new DataView(mem.buffer, base, 64);
  const version = view.getUint32(0, true);
  if (version !== 1) {
    return null;
  }
  const rows = view.getUint16(4, true);
  const cols = view.getUint16(6, true);
  const memSize = mem.buffer.byteLength;
  const codepointsPtr = ptrFromOffset(base, view.getUint32(8, true), memSize);
  const fgPtr = ptrFromOffset(base, view.getUint32(12, true), memSize);
  const bgPtr = ptrFromOffset(base, view.getUint32(16, true), memSize);
  const ulPtr = ptrFromOffset(base, view.getUint32(20, true), memSize);
  const ulStylePtr = ptrFromOffset(base, view.getUint32(24, true), memSize);
  const graphemeOffsetPtr = ptrFromOffset(base, view.getUint32(28, true), memSize);
  const graphemeLenPtr = ptrFromOffset(base, view.getUint32(32, true), memSize);
  const graphemeBufferPtr = ptrFromOffset(base, view.getUint32(36, true), memSize);
  const graphemeBufferLen = view.getUint32(40, true);
  const selectionStartPtr = ptrFromOffset(base, view.getUint32(44, true), memSize);
  const selectionEndPtr = ptrFromOffset(base, view.getUint32(48, true), memSize);
  const cursorPtr = ptrFromOffset(base, view.getUint32(52, true), memSize);

  return {
    rows,
    cols,
    codepointsPtr,
    contentTagsPtr: 0,
    fgPtr,
    bgPtr,
    ulPtr,
    ulStylePtr,
    widePtr: 0,
    flagsPtr: 0,
    styleFlagsPtr: 0,
    linkIdsPtr: 0,
    graphemeOffsetPtr,
    graphemeLenPtr,
    graphemeBufferPtr,
    graphemeBufferLen,
    selectionStartPtr,
    selectionEndPtr,
    cursorPtr,
  };
}

function readRenderPtrs(exports: ResttyWasmExports, handle: number): RenderPtrs {
  const rows = exports.restty_render_rows
    ? exports.restty_render_rows(handle)
    : exports.restty_rows!(handle);
  const cols = exports.restty_render_cols
    ? exports.restty_render_cols(handle)
    : exports.restty_cols!(handle);
  return {
    rows,
    cols,
    codepointsPtr: exports.restty_render_codepoints_ptr!(handle),
    contentTagsPtr: 0,
    widePtr: 0,
    flagsPtr: 0,
    styleFlagsPtr: 0,
    linkIdsPtr: 0,
    fgPtr: exports.restty_render_fg_rgba_ptr!(handle),
    bgPtr: exports.restty_render_bg_rgba_ptr!(handle),
    ulPtr: exports.restty_render_ul_rgba_ptr!(handle),
    ulStylePtr: exports.restty_render_ul_style_ptr!(handle),
    graphemeOffsetPtr: exports.restty_render_grapheme_offset_ptr!(handle),
    graphemeLenPtr: exports.restty_render_grapheme_len_ptr!(handle),
    graphemeBufferPtr: exports.restty_render_grapheme_buffer_ptr!(handle),
    graphemeBufferLen: exports.restty_render_grapheme_buffer_len
      ? exports.restty_render_grapheme_buffer_len(handle)
      : 0,
    selectionStartPtr: exports.restty_render_selection_start_ptr!(handle),
    selectionEndPtr: exports.restty_render_selection_end_ptr!(handle),
    cursorPtr: exports.restty_render_cursor_ptr!(handle),
  };
}

function readCellPtrs(exports: ResttyWasmExports, handle: number): RenderPtrs {
  const rows = exports.restty_rows!(handle);
  const cols = exports.restty_cols!(handle);
  return {
    rows,
    cols,
    codepointsPtr: exports.restty_cell_codepoints_ptr!(handle),
    contentTagsPtr: exports.restty_cell_content_tags_ptr
      ? exports.restty_cell_content_tags_ptr(handle)
      : 0,
    widePtr: exports.restty_cell_wide_ptr ? exports.restty_cell_wide_ptr(handle) : 0,
    flagsPtr: exports.restty_cell_flags_ptr ? exports.restty_cell_flags_ptr(handle) : 0,
    styleFlagsPtr: exports.restty_cell_style_flags_ptr
      ? exports.restty_cell_style_flags_ptr(handle)
      : 0,
    linkIdsPtr: exports.restty_cell_link_ids_ptr ? exports.restty_cell_link_ids_ptr(handle) : 0,
    fgPtr: exports.restty_cell_fg_rgba_ptr!(handle),
    bgPtr: exports.restty_cell_bg_rgba_ptr!(handle),
    ulPtr: exports.restty_cell_ul_rgba_ptr!(handle),
    ulStylePtr: exports.restty_cell_underline_styles_ptr!(handle),
    graphemeOffsetPtr: exports.restty_cell_grapheme_offsets_ptr!(handle),
    graphemeLenPtr: exports.restty_cell_grapheme_lengths_ptr!(handle),
    graphemeBufferPtr: exports.restty_grapheme_buffer_ptr!(handle),
    graphemeBufferLen: exports.restty_grapheme_buffer_len!(handle),
    selectionStartPtr: exports.restty_row_selection_start_ptr!(handle),
    selectionEndPtr: exports.restty_row_selection_end_ptr!(handle),
    cursorPtr: exports.restty_cursor_info_ptr!(handle),
  };
}

export class ResttyWasm {
  readonly exports: ResttyWasmExports;
  readonly abi: WasmAbi;
  readonly memory: WebAssembly.Memory;
  private readonly renderViewCaches: Map<number, RenderViewCache>;

  private constructor(exports: ResttyWasmExports, abi: WasmAbi) {
    this.exports = exports;
    this.abi = abi;
    this.memory = exports.memory;
    this.renderViewCaches = new Map();
  }

  static async load(options: ResttyWasmOptions = {}): Promise<ResttyWasm> {
    const bytes = decodeBase64(WASM_BASE64);
    let memory: WebAssembly.Memory | null = null;
    const log = options.log;

    const imports = {
      env: {
        log: (ptr: number, len: number) => {
          if (!memory || !ptr || !len) return;
          const view = new Uint8Array(memory.buffer, ptr, len);
          const text = textDecoder.decode(view);
          if (log) log(text);
        },
      },
    };

    const { instance } = await WebAssembly.instantiate(bytes, imports);
    const exports = instance.exports as ResttyWasmExports;
    memory = exports.memory ?? null;

    const required = [
      "memory",
      "restty_create",
      "restty_destroy",
      "restty_write",
      "restty_resize",
      "restty_render_update",
      "restty_alloc",
      "restty_free",
    ];

    for (const name of required) {
      if (!(name in exports)) {
        throw new Error(`missing WASM export: ${name}`);
      }
    }

    const abi = resolveWasmAbi(exports);
    if (!abi) {
      throw new Error("missing render ABI exports");
    }

    return new ResttyWasm(exports, abi);
  }

  create(cols: number, rows: number, maxScrollback: number): number {
    return this.exports.restty_create(cols, rows, maxScrollback);
  }

  destroy(handle: number): void {
    this.renderViewCaches.delete(handle);
    this.exports.restty_destroy(handle);
  }

  private getRenderViewCache(handle: number): RenderViewCache {
    let cache = this.renderViewCaches.get(handle);
    if (!cache) {
      cache = makeRenderViewCache();
      this.renderViewCaches.set(handle, cache);
    }
    return cache;
  }

  resize(handle: number, cols: number, rows: number): void {
    this.exports.restty_resize(handle, cols, rows);
  }

  setPixelSize(handle: number, widthPx: number, heightPx: number): void {
    if (!this.exports.restty_set_pixel_size) return;
    this.exports.restty_set_pixel_size(handle, widthPx, heightPx);
  }

  renderUpdate(handle: number): void {
    this.exports.restty_render_update(handle);
  }

  scrollViewport(handle: number, delta: number): void {
    if (!this.exports.restty_scroll_viewport) return;
    this.exports.restty_scroll_viewport(handle, delta);
  }

  drainOutput(handle: number): string {
    if (!this.exports.restty_output_ptr || !this.exports.restty_output_len) return "";
    const len = this.exports.restty_output_len(handle);
    if (!len) return "";
    const ptr = this.exports.restty_output_ptr(handle);
    if (!ptr) return "";
    const bytes = new Uint8Array(this.memory.buffer, ptr, len);
    const copy = new Uint8Array(len);
    copy.set(bytes);
    if (this.exports.restty_output_consume) {
      this.exports.restty_output_consume(handle, len);
    }
    return textDecoder.decode(copy);
  }

  getKittyKeyboardFlags(handle: number): number {
    if (!this.exports.restty_kitty_keyboard_flags) return 0;
    return this.exports.restty_kitty_keyboard_flags(handle) >>> 0;
  }

  getKittyPlacements(handle: number): KittyPlacement[] {
    if (!this.exports.restty_kitty_placement_count || !this.exports.restty_kitty_placements_ptr) {
      return [];
    }
    const count = this.exports.restty_kitty_placement_count(handle) >>> 0;
    if (!count) return [];
    const ptr = this.exports.restty_kitty_placements_ptr(handle) >>> 0;
    if (!ptr) return [];
    const stride = this.exports.restty_kitty_placement_stride
      ? this.exports.restty_kitty_placement_stride() >>> 0
      : 68;
    if (!stride) return [];

    const view = new DataView(this.memory.buffer, ptr, count * stride);
    // eslint-disable-next-line unicorn/no-new-array
    const placements: KittyPlacement[] = new Array(count);
    for (let i = 0; i < count; i += 1) {
      const base = i * stride;
      placements[i] = {
        imageId: view.getUint32(base + 0, true),
        imageFormat: view.getUint8(base + 4),
        imageWidth: view.getUint32(base + 8, true),
        imageHeight: view.getUint32(base + 12, true),
        imageDataPtr: view.getUint32(base + 16, true),
        imageDataLen: view.getUint32(base + 20, true),
        x: view.getInt32(base + 24, true),
        y: view.getInt32(base + 28, true),
        z: view.getInt32(base + 32, true),
        width: view.getUint32(base + 36, true),
        height: view.getUint32(base + 40, true),
        cellOffsetX: view.getUint32(base + 44, true),
        cellOffsetY: view.getUint32(base + 48, true),
        sourceX: view.getUint32(base + 52, true),
        sourceY: view.getUint32(base + 56, true),
        sourceWidth: view.getUint32(base + 60, true),
        sourceHeight: view.getUint32(base + 64, true),
      };
    }
    return placements;
  }

  write(handle: number, text: string): void {
    if (!text) return;
    const bytes = textEncoder.encode(text);
    const ptr = this.exports.restty_alloc(bytes.length);
    if (!ptr) return;
    const view = new Uint8Array(this.memory.buffer, ptr, bytes.length);
    view.set(bytes);
    this.exports.restty_write(handle, ptr, bytes.length);
    this.exports.restty_free(ptr, bytes.length);
  }

  setDefaultColors(handle: number, fg: number, bg: number, cursor: number): void {
    if (!this.exports.restty_set_default_colors) return;
    this.exports.restty_set_default_colors(handle, fg, bg, cursor);
  }

  setPalette(handle: number, colors: Uint8Array, count: number): void {
    if (!this.exports.restty_set_palette) return;
    if (count <= 0 || colors.length < count * 3) return;
    const byteLen = count * 3;
    const ptr = this.exports.restty_alloc(byteLen);
    if (!ptr) return;
    const view = new Uint8Array(this.memory.buffer, ptr, byteLen);
    view.set(colors.subarray(0, byteLen));
    this.exports.restty_set_palette(handle, ptr, count);
    this.exports.restty_free(ptr, byteLen);
  }

  resetPalette(handle: number): void {
    if (!this.exports.restty_reset_palette) return;
    this.exports.restty_reset_palette(handle);
  }

  getRenderState(handle: number): RenderState | null {
    const info =
      this.abi.kind === "info"
        ? readRenderInfo(this.exports, handle)
        : this.abi.kind === "render"
          ? readRenderPtrs(this.exports, handle)
          : readCellPtrs(this.exports, handle);

    if (!info) return null;
    const { rows, cols } = info;
    if (!rows || !cols) return null;

    const cellCount = rows * cols;
    const mem = this.memory;
    const cache = this.getRenderViewCache(handle);
    const buffer = mem.buffer;
    const codepoints = getCachedView(
      cache.codepoints,
      buffer,
      info.codepointsPtr,
      cellCount,
      Uint32Array,
    );
    const contentTags = getCachedView(
      cache.contentTags,
      buffer,
      info.contentTagsPtr,
      cellCount,
      Uint8Array,
    );
    const wide = getCachedView(cache.wide, buffer, info.widePtr, cellCount, Uint8Array);
    const cellFlags = getCachedView(cache.cellFlags, buffer, info.flagsPtr, cellCount, Uint16Array);
    const styleFlags = getCachedView(
      cache.styleFlags,
      buffer,
      info.styleFlagsPtr,
      cellCount,
      Uint16Array,
    );
    const linkIds = getCachedView(cache.linkIds, buffer, info.linkIdsPtr, cellCount, Uint32Array);
    const fgBytes = getCachedView(cache.fgBytes, buffer, info.fgPtr, cellCount * 4, Uint8Array);
    const bgBytes = getCachedView(cache.bgBytes, buffer, info.bgPtr, cellCount * 4, Uint8Array);
    const ulBytes = getCachedView(cache.ulBytes, buffer, info.ulPtr, cellCount * 4, Uint8Array);
    const ulStyle = getCachedView(cache.ulStyle, buffer, info.ulStylePtr, cellCount, Uint8Array);
    const linkCount = this.exports.restty_link_count ? this.exports.restty_link_count(handle) : 0;
    const linkOffsetsPtr =
      linkCount && this.exports.restty_link_offsets_ptr
        ? this.exports.restty_link_offsets_ptr(handle)
        : 0;
    const linkLengthsPtr =
      linkCount && this.exports.restty_link_lengths_ptr
        ? this.exports.restty_link_lengths_ptr(handle)
        : 0;
    const linkOffsets = getCachedView(
      cache.linkOffsets,
      buffer,
      linkOffsetsPtr,
      linkCount,
      Uint32Array,
    );
    const linkLengths = getCachedView(
      cache.linkLengths,
      buffer,
      linkLengthsPtr,
      linkCount,
      Uint32Array,
    );
    const linkBufferLen = this.exports.restty_link_buffer_len
      ? this.exports.restty_link_buffer_len(handle)
      : 0;
    const linkBufferPtr =
      linkBufferLen && this.exports.restty_link_buffer_ptr
        ? this.exports.restty_link_buffer_ptr(handle)
        : 0;
    const linkBuffer = getCachedView(
      cache.linkBuffer,
      buffer,
      linkBufferPtr,
      linkBufferLen,
      Uint8Array,
    );
    const graphemeOffset = getCachedView(
      cache.graphemeOffset,
      buffer,
      info.graphemeOffsetPtr,
      cellCount,
      Uint32Array,
    );
    const graphemeLen = getCachedView(
      cache.graphemeLen,
      buffer,
      info.graphemeLenPtr,
      cellCount,
      Uint32Array,
    );
    const graphemeBuffer = getCachedView(
      cache.graphemeBuffer,
      buffer,
      info.graphemeBufferPtr,
      info.graphemeBufferLen,
      Uint32Array,
    );
    const selectionStart = getCachedView(
      cache.selectionStart,
      buffer,
      info.selectionStartPtr,
      rows,
      Int16Array,
    );
    const selectionEnd = getCachedView(
      cache.selectionEnd,
      buffer,
      info.selectionEndPtr,
      rows,
      Int16Array,
    );
    const cursor = info.cursorPtr ? unpackCursor(buffer, info.cursorPtr) : null;

    return {
      rows,
      cols,
      cellCount,
      codepoints,
      contentTags,
      wide,
      cellFlags,
      styleFlags,
      linkIds,
      fgBytes,
      bgBytes,
      ulBytes,
      ulStyle,
      linkOffsets,
      linkLengths,
      linkBuffer,
      graphemeOffset,
      graphemeLen,
      graphemeBuffer,
      selectionStart,
      selectionEnd,
      cursor,
    };
  }
}

export async function loadResttyWasm(options: ResttyWasmOptions = {}): Promise<ResttyWasm> {
  return ResttyWasm.load(options);
}

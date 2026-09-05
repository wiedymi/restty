/**
 * WASM ABI variant identifier.
 * - info: render state via single info struct
 * - render: render state via separate pointer exports
 * - cells: cell state via separate pointer exports
 */
export type WasmAbiKind = "info" | "render" | "cells";

/** WASM ABI variant descriptor. */
export type WasmAbi = {
  kind: WasmAbiKind;
};

/** Cursor state from WASM terminal core. */
export type CursorInfo = {
  row: number;
  col: number;
  visible: number;
  style: number;
  blinking: number;
  wideTail: number;
  color: number;
};

/** Search status snapshot from the WASM terminal core. */
export type SearchStatus = {
  active: boolean;
  pending: boolean;
  complete: boolean;
  generation: number;
  totalMatches: number;
  selectedIndex: number | null;
};

/** Visible search-highlight span in viewport coordinates. */
export type SearchViewportMatch = {
  row: number;
  startCol: number;
  endCol: number;
  selected: boolean;
};

/** Kitty graphics protocol image placement descriptor. */
export type KittyPlacement = {
  imageId: number;
  placementId: number;
  placementExternal: boolean;
  imageFormat: number;
  imageWidth: number;
  imageHeight: number;
  imageDataPtr: number;
  imageDataLen: number;
  imageRevision?: string;
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

/** Terminal render state snapshot with typed array views into WASM memory. */
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

/** WASM module exports for terminal core API. */
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
  restty_kitty_tick: (handle: number, now: number) => number;
  restty_selection_text: (
    handle: number,
    anchorRow: number,
    anchorCol: number,
    focusRow: number,
    focusCol: number,
    outPtr: number,
    outLen: number,
  ) => number;
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
  restty_active_cursor_x?: (handle: number) => number;
  restty_active_cursor_y?: (handle: number) => number;
  restty_output_ptr?: (handle: number) => number;
  restty_output_len?: (handle: number) => number;
  restty_output_consume?: (handle: number, len: number) => number;
  restty_kitty_keyboard_flags?: (handle: number) => number;
  restty_kitty_placement_stride?: () => number;
  restty_kitty_placement_count?: (handle: number) => number;
  restty_kitty_placements_ptr?: (handle: number) => number;
  restty_search_set_query?: (handle: number, ptr: number, len: number) => number;
  restty_search_clear?: (handle: number) => number;
  restty_search_step?: (handle: number, budget: number) => number;
  restty_search_status_ptr?: (handle: number) => number;
  restty_search_viewport_match_count?: (handle: number) => number;
  restty_search_viewport_matches_ptr?: (handle: number) => number;
  restty_search_select_next?: (handle: number) => number;
  restty_search_select_prev?: (handle: number) => number;
};

/** Construction options for WASM runtime. */
export type ResttyWasmOptions = {
  log?: (message: string) => void;
};

export type RenderPtrs = {
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

export type ViewEntry<T extends ArrayBufferView> = {
  buffer: ArrayBufferLike | null;
  ptr: number;
  len: number;
  view: T | null;
};

export type RenderViewCache = {
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

export type TypedArrayCtor<T extends ArrayBufferView> = new (
  buffer: ArrayBufferLike,
  byteOffset: number,
  length: number,
) => T;

# WASM ABI and Memory Layout (Prototype)

This prototype exposes **separate flat arrays** instead of a packed render
buffer. The goal is to keep the WASM side simple while we iterate on the
renderer.

## Core Exports
- `restty_create(cols, rows, max_scrollback) -> handle`
- `restty_destroy(handle)`
- `restty_write(handle, ptr, len) -> error`
- `restty_resize(handle, cols, rows) -> error`
- `restty_set_pixel_size(handle, width_px, height_px) -> error`
- `restty_render_update(handle) -> error`
- `restty_rows(handle) -> u32`
- `restty_cols(handle) -> u32`

## Cell Arrays (length = rows * cols)
- `restty_cell_codepoints_ptr(handle) -> ptr` (u32 codepoint)
- `restty_cell_fg_rgba_ptr(handle) -> ptr` (u32 RGBA)
- `restty_cell_bg_rgba_ptr(handle) -> ptr` (u32 RGBA)
- `restty_cell_ul_rgba_ptr(handle) -> ptr` (u32 RGBA)
- `restty_cell_underline_styles_ptr(handle) -> ptr` (u8 underline style)
- `restty_cell_grapheme_offsets_ptr(handle) -> ptr` (u32 grapheme offset)
- `restty_cell_grapheme_lengths_ptr(handle) -> ptr` (u32 grapheme length)
- `restty_cells_len(handle) -> u32`

### Additional cell metadata (optional)
- `restty_cell_content_tags_ptr(handle) -> ptr` (u8 content tag)
- `restty_cell_wide_ptr(handle) -> ptr` (u8 wide flags)
- `restty_cell_flags_ptr(handle) -> ptr` (u16 flags)
- `restty_cell_style_flags_ptr(handle) -> ptr` (u16 style flags)
- `restty_cell_link_ids_ptr(handle) -> ptr` (u32 link id index)

RGBA packing is `0xRRGGBBAA`.

## Grapheme Buffer
- `restty_grapheme_buffer_ptr(handle) -> ptr` (u32 codepoints)
- `restty_grapheme_buffer_len(handle) -> u32`

Each cell uses `g_offset` + `g_len` to reference extra codepoints beyond the
cell’s base codepoint.

## Selection (length = rows)
- `restty_row_selection_start_ptr(handle) -> ptr` (i16)
- `restty_row_selection_end_ptr(handle) -> ptr` (i16)

A value of `-1` means no selection on that row.

## Cursor
- `restty_cursor_info_ptr(handle) -> ptr` (16-byte struct)

Layout: `u16 row`, `u16 col`, `u8 visible`, `u8 style`, `u8 blinking`,
`u8 wide_tail`, `u32 color_rgba`, `u32 reserved`.

## Allocation Helpers
- `restty_alloc(len) -> ptr`
- `restty_free(ptr, len)`

## Additional runtime exports used today
- Viewport/scrollbar:
  - `restty_scroll_viewport`
  - `restty_scrollbar_total`
  - `restty_scrollbar_offset`
  - `restty_scrollbar_len`
- Terminal output drain:
  - `restty_output_ptr`
  - `restty_output_len`
  - `restty_output_consume`
- Palette/default colors:
  - `restty_set_default_colors`
  - `restty_set_palette`
  - `restty_reset_palette`
- Hyperlink metadata:
  - `restty_link_offsets_ptr`
  - `restty_link_lengths_ptr`
  - `restty_link_buffer_ptr`
  - `restty_link_count`
  - `restty_link_buffer_len`
- Kitty image placements:
  - `restty_kitty_placement_stride`
  - `restty_kitty_placement_count`
  - `restty_kitty_placements_ptr`

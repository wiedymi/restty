# WASM Core (libghostty-vt Wrapper)

## Summary
We build a custom Zig -> WASM wrapper that exposes the Ghostty terminal engine
(`ghostty-vt` Zig API) to JS. We do not rely on the current C API because it
only exposes key/OSC/SGR/paste utilities; the full Terminal + RenderState is in
Zig.

**Prototype note:** the current WASM wrapper (`wasm/src/restty.zig`) exports a
minimal subset (create/write/render + cell buffer) for playground integration.

## Build Strategy
- Use Ghostty's build system to compile the `ghostty-vt` Zig module to WASM.
- Create our own Zig entry module that:
  - imports `ghostty-vt` as a module
  - exports a C ABI for JS
  - uses `export` to expose functions and memory layout

## Core Types
- `Terminal`: maintains state, scrollback, screen, modes, etc.
- `RenderState`: snapshot of terminal state for rendering (rows, cells, colors,
  cursor, highlights/selection).
- `Stream`: parser for VT sequences. We use a custom handler that:
  - updates `Terminal`
  - captures any responses into an output buffer (DSR/DA, etc.)

## Exported ABI (Draft)
All functions use plain integers, pointers, and lengths (C ABI).

Lifecycle:
- `restty_create(cols, rows, max_scrollback) -> handle`
- `restty_destroy(handle)`

IO / VT:
- `restty_write(handle, ptr, len) -> result` (PTY output into terminal)
- `restty_resize(handle, cols, rows, px_w, px_h)`
- `restty_scroll_viewport(handle, delta)`
- `restty_scroll_viewport_top(handle)`
- `restty_scroll_viewport_bottom(handle)`

Render:
- `restty_render_update(handle) -> result` (updates RenderState)
- `restty_render_info(handle) -> ptr` (pointer to a packed struct with sizes)
- `restty_render_rows_ptr(handle) -> ptr` (flat row offsets)
- `restty_render_cells_ptr(handle) -> ptr` (flat cell data)
- `restty_render_styles_ptr(handle) -> ptr` (style map)
- `restty_render_graphemes_ptr(handle) -> ptr` (grapheme array)
- `restty_render_dirty_rows_ptr(handle) -> ptr` (bitset or u8 array)

Output from terminal (responses):
- `restty_output_ptr(handle) -> ptr`
- `restty_output_len(handle) -> len`
- `restty_output_consume(handle, len)`

Input encoding:
- `restty_key_encoder_new() -> encoder_handle`
- `restty_key_encoder_config(encoder_handle, flags)`
- `restty_key_event_new() -> event_handle`
- `restty_key_event_set_*` (action, key, mods, utf8, composing)
- `restty_key_encode(encoder_handle, event_handle, out_ptr, out_len) -> written`

## RenderState Marshaling (Draft)
We will not expose Zig pointers to complex structs. Instead we will:
- Copy `RenderState` into a compact, C-compatible buffer each update.
- Keep layout stable and versioned.
- Provide a small header struct for JS to interpret array offsets.

Header (packed struct):
- rows, cols
- cell_stride (bytes)
- row_stride (bytes)
- style_stride (bytes)
- palette info
- cursor info
- offsets for arrays (cells, styles, graphemes)

Cell (packed struct):
- codepoint (u32)
- content_tag (u8)
- wide (u8)
- style_id (u16)
- flags (bitfield for hyperlink, etc.)
- grapheme_offset + grapheme_len

Style (packed struct):
- fg: [u8;4] (tag + value)
- bg: [u8;4]
- underline: [u8;4]
- flags (bold/italic/underline/etc.)

## Stream Handler
We need a handler similar to Ghostty's `termio.StreamHandler` but trimmed for
browser usage:
- Update terminal state for all actions.
- For actions that require a response (device status, attributes, etc.), push
  response bytes into a ring buffer.
- Some actions are delegated to the JS host (e.g., clipboard requests).

## Error Handling
- Every public function returns a small enum error code.
- Use a shared `last_error` buffer for debugging (optional).

# WASM Core (libghostty-vt Wrapper)

## Summary
We build a custom Zig -> WASM wrapper that exposes the Ghostty terminal engine
(`ghostty-vt` Zig API) to JS. We do not rely on the current C API because it
only exposes key/OSC/SGR/paste utilities; the full Terminal + RenderState is in
Zig.

The current wrapper (`wasm/src/restty.zig`) exports more than the original
prototype baseline: lifecycle, render buffers, scrollback helpers, palette
updates, output draining, link metadata, and kitty image placement buffers.

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

## Exported ABI (current groups)
All exports use plain integers, pointers, and lengths (C ABI style).

- Lifecycle:
  - `restty_create`, `restty_destroy`
- VT IO and viewport:
  - `restty_write`, `restty_resize`, `restty_set_pixel_size`, `restty_scroll_viewport`
- Rendering refresh and buffer pointers:
  - `restty_render_update`
  - `restty_rows`, `restty_cols`
  - `restty_cell_*_ptr` pointer family for codepoints, colors, style flags, grapheme offsets, etc.
- Selection/cursor:
  - `restty_row_selection_*_ptr`, `restty_cursor_info_ptr`
- Palette/default colors:
  - `restty_set_default_colors`, `restty_set_palette`, `restty_reset_palette`
- Terminal replies:
  - `restty_output_ptr`, `restty_output_len`, `restty_output_consume`
- Links and kitty graphics metadata:
  - `restty_link_*`
  - `restty_kitty_placement_*`
- Allocation helpers:
  - `restty_alloc`, `restty_free`

## RenderState Marshaling (current)
The main runtime path (`src/wasm/runtime.ts`) reads typed-array pointer exports
for rows/cols and cell-related buffers. For compatibility, the loader also has
fallback logic for older ABI shapes (`info` and `render` kinds), but current
`wasm/src/restty.zig` exports use the `cells`-style pointer set.

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

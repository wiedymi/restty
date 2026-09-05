# WASM Core (libghostty-vt Wrapper)

## Summary
We build a small Zig -> WASM adapter over the `ghostty-vt` Zig API.
Upstream now also exposes Terminal, RenderState, selection, and search through
its C API. Restty keeps its existing bulk typed-array ABI to avoid per-cell
calls and preserve its renderer integration.

The core is pinned to upstream commit `492300cad104195411d12217dd22f1cd05f31376`
plus a small browser graphics patch. Builds use Zig 0.16.0, ReleaseSafe,
`wasm32-freestanding`, SIMD128, and a 128 KiB stack. Chrome 91+, Firefox 89+,
and Safari 16.4+ support SIMD128. The loader imports `env.now_ms` from
`performance.now()` for the terminal's clock.

The fork adds an explicit `-Dwasm-kitty-graphics=true` opt-in and rejects
filesystem image media on freestanding targets. The adapter provides PNG
decoding through Wuffs. It does not keep encoded PNGs inside the terminal.
PTY file-media rewriting remains in the host transport.

Upstream's stream handler processes terminal state and replies; Restty keeps
its device identity and bounded reply buffer. Upstream's whole-terminal search
engine owns search state. Selection text uses upstream page formatting directly,
with soft-line unwrapping and selected trailing blank rows preserved.

Kitty images use upstream relative-placement resolution and animation playback.
The adapter exports image revisions with each placement so texture caches update
even when changed pixels reuse the same memory address. The render loop checks
animation changes on each active frame without forcing a redraw when unchanged.

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

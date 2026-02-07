# Architecture Decisions

## Rendering Mode
- Default: grayscale atlas with hinting.
- Optional: LCD subpixel atlas (toggle).
- No SDF/MSDF path (removed; raster atlas only).

## Ligatures
- Enabled by default.
- Draw shaped glyphs across cell ranges and skip per-cell glyphs in that span.
- Cursor/selection rendered as overlays to avoid breaking ligatures.

## Fonts
- Bundle JetBrains Mono (OFL-1.1).
- Allow local fonts via queryLocalFonts (Chromium only, user gesture).

## WASM Strategy
- Custom Zig wrapper over ghostty-vt Zig API.
- Avoid relying on current C ABI (missing Terminal/RenderState).
- Patch ghostty submodule for wasm/lib-vt builds to avoid config/font deps:
  - `terminal/style.zig`: local BoldColor stub for `.lib`.
  - `terminal/mouse_shape.zig`: skip build_config import for `.lib`.
  - `quirks.zig`: avoid font import on wasm.
- Embed wasm binary into the JS bundle for browser use (no runtime fetch).

## Rendering Backend
- WebGPU primary; WebGL2 fallback.
- Keep shader and buffer layout compatible across backends.

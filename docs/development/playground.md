# Playground and Testing

## Quick Start (Bun)
1. Build browser assets:
   - `bun run build:assets`
2. Start the PTY websocket server:
   - `bun run pty` (default `ws://localhost:8787/pty`)
3. Start the playground dev server:
   - `bun run playground` (default `http://localhost:5173`)
4. Open the URL shown in the console.

Static-file-only option:

- `bun run playground:static`

## Build the WASM module
From `wasm/`:
- `zig build`
- `cp zig-out/bin/restty.wasm ../playground/public/restty.wasm`

This installs `restty.wasm` into `playground/public/` so the playground can load it.

Requires Zig 0.15.2+ (matches Ghostty's minimum).

If you need to refresh the embedded library wasm blob (`src/wasm/embedded.ts`):

- `bun run playground/scripts/embed-wasm.ts`

## Build text-shaper bundle
From repo root:
- `bun run playground/build-text-shaper.ts`

This bundles `reference/text-shaper/src/index.ts` to `playground/public/text-shaper.js`.

`bun run build:assets` already runs this, plus the restty input/wasm browser bundles.

## Fetch default font
From repo root:
- `bun run playground/fetch-fonts.ts`

This downloads:

- `JetBrainsMono-Regular.ttf`
- `SymbolsNerdFontMono-Regular.ttf`
- `OpenMoji-black-glyf.ttf`

## What It Tests
- WebGPU availability and device initialization.
- WebGL2 fallback (if WebGPU is unavailable).
- Resize/DPR handling.
- Animation loop stability.
- Text shaping + rasterized atlas rendering (foreground/background/selection/cursor).

## Notes
- WebGPU requires a modern Chromium/Firefox build with WebGPU enabled.
- WebGL2 is the fallback path for older browsers.
- This harness is used as the fastest integration loop for WASM + renderer + input.

## Next Integration Steps
- Validate the new render ABI buffers against production WASM output.
- Improve underline styles (dotted/dashed/curly) and wide-glyph handling.
- Add a font selector plus explicit "Use local fonts" affordance.

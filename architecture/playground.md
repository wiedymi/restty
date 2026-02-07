# Playground and Testing

## Quick Start (Bun)
1. Start the playground:
   - `bun playground.html` (Bun dev server, defaults to http://localhost:3000)
   - or `bun playground/server.ts` (static server, defaults to http://localhost:5173)
2. Open the URL shown in the console.

## Build the WASM module
From `wasm/`:
- `zig build -Dtarget=wasm32-freestanding -Doptimize=ReleaseSmall`
- `cp zig-out/bin/restty.wasm ../playground/public/restty.wasm`

This installs `restty.wasm` into `playground/public/` so the playground can load it.

Requires Zig 0.15.2+ (matches Ghostty's minimum).

## Build text-shaper bundle
From repo root:
- `bun playground/scripts/build-text-shaper.ts`

This bundles `reference/text-shaper/src/index.ts` to `playground/public/text-shaper.js`.

## Fetch default font
From repo root:
- `bun playground/scripts/fetch-fonts.ts`

This downloads JetBrains Mono to `playground/public/fonts/JetBrainsMono-Regular.ttf`.
If the file is missing at runtime, the playground attempts to use `queryLocalFonts()`.

## What It Tests
- WebGPU availability and device initialization.
- WebGL2 fallback (if WebGPU is unavailable).
- Resize/DPR handling.
- Animation loop stability.
- Text shaping + rasterized atlas rendering (foreground/background/selection/cursor).

## Notes
- WebGPU requires a modern Chromium/Firefox build with WebGPU enabled.
- WebGL2 is the fallback path for older browsers.
- This harness is a shell for integrating the WASM core and renderer.

## Next Integration Steps
- Validate the new render ABI buffers against production WASM output.
- Improve underline styles (dotted/dashed/curly) and wide-glyph handling.
- Add a font selector plus explicit "Use local fonts" affordance.

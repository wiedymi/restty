# Playground and Testing

Hosted demo: `https://restty.pages.dev/`

## Quick Start (Bun)
1. Start local playground stack:
   - `bun run playground`
   - Starts PTY websocket server (`ws://localhost:8787/pty`) and playground dev server (`http://localhost:5173`).
2. Open the URL shown in the console.

Run components separately when needed:

- `bun run pty`

Static-file-only option:

- `bun run build:assets`
- `bun run playground:static`

Hinting experiments (playground URL params):

- `?hinting=1&hintTarget=auto`
- `?hinting=1&hintTarget=light`
- `?hinting=1&hintTarget=normal`

`hinting=0` (or omitted) keeps atlas hinting disabled.

You can also toggle both settings live in the playground Settings panel
(`Appearance` section) without reloading.

WebContainer mode note:

- In-browser WebContainer mode seeds `/demo.js`, `/test.js`, and related demo scripts automatically.

Cloudflare Pages static deploy:

1. Run `bun run build:assets`
2. Deploy `playground/public/` as the output directory.
3. Keep `playground/public/_headers` so COOP/COEP headers are applied (required for WebContainer mode).

## Build the WASM module
From repo root:
- `bun run build:wasm`

This builds the wasm module and refreshes `src/wasm/embedded.ts` directly from `wasm/zig-out/bin/restty.wasm`.

Requires Zig 0.15.2+ (matches Ghostty's minimum).

There is no separate embed step script anymore; rerun `bun run build:wasm` when you want to refresh the embedded blob.

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

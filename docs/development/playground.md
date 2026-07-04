# Playground and Testing

Hosted demo: `https://restty.pages.dev/`

## Quick Start (Bun)

1. Start local playground stack:
   - `bun run playground`
   - Starts the playground dev server (`http://localhost:5173`) plus the optional OS PTY websocket server (`ws://localhost:8787/pty`).
2. Open the URL shown in the console.

Run components separately when needed:

- `bun run playground:pty`

Build/preview the standalone playground:

- `bun run playground:build`
- `bun run playground:preview`

Font rendering experiments are controlled from the playground panel without URL params.
Hinting is disabled by default, and ligatures are on by default.

Playground font defaults:

- `Bundled preset: JetBrains Mono (default)`
- `Ligatures: On`
- `Hinting: Off`
- Fira Code remains a selectable preset and is served from `playground/public/fonts/FiraCode-Regular.ttf`.
- JetBrains Mono and fallback symbol/emoji assets are served from `playground/public/fonts/` when present, with CDN/local fallbacks configured by `playground/app/lib/restty/fonts.ts`.

Connection modes:

- `Just Bash` is the default. It starts the in-browser shell without requiring a local PTY server.
- `WebContainer` keeps the in-browser runtime but lets you customize the command and working directory.
- `OS PTY` connects to the local websocket PTY server at `ws://localhost:8787/pty`.

WebContainer-backed modes seed `/demo.sh`, `/test.sh`, and related shell demo scripts automatically.

Cloudflare Pages static deploy:

1. Run `bun run playground:build`
2. Deploy `playground/dist/` as the output directory.
3. `playground/public/_headers` and `_redirects` are copied into the build output so COOP/COEP headers and SPA fallback are applied.

## Build the WASM module

From repo root:

- `bun run build:wasm`

This builds the wasm module and refreshes `src/wasm/embedded.ts` directly from `wasm/zig-out/bin/restty.wasm`.

Requires Zig 0.15.2+ (matches Ghostty's minimum).

There is no separate embed step script anymore; rerun `bun run build:wasm` when you want to refresh the embedded blob.

## Fetch playground font assets

From repo root:

- `bun run playground/scripts/fetch-fonts.ts`

This helper downloads missing fetched assets into `playground/public/fonts/`:

- `JetBrainsMono-Regular.ttf`
- `SymbolsNerdFontMono-Regular.ttf`
- `NerdFontsSymbolsOnly.LICENSE`
- `OpenMoji-black-glyf.ttf`

Other authored playground font assets, including `FiraCode-Regular.ttf`, `NotoSansSymbols2-Regular.ttf`,
and `NotoSansCJK-Regular.ttc`, are expected to already live in `playground/public/fonts/`.

## What It Tests

- WebGPU availability and device initialization.
- WebGL2 fallback (if WebGPU is unavailable).
- Resize/DPR handling.
- Animation loop stability.
- Text shaping + rasterized atlas rendering (foreground/background/selection/cursor).
- Cross-cell programming ligatures with the selectable Fira Code preset.

## Notes

- WebGPU requires a modern Chromium/Firefox build with WebGPU enabled.
- WebGL2 is the fallback path for older browsers.
- This harness is used as the fastest integration loop for WASM + renderer + input.

## Next Integration Steps

- Validate the new render ABI buffers against production WASM output.
- Improve underline styles (dotted/dashed/curly) and wide-glyph handling.
- Add a font selector plus explicit "Use local fonts" affordance.

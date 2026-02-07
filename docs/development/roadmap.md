# Milestones and Validation

Planning reference for development phases and validation targets.

## Prototype (P0)
- WASM wrapper builds and loads.
- Terminal renders 80x24 text via WebGPU.
- Basic SGR colors, cursor, resize.
- Grayscale atlas, no ligatures.

## Feature Complete (P1)
- Full VT stream coverage + responses.
- Ligatures + complex scripts.
- Selection + copy/paste.
- WebGL2 fallback parity.

## Performance (P2)
- 60 fps on typical 120x40 grid.
- Smooth scrollback and resize.
- Stable memory usage (atlas eviction, no leaks).

## Test Plan
- Synthetic stress: 10k lines, fast scroll, rapid resize.
- Charset tests: emoji, CJK, Arabic/Indic.
- Ligature correctness: sequences like "==>", "!==".
- Input correctness: kitty keyboard protocol + modifiers.

## Metrics
- Frame time (GPU + CPU).
- Average glyph cache hit rate.
- WASM memory usage.

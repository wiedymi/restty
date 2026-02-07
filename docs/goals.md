# Initial goals

restty is an experimental browser terminal stack focused on control and iteration speed.

## Project goals

- Keep terminal state and VT parsing inside a Zig/WASM core (`wasm/src/restty.zig`).
- Keep browser integration in TypeScript (`src/`): renderer, input handling, PTY wiring, and app glue.
- Prefer GPU rendering with WebGPU first and WebGL2 fallback (`src/renderer/`).
- Use text shaping + raster atlas generation from text-shaper in the browser pipeline.
- Support modern terminal behavior (selection, clipboard paths, kitty keyboard/graphics handling).
- Iterate quickly with a local playground and PTY websocket server (`playground/`).

## Explicit non-goals (current project scope)

- Full terminal application UI (tabs, splits, profile management).
- Native desktop runtime; this repo targets browser runtime and local dev tooling.
- Exact pixel parity with native Ghostty renderers.

## What “working” means in this repo today

- Playground boots with `bun run playground`.
- Local shell can be attached through `bun run pty`.
- WASM render state is consumed and drawn through WebGPU or WebGL2.
- Core behavior is validated by Bun tests in `tests/` (input mapping, PTY decoding, output filters, renderer checks).

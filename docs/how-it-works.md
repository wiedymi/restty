# How restty works

This page explains the runtime pipeline behind `new Restty(...)`.

## Big picture

restty has three main layers:
- PTY transport (`src/pty/`): websocket connection to a shell/backend.
- Terminal core (`src/wasm/`): WASM wrapper around `libghostty-vt`.
- Renderer (`src/renderer/`): WebGPU first, WebGL2 fallback.

`src/surface/` coordinates those layers and exposes the ergonomic `Restty` API.
`src/runtime/` implements the per-pane terminal runtime (`create-runtime`) used by `surface`.

## Startup flow

1. You create `new Restty({ root, ... })`.
2. Pane manager creates pane DOM (container + canvas + hidden IME textarea).
3. `ResttyApp` boots each pane:
   - loads WASM (`loadResttyWasm`)
   - creates terminal handle (`create(cols, rows, scrollback)`)
   - initializes renderer (`webgpu` or `webgl2`)
4. Initial render starts and waits for PTY or direct input.

## Output flow (PTY -> terminal -> GPU)

1. PTY data arrives from websocket in `src/pty/pty.ts`.
2. Input/output filters in `src/input/` handle escape-sequence details.
3. Text is written into WASM (`wasm.write(...)`).
4. WASM updates render buffers (`wasm.renderUpdate(...)`).
5. JS reads render state (`wasm.getRenderState(...)`).
6. Renderer builds draw data and paints backgrounds, glyphs, decorations, selection, cursor.

## Input flow (browser -> terminal/PTY)

1. Keyboard, mouse, IME, and clipboard events are captured in `src/runtime/create-runtime.ts`.
2. `src/input/` encodes key/mouse protocol sequences.
3. Encoded bytes are sent to PTY when connected.
4. If no PTY is connected, text can still be written to WASM for local/demo usage.

## Terminal responses (WASM -> PTY)

Some terminal replies (for example DSR/DA responses) are produced by WASM.
restty drains that output (`wasm.drainOutput(...)`) and forwards it to the PTY transport.

## Theme/font flow

- Themes come from built-ins or Ghostty theme parsing (`src/theme/`).
- Font loading is managed by `src/fonts/` and configured via `fontPreset` + `fontSources`.
- App layer applies colors and font changes, then triggers redraw.

## Plugin/shader flow

1. Plugins are activated by `Restty` in `src/surface/` (`use`, `loadPlugins`).
2. Plugin hooks/interceptors run around pane lifecycle and PTY text processing.
3. Plugin render stages (`addRenderStage`) are merged into the shader-stage pipeline.
4. Runtime render loop in `src/runtime/create-runtime.ts` executes stages for WebGPU/WebGL2.

## Local dev runtime

- `bun run build:assets`: builds static playground app bundle into `playground/public/playground.js`.
- `bun run playground`: starts local dev stack (PTY websocket server + dev server).
- `bun run pty`: PTY websocket server only (`ws://localhost:8787/pty`).

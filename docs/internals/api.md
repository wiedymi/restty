# Public API (Draft)

This file captures a target high-level API shape that is still evolving.

Current exported surfaces in `src/index.ts` are centered on:

- `new Restty(...)` for app-level integration.
- `loadResttyWasm(...)` / `ResttyWasm` for low-level ABI access.
- `createInputHandler(...)` and PTY helpers in `src/input` + `src/pty`.

For practical usage examples, see `docs/usage.md`.

## Core
- `createTerminal({ cols, rows, scrollback }) -> Terminal`
- `terminal.write(data: Uint8Array)`
- `terminal.resize({ cols, rows, pxWidth, pxHeight })`
- `terminal.scroll({ delta | top | bottom })`
- `terminal.destroy()`

## Rendering
- `terminal.render(frameInfo)`
  - `frameInfo` provides target canvas and device (WebGPU/WebGL2).
- `terminal.setRenderer('webgpu' | 'webgl2')`

## Fonts
- `terminal.setFont({ source, name?, data? })`
- `terminal.setFontSize(px)`
- `terminal.setFontFeatures({ liga, calt, kern, ... })`
- `terminal.listLocalFonts()` (Chromium only; user gesture required)

## Input
- `terminal.encodeKey(event: KeyboardEvent) -> Uint8Array`
- `terminal.onInput(cb)` (used by host to send bytes to PTY)
- `terminal.sendText(text)` (IME / paste)

## Output (Responses)
- `terminal.onOutput(cb)` (device status replies, etc.)

## Selection / Clipboard
- `terminal.getSelection()`
- `terminal.setSelection(start, end)`
- `terminal.copySelection()` (delegates to JS clipboard)
- `terminal.paste(text)`

## Events
- `onResize`, `onScroll`, `onTitle`, `onBell`, `onHyperlink`

# Usage

## Local playground workflow

```bash
git submodule update --init --recursive
bun install
bun run build:themes
bun run build:assets
bun run pty
bun run playground
```

Open `http://localhost:5173`, then connect to `ws://localhost:8787/pty` from the UI.

## High-level integration (`createResttyApp`)

`createResttyApp` is the primary integration surface in this repo.

```ts
import { createResttyApp } from "restty";
import {
  Font,
  UnicodeBuffer,
  shape,
  glyphBufferToShapedGlyphs,
  buildAtlas,
  atlasToRGBA,
  rasterizeGlyph,
  rasterizeGlyphWithTransform,
  PixelMode,
} from "./text-shaper.js";

const app = createResttyApp({
  canvas: document.getElementById("screen") as HTMLCanvasElement,
  imeInput: document.getElementById("imeInput") as HTMLTextAreaElement | null,
  textShaper: {
    Font,
    UnicodeBuffer,
    shape,
    glyphBufferToShapedGlyphs,
    buildAtlas,
    atlasToRGBA,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    PixelMode,
  },
  renderer: "auto", // "auto" | "webgpu" | "webgl2"
});

await app.init();
app.connectPty("ws://localhost:8787/pty");
```

Useful methods:

- `app.setRenderer("webgpu" | "webgl2" | "auto")`
- `app.setFontSize(number)`
- `app.applyTheme(theme)` / `app.resetTheme()`
- `app.sendInput(text)` and `app.sendKeyInput(encoded)`
- `app.copySelectionToClipboard()` / `app.pasteFromClipboard()`
- `app.disconnectPty()` and `app.destroy()`

## Low-level integration (`loadResttyWasm`)

If you want direct control over the ABI layer:

```ts
import { loadResttyWasm } from "restty";

const wasm = await loadResttyWasm();
const handle = wasm.create(80, 24, 2000);

wasm.write(handle, "echo 'hello from restty'\r\n");
wasm.renderUpdate(handle);

const state = wasm.getRenderState(handle);
if (state) {
  console.log(state.rows, state.cols, state.codepoints);
}

wasm.destroy(handle);
```

## PTY helpers

`src/pty/pty.ts` exports small helpers for websocket PTY wiring:

- `createPtyConnection`
- `connectPty` / `disconnectPty`
- `sendPtyInput` / `sendPtyResize`
- `isPtyConnected`

## Rebuilding generated assets

- Theme catalog: `bun run build:themes`
- Playground bundles: `bun run build:assets`
- Optional font fetch helper: `bun run playground/fetch-fonts.ts`

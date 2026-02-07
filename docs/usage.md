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

## High-level integration (`new Restty(...)`)

`Restty` is the primary integration surface in this repo.

Simple usage (built-in `text-shaper` is used by default):

```ts
import { Restty } from "restty";

const restty = new Restty({
  root: document.getElementById("paneRoot") as HTMLElement,
});
restty.connectPty("ws://localhost:8787/pty");
```

Default font loading uses CDN URLs. To override:

```ts
const restty = new Restty({
  root: document.getElementById("paneRoot") as HTMLElement,
  fontSources: [
    {
      type: "url",
      url: "https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Regular.ttf",
    },
    {
      type: "local",
      matchers: ["jetbrains mono nerd font", "fira code nerd font"],
    },
  ],
});
```

Switch runtime fonts for all panes:

```ts
await restty.setFontSources([
  { type: "local", matchers: ["sf mono"], required: true },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf",
  },
]);
```

Useful methods:

- `restty.setRenderer("webgpu" | "webgl2" | "auto")`
- `restty.setFontSize(number)`
- `await restty.setFontSources([...])`
- `restty.applyTheme(theme)` / `restty.resetTheme()`
- `restty.sendInput(text)` and `restty.sendKeyInput(encoded)`
- `restty.copySelectionToClipboard()` / `restty.pasteFromClipboard()`
- `restty.disconnectPty()` and `restty.destroy()`

## Pane manager integration

`Restty` supports split panes with default shortcuts/context-menu out of the box.
It auto-creates each pane container, canvas, and hidden IME textarea.

```ts
import {
  Restty,
} from "restty";

const restty = new Restty({
  root: document.getElementById("paneRoot") as HTMLElement,
  defaultContextMenu: true,
  shortcuts: true,
});

restty.splitActivePane("vertical");
restty.splitActivePane("horizontal");
```

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

For static hosting (for example Cloudflare Pages), deploy `playground/public/` after `bun run build:assets`.

# restty

Powerful, lightweight browser terminal. Batteries included.

Live demo: `https://restty.pages.dev/`

Powered by:

- `libghostty-vt` (WASM terminal core)
- `WebGPU` (with WebGL2 fallback)
- `text-shaper` (shaping + raster)

## Release Status

`restty` is in an early release stage.

- Known issue: kitty image protocol handling can still fail in some edge cases.
- API note: high-level APIs are usable now, but some APIs may still change to improve DX.

If you hit an issue, please open one on GitHub with repro steps.

## Install

```bash
npm i restty
```

## Quick Start

```html
<div id="terminal"></div>
```

```ts
import { Restty } from "restty";

const restty = new Restty({
  root: document.getElementById("terminal") as HTMLElement,
});

restty.connectPty("ws://localhost:8787/pty");
```

That is the primary API: `new Restty(...)`.
`restty` creates pane DOM, canvas, and hidden IME input for you.

## Common Tasks

### Apply a built-in theme

```ts
import { getBuiltinTheme } from "restty";

const theme = getBuiltinTheme("Aizen Dark");
if (theme) restty.applyTheme(theme);
```

### Parse and apply a Ghostty theme file

```ts
import { parseGhosttyTheme } from "restty";

const theme = parseGhosttyTheme(`
foreground = #c0caf5
background = #1a1b26
cursor-color = #c0caf5
`);

restty.applyTheme(theme, "inline");
```

### Split panes and operate per pane

```ts
restty.splitActivePane("vertical");
restty.splitActivePane("horizontal");

for (const pane of restty.panes()) {
  pane.connectPty("ws://localhost:8787/pty");
}
```

### Use active-pane convenience methods

```ts
restty.setFontSize(15);
restty.sendInput("ls -la\n");
restty.copySelectionToClipboard();
```

### Provide custom fonts

By default, restty uses a CDN font preset. To fully control fonts, disable the preset and pass `fontSources`.

```ts
const restty = new Restty({
  root: document.getElementById("terminal") as HTMLElement,
  appOptions: {
    fontPreset: "none",
  },
  fontSources: [
    {
      type: "url",
      url: "https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Regular.ttf",
      label: "JetBrains Mono",
    },
    {
      type: "local",
      matchers: ["jetbrains mono nerd font", "fira code nerd font"],
      label: "Local fallback",
    },
  ],
});
```

Update fonts at runtime (all panes):

```ts
await restty.setFontSources([
  { type: "local", matchers: ["sf mono"], required: true },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf",
  },
]);
```

### Touch behavior (pan-first by default)

On touch devices, restty defaults to pan-first scrolling with long-press selection.

```ts
const restty = new Restty({
  root: document.getElementById("terminal") as HTMLElement,
  appOptions: {
    // "long-press" (default) | "drag" | "off"
    touchSelectionMode: "long-press",
    // Optional tuning knobs:
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
  },
});
```

## API Snapshot

Primary class:

- `new Restty({ root, ...options })`
- `createRestty(options)`

Pane access:

- `panes()` / `pane(id)` / `activePane()` / `focusedPane()` / `forEachPane(visitor)`
- `splitActivePane("vertical" | "horizontal")` / `splitPane(id, direction)` / `closePane(id)`

Active-pane convenience:

- `connectPty(url)` / `disconnectPty()` / `isPtyConnected()`
- `setRenderer("auto" | "webgpu" | "webgl2")`
- `setFontSize(number)` / `setFontSources([...])`
- `applyTheme(theme)` / `resetTheme()`
- `setMouseMode("auto" | "on" | "off")`
- `sendInput(text)` / `sendKeyInput(text)`
- `copySelectionToClipboard()` / `pasteFromClipboard()`
- `updateSize(force?)`
- `destroy()`

## Advanced / Internal Modules

Use these only when you need lower-level control:

- `restty/wasm`: low-level WASM ABI wrapper (`loadResttyWasm`, `ResttyWasm`)
- `restty/input`: key/mouse/input encoding utilities
- `restty/pty`: PTY transport helpers
- `restty/internal`: full internal barrel (unstable)

## Local Development

```bash
git clone https://github.com/wiedymi/restty.git
cd restty
git submodule update --init --recursive
bun install
bun run build:themes
bun run build:assets
bun run pty
bun run playground
```

Open `http://localhost:5173`.

## Repository Commands

```bash
bun run build         # build package output
bun run test          # full tests
bun run test:ci       # CI-safe test target
bun run lint          # lint
bun run format:check  # formatting check
bun run build:assets  # playground bundles
bun run pty           # local PTY websocket server
bun run playground    # playground dev server
```

## Documentation

- `docs/README.md` - docs index
- `docs/usage.md` - practical integration guide
- `docs/how-it-works.md` - runtime flow
- `docs/internals/` - implementation notes and architecture
- `THIRD_PARTY_NOTICES.md` - third-party credits and notices

# restty

[![GitHub](https://img.shields.io/badge/-GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/wiedymi)
[![Twitter](https://img.shields.io/badge/-Twitter-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://x.com/wiedymi)
[![Email](https://img.shields.io/badge/-Email-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:contact@wiedymi.com)
[![Discord](https://img.shields.io/badge/-Discord-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/zemMZtrkSb)
[![Support me](https://img.shields.io/badge/-Support%20me-ff69b4?style=flat-square&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/vivy-company)

Powerful, lightweight browser terminal. Batteries included.

Powered by:
- `libghostty-vt` (WASM terminal core)
- `WebGPU` (with WebGL2 fallback)
- `text-shaper` (shaping + raster)

## Install

```bash
npm i restty
```

## Minimal setup

`restty` ships with built-in text shaping and embedded WASM. You only need a canvas (and optional IME textarea).

```html
<canvas id="term"></canvas>
<textarea id="ime" style="position:absolute;left:-9999px;top:-9999px"></textarea>
```

```ts
import { createResttyApp } from "restty";

const app = createResttyApp({
  canvas: document.getElementById("term") as HTMLCanvasElement,
  imeInput: document.getElementById("ime") as HTMLTextAreaElement,
  renderer: "auto", // "auto" | "webgpu" | "webgl2"
});

await app.init();
```

## Common examples

### Connect to a PTY websocket

```ts
app.connectPty("ws://localhost:8787/pty");
```

### Apply a built-in theme

```ts
import { getBuiltinTheme } from "restty";

const theme = getBuiltinTheme("Aizen Dark");
if (theme) app.applyTheme(theme);
```

### Parse and apply a custom Ghostty theme

```ts
import { parseGhosttyTheme } from "restty";

const themeText = `
foreground = #c0caf5
background = #1a1b26
cursor-color = #c0caf5
`;
app.applyTheme(parseGhosttyTheme(themeText), "inline");
```

### Send input manually

```ts
app.sendInput("ls -la\n");
```

## App API (high level)

Main methods:
- `init()`
- `destroy()`
- `connectPty(url)` / `disconnectPty()`
- `isPtyConnected()`
- `setRenderer("auto" | "webgpu" | "webgl2")`
- `setFontSize(number)`
- `applyTheme(theme)` / `resetTheme()`
- `setMouseMode("auto" | "on" | "off")`
- `sendInput(text)` / `sendKeyInput(text)`
- `copySelectionToClipboard()` / `pasteFromClipboard()`
- `updateSize(force?)`

Low-level ABI access is also available via `loadResttyWasm()` if you need direct render-state integration.

## Local development

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

## Commands (repo)

```bash
bun run build         # build package output
bun run test          # full tests
bun run test:ci       # CI-safe test target
bun run lint          # lint
bun run format:check  # formatting check (src only)
bun run build:assets  # playground bundles
bun run pty           # local PTY server
bun run playground    # playground dev server
```

## Acknowledgements

Huge thanks to the Ghostty project and contributors for `libghostty-vt`, which powers restty's terminal core.

`text-shaper` is my own library, and it also makes this project possible by handling shaping and glyph rasterization in the browser pipeline.

## Docs

- `docs/README.md` - docs index
- `docs/usage.md` - integration details
- `docs/how-it-works.md` - runtime flow
- `docs/internals/` - architecture docs
- `THIRD_PARTY_NOTICES.md` - third-party credits and notices

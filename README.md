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

`restty` auto-creates panes, canvas, and hidden IME inputs for you.

```html
<div id="termRoot"></div>
```

```ts
import { Restty } from "restty";

const restty = new Restty({
  root: document.getElementById("termRoot") as HTMLElement,
});
```

By default, `restty` loads fonts from CDN URLs. You can override them at init via typed `fontSources`.

## Common examples

### Connect to a PTY websocket

```ts
restty.connectPty("ws://localhost:8787/pty");
```

### Apply a built-in theme

```ts
import { getBuiltinTheme } from "restty";

const theme = getBuiltinTheme("Aizen Dark");
if (theme) restty.applyTheme(theme);
```

### Parse and apply a custom Ghostty theme

```ts
import { parseGhosttyTheme } from "restty";

const themeText = `
foreground = #c0caf5
background = #1a1b26
cursor-color = #c0caf5
`;
restty.applyTheme(parseGhosttyTheme(themeText), "inline");
```

### Send input manually

```ts
restty.sendInput("ls -la\n");
```

### Provide custom fonts on init

```ts
const restty = new Restty({
  root: document.getElementById("termRoot") as HTMLElement,
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

### Switch fonts at runtime (all panes)

```ts
await restty.setFontSources([
  { type: "local", matchers: ["sf mono"], required: true },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf",
  },
]);
```

## Multi-pane + Context Menu Defaults

`restty` ships a pane manager and a default terminal context menu so you can add split panes quickly.
It auto-creates pane DOM, canvas, and hidden IME inputs for you.

```ts
import {
  Restty,
  getBuiltinTheme,
} from "restty";

const root = document.getElementById("paneRoot") as HTMLElement;

const restty = new Restty({
  root,
  appOptions: {
    renderer: "auto",
    fontSize: 18,
    callbacks: {
      onLog: (line) => console.log(line),
    },
    elements: {},
  },
  defaultContextMenu: {
    getPtyUrl: () => "ws://localhost:8787/pty",
  },
  shortcuts: true,
});

const first = restty.getActivePane();
const theme = getBuiltinTheme("Aizen Dark");
if (theme && first) first.app.applyTheme(theme);
```

Default split shortcuts are enabled:
- `Cmd/Ctrl + D` split right
- `Cmd/Ctrl + Shift + D` split down

## Restty API

Main methods:
- `new Restty({ root, ...options })`
- `destroy()`
- `getPanes()` / `getActivePane()` / `getFocusedPane()`
- `splitActivePane("vertical" | "horizontal")` / `splitPane(id, direction)` / `closePane(id)`
- `connectPty(url)` / `disconnectPty()` / `isPtyConnected()`
- `setRenderer("auto" | "webgpu" | "webgl2")`
- `setFontSize(number)`
- `applyTheme(theme)` / `resetTheme()`
- `setMouseMode("auto" | "on" | "off")`
- `sendInput(text)` / `sendKeyInput(text)`
- `copySelectionToClipboard()` / `pasteFromClipboard()`
- `updateSize(force?)`

Low-level ABI access is available via `loadResttyWasm()` when you need direct render-state integration.

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

Static deploy (Cloudflare Pages):
- Build: `bun run build:assets`
- Output directory: `playground/public`
- Keep `_headers` in that folder for COOP/COEP (required by WebContainer mode).

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

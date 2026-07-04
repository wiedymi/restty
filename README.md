# restty

[![Version](https://img.shields.io/npm/v/restty?style=flat-square)](https://www.npmjs.com/package/restty)
[![Downloads](https://img.shields.io/npm/dm/restty?style=flat-square)](https://www.npmjs.com/package/restty)
[![CI](https://img.shields.io/github/actions/workflow/status/wiedymi/restty/ci.yml?branch=main&style=flat-square)](https://github.com/wiedymi/restty/actions/workflows/ci.yml)
[![Demo](https://img.shields.io/badge/demo-restty.pages.dev-0ea5e9?style=flat-square)](https://restty.pages.dev/)

Browser terminal rendering for web apps, powered by `libghostty-vt` in WASM,
WebGPU with WebGL2 fallback, and TypeScript text shaping.

- Demo: <https://restty.pages.dev/>
- Canonical docs: <https://restty.pages.dev/docs>
- npm: <https://www.npmjs.com/package/restty>
- Issues: <https://github.com/wiedymi/restty/issues>

`restty` is early-release software. The high-level API is usable, but some APIs may still change
while the developer experience settles.

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

`new Restty(...)` creates the pane DOM, canvas, and hidden IME input for you.

## Main Entrypoints

- `restty`: primary API (`Restty`, `createRestty`, themes, fonts, PTY helpers, plugin types).
- `restty/xterm`: focused xterm.js-style compatibility wrapper.
- `restty/headless`: DOM-free WASM terminal core wrapper for replay, tests, and backend-owned sessions.
- `restty/esm`: standalone browser ESM bundle for script/CDN usage.
- `restty/internal`, `restty/internal/runtime`, `restty/internal/surface`: unstable advanced modules.

See the canonical [API surface docs](https://restty.pages.dev/docs/api-surface) for the current
method and export list.

## Common Links

- [Getting started](https://restty.pages.dev/docs/getting-started)
- [Core concepts](https://restty.pages.dev/docs/core-concepts)
- [Surface and panes](https://restty.pages.dev/docs/surface-and-panes)
- [Configuration](https://restty.pages.dev/docs/configuration)
- [PTY backends](https://restty.pages.dev/docs/pty-backends)
- [Headless terminal](https://restty.pages.dev/docs/headless)
- [Search](https://restty.pages.dev/docs/search)
- [Playground examples](https://restty.pages.dev/docs/playground-examples)
- [Fonts](https://restty.pages.dev/docs/fonts)
- [Themes and shaders](https://restty.pages.dev/docs/themes)
- [Plugins](https://restty.pages.dev/docs/plugins)
- [xterm compatibility](https://restty.pages.dev/docs/xterm-compat)
- [Troubleshooting](https://restty.pages.dev/docs/troubleshooting)
- [Architecture](https://restty.pages.dev/docs/architecture)
- [Runnable examples](./examples)

## Local Development

```bash
git clone https://github.com/wiedymi/restty.git
cd restty
git submodule update --init --recursive
bun install
bun run build:themes
bun run playground
```

Open `http://localhost:5173`.

Useful checks:

```bash
bun run build
bun run test:ci
bun run lint
bun run format:check
bun run playground:build
```

Cloudflare Pages deployment settings:

- Framework preset: `None`
- Build command: `bun install --frozen-lockfile && bun run pages:build`
- Build output directory: `playground/dist`
- Root directory: leave blank
- Environment variables: set `SKIP_DEPENDENCY_INSTALL=1` when using the build command above.

The hosted docs are sourced from `playground/content/docs/`. Repository notes under `docs/` are
legacy/internal references for development context.

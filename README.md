# restty

![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%3E%3D1.2.0-f9f1e1?logo=bun&logoColor=000)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Experimental project: browser terminal rendering with a WASM terminal core, GPU rendering (WebGPU + WebGL2 fallback), and TypeScript text shaping.

restty combines a Zig/WASM VT engine, modern browser rendering pipelines, and a local playground + PTY server to iterate quickly on terminal behavior.

## Why

- Build a browser terminal stack with explicit control over rendering and input.
- Keep terminal state logic in WASM while using TS/JS for browser integration.
- Validate behavior with focused tests (input mapping, UTF-8 handling, kitty graphics, glyph rendering).
- Iterate visually via a local playground without heavy framework overhead.

## How it works

1. PTY output bytes are fed into the WASM terminal core.
2. WASM exposes render/cell state to the TypeScript runtime.
3. Text shaping and glyph atlas generation happen in TS.
4. Renderer draws frames via WebGPU (or WebGL2 fallback).
5. Input (keyboard/mouse/IME) is encoded and sent back to PTY.

## Repository layout

- `src/` - Main library/runtime code (renderer, input, PTY bridge, app integration).
- `tests/` - Bun test suite.
- `playground/` - Browser playground app and local PTY websocket server.
- `playground/public/` - Playground static assets (fonts/wasm bundles).
- `assets/themes/` - Source-of-truth Ghostty theme files.
- `scripts/` - Setup helper scripts.
- `wasm/` - Zig source and build config for the WASM core.
- `architecture/` - Design/implementation notes.
- `reference/ghostty` - Upstream Ghostty reference (submodule).
- `reference/text-shaper` - Upstream text-shaper reference (submodule).

## Requirements

- Bun `>=1.2.0`
- Git with submodule support
- Optional: Zig (if rebuilding WASM artifacts from source)

## Quick start

```bash
git submodule update --init --recursive
bun install
bun run build:themes
bun run build:assets
bun run playground
```

Open `http://localhost:5173`.

## Commands

```bash
# Run all tests
bun run test

# Start PTY websocket server (default ws://localhost:8787/pty)
bun run pty

# Build playground/runtime bundles
bun run build:assets

# Regenerate embedded built-in theme catalog for the library
bun run build:themes

# Lint + format checks
bun run lint
bun run format:check

# Serve playground static files only
bun run playground:static
```

## Testing

Current suite covers:

- key/input encoding (`tests/input-keymap.test.ts`, `tests/input-kitty.test.ts`)
- PTY UTF-8 stream behavior (`tests/pty-utf8.test.ts`)
- output filtering and kitty graphics (`tests/output-filter.test.ts`, `tests/kitty-*.test.ts`)
- renderer/glyph checks (`tests/box-drawing.test.ts`, `tests/webgpu-glyph.test.ts`)

## Notes

- `tests/webgpu-glyph.test.ts` can bootstrap polyfill artifacts via `scripts/setup-wgpu-polyfill.ts`.
- Built-in themes are embedded in `src/theme/builtin-themes.ts` (generated via `scripts/generate-builtin-themes.ts`).
- Some generated playground assets are intentionally committed for reproducible local runs.

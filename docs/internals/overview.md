# restty Architecture Overview

## Goals
- Terminal emulator library for browsers using libghostty-vt (WASM) for VT state.
- GPU rendering (WebGPU primary, WebGL2 fallback).
- High-quality text shaping and rasterization using text-shaper (TypeScript).
- Ligatures on by default.
- Bundle a common ligature font and optionally use local fonts via queryLocalFonts.
- Native Restty API first, with optional xterm compatibility shim (`restty/xterm`).

## Non-goals (for v1)
- Full app UI (tabs, split panes, profile UI).
- Native desktop builds (browser only).
- Perfect pixel parity with Ghostty native renderers.

## High-level Data Flow
1. PTY output bytes -> WASM stream -> Terminal state updated.
2. WASM RenderState snapshot -> JS/TS renderer.
3. JS builds text runs -> text-shaper shapes -> glyph atlas updates.
4. GPU draws backgrounds, glyphs, decorations, cursor, selection.
5. User input -> key encoder (WASM) -> PTY input bytes.
6. Terminal queries -> WASM output buffer -> PTY.

## Core Components
- **WASM Core**: custom Zig wrapper around ghostty-vt Zig API.
- **Renderer**: WebGPU pipeline with WebGL2 fallback.
- **Text Shaper**: text-shaper for shaping, rasterization, atlas generation.
- **Font Manager**: bundled font + optional queryLocalFonts integration.
- **Input**: key encoder + IME text input handling.

## Directory Map (current)
- `wasm/` Zig wrapper source and build config for the WASM module.
- `src/wasm/` JS runtime wrapper and embedded wasm loader.
- `src/renderer/` WebGPU + WebGL2 rendering paths.
- `src/fonts/` font loading and fallback/font-metadata helpers.
- `src/input/` key/mouse encoding and output filtering.
- `src/pty/` websocket PTY connection helpers.
- `src/surface/` high-level orchestration and `Restty` API.
- `src/runtime/` terminal runtime implementation (`create-runtime`).
- `docs/internals/` internal architecture docs.

## Assumptions
- WebGPU is the primary path; WebGL2 is a fallback.
- A JS host provides PTY IO (e.g., WebSocket, WebTransport, or in-browser shell).
- Fonts are user-selectable; ligatures are on by default.

## Open Questions
- Ligature conflicts with cursor/selection: prefer overlays (cursor/selection drawn on top).
- Local fonts permission UX and caching policy.

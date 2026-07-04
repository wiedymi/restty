# API Surface Map

This page documents the current module boundaries.

## Stable entry point

Use `restty` unless you explicitly need lower-level control.

```ts
import { Restty, createRestty } from "restty";
```

Primary exports:
- `Restty`
- `createRestty(options)`
- `ResttyPaneHandle`
- `RESTTY_PLUGIN_API_VERSION`
- Theme helpers: `getBuiltinTheme`, `parseGhosttyTheme`, `listBuiltinThemeNames`, ...
- Font input types: `ResttyFontInput`, `ResttyFontFamilyInput`, `ResttyFontUrlInput`, ...
- Runtime/config types: `ResttyTerminalConfig`, `ResttyRuntimeConfig`, `ResttyRuntimeEvent`, ...
- Plugin types: `ResttyPlugin`, `ResttyPluginContext`, `ResttyPluginInfo`, ...
- PTY helpers and types: `createWebSocketPtyTransport`, `PtyTransport`, ...

## Advanced subpath exports

These are available for specialized integrations.

- `restty/internal`
  - broad unstable barrel exposing implementation modules (renderer/grid/fonts/selection/IME/PTY/input/WASM/theme plus curated runtime/surface internals)
- `restty/internal/runtime`
  - runtime-focused unstable internals
- `restty/internal/surface`
  - surface-focused unstable internals
- `restty/xterm`
  - xterm-style compatibility `Terminal` wrapper for migration
- `restty/esm`
  - standalone browser ESM bundle for the root API
- `restty/esm/internal`
  - standalone browser ESM bundle for the internal barrel
- `restty/esm/internal/runtime`
  - standalone browser ESM bundle for runtime-focused internals
- `restty/esm/internal/surface`
  - standalone browser ESM bundle for surface-focused internals
- `restty/esm/xterm`
  - standalone browser ESM bundle for xterm compatibility

Published package exports are currently:
- `restty`
- `restty/internal`
- `restty/internal/runtime`
- `restty/internal/surface`
- `restty/xterm`
- `restty/esm`
- `restty/esm/internal`
- `restty/esm/internal/runtime`
- `restty/esm/internal/surface`
- `restty/esm/xterm`

## Compatibility expectations

- `restty` (root entry) is the primary API and should change the slowest.
- `restty/xterm` is a migration-oriented compatibility shim.
- `restty/internal` and narrower internal subpaths are intentionally unstable.
- `restty/esm*` subpaths are bundle-shape alternatives to the same root/internal/xterm surfaces.

## Design intent

- Keep common app integration ergonomic through `new Restty({ root })`.
- Keep low-level control possible through subpath modules.
- Avoid forcing users to wire canvas/IME/PTY primitives for common cases.

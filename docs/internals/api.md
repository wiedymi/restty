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
- Theme helpers: `getBuiltinTheme`, `parseGhosttyTheme`, `listBuiltinThemeNames`, ...
- Font source types: `ResttyFontSource`, `ResttyFontPreset`, ...

## Advanced subpath exports

These are available for specialized integrations.

- `restty/wasm`
  - `loadResttyWasm`, `ResttyWasm`
  - `RenderState`, `CursorInfo`, ABI types
- `restty/pty`
  - `createPtyConnection`, `connectPty`, `disconnectPty`, `createWebSocketPtyTransport`
  - PTY transport/types
- `restty/input`
  - `createInputHandler`
  - key/mouse/input-related types
- `restty/theme`
  - Ghostty theme parser and built-in theme catalog
- `restty/app`
  - `createResttyApp`, pane manager utilities, app/session types
- `restty/fonts`, `restty/renderer`, `restty/grid`, `restty/selection`, `restty/ime`
  - lower-level building blocks used by app/runtime code
- `restty/internal`
  - broad internal barrel exposing most implementation modules
- `restty/xterm`
  - xterm-style compatibility `Terminal` wrapper for migration

## Compatibility expectations

- `restty` (root entry) is the primary API and should change the slowest.
- Subpath modules are for advanced users and may evolve faster.
- `restty/internal` is intentionally internal and least stable.

## Design intent

- Keep common app integration ergonomic through `new Restty({ root })`.
- Keep low-level control possible through subpath modules.
- Avoid forcing users to wire canvas/IME/PTY primitives for common cases.

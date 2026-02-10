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

- `restty/internal`
  - broad internal barrel exposing most implementation modules (surface/runtime/renderer/input/pty/etc.)
- `restty/xterm`
  - xterm-style compatibility `Terminal` wrapper for migration

Published package exports are currently:
- `restty`
- `restty/internal`
- `restty/xterm`

## Compatibility expectations

- `restty` (root entry) is the primary API and should change the slowest.
- `restty/xterm` is a migration-oriented compatibility shim.
- `restty/internal` is intentionally internal and least stable.

## Design intent

- Keep common app integration ergonomic through `new Restty({ root })`.
- Keep low-level control possible through subpath modules.
- Avoid forcing users to wire canvas/IME/PTY primitives for common cases.

# Changelog

All notable changes to this project are documented here.

This project follows SemVer. While restty is pre-1.0, breaking public API changes increment the minor version.

## [Unreleased]

### Breaking Changes

### Migration

### Features

### Fixes

### Internal

### Playground

### Docs

## [0.2.7] - 2026-09-05

### Fixes

- Copy the full text selection across scrollback, including offscreen rows and blank lines, while preserving the viewport and selection (#35).

## [0.2.6] - 2026-07-17

### Fixes

- Updated text-shaper to 0.1.28 so Apple Color Emoji's AAT `morx` ligatures compose regional-indicator flags, keycaps, ZWJ families, rainbow flags, and skin-tone sequences into single color glyphs, with spec-correct no-op substitutions and hardened action-stack and parser-boundary handling.

## [0.2.5] - 2026-07-16

### Fixes

- Updated text-shaper to 0.1.27 so Unicode variation sequences use cmap format 14 mappings and surviving selectors are removed before positioning, restoring VS16 color emoji rendering and preserving adjacent kerning.

## [0.2.4] - 2026-07-16

### Fixes

- Matched Ghostty's default em-normalized `ic_width` adjustment for fallback fonts, using the primary printable-ASCII box and the fallback ideograph advance to remove excessive spacing around CJK glyphs while preserving their shared baseline and two-cell bound.

## [0.2.3] - 2026-07-16

### Fixes

- Rendered wide CJK fallbacks at the primary font's em size instead of shrinking them to the fallback face's taller line metrics, reducing excessive spacing while retaining two-cell fit and centered placement.

## [0.2.2] - 2026-07-16

### Fixes

- Kept ordinary fallback text on the primary font baseline after fallback scaling, eliminating the roughly one-pixel downward shift for CJK glyphs introduced in 0.2.1.

## [0.2.1] - 2026-07-16

### Fixes

- Kept wide CJK fallback glyphs at their natural em scale instead of enlarging them to fill two cells, and centered them across their occupied cells for consistent baseline and sizing in both WebGPU and WebGL2.
- Skipped fallback fonts whose claimed glyph rasterizes without visible coverage, allowing later CJK fallbacks to render instead of leaving blank text with fonts such as variable PingFang.
- Updated text-shaper to support current Noto Emoji WOFF2 fonts whose outlines use compact `255UInt16` encodings.

## [0.2.0] - 2026-07-04

### Breaking Changes

- Reworked the public configuration shape around explicit `surface`, `terminal`, and `services` sections. Terminal rendering/input options now live under `terminal`, pane shell behavior lives under `surface`, and PTY/hooks/callbacks live under `services`.
- Replaced raw pane/runtime escape hatches in app-facing APIs with stable `ResttyPaneHandle` methods and active-pane convenience methods on `Restty`. Low-level modules are still available through `restty/internal`, `restty/internal/runtime`, and `restty/internal/surface`, but those subpaths are intentionally unstable.
- Replaced legacy font source shapes with the new `terminal.fonts` input model. Old `appOptions.fontSources` and `fontPreset` style configuration is no longer accepted.

### Migration

- Move flat runtime options into the new grouped config:

  ```ts
  // Before
  new Restty({
    root,
    renderer: "auto",
    fontSize: 16,
    ptyTransport,
  });

  // After
  new Restty({
    root,
    terminal: {
      renderer: "auto",
      fontSize: 16,
    },
    services: {
      ptyTransport,
    },
  });
  ```

- Move pane shell options into `surface`:

  ```ts
  new Restty({
    root,
    surface: {
      searchUi: true,
      shortcuts: true,
      defaultContextMenu: true,
    },
  });
  ```

- Move font configuration to `terminal.fonts`:

  ```ts
  new Restty({
    root,
    terminal: {
      fonts: [
        { family: "JetBrains Mono", local: "prefer", fallback: "/fonts/JetBrainsMono-Regular.ttf" },
        "/fonts/SymbolsNerdFont-Regular.ttf",
      ],
    },
  });
  ```

- Prefer `restty.panes()`, `restty.activePane()`, `restty.focusedPane()`, and `restty.pane(id)` for pane handles. Use active-pane convenience methods such as `restty.connectPty(...)`, `restty.setFontSize(...)`, `restty.openSearch(...)`, and `restty.sendInput(...)` when you only need to target the active pane.
- Use `restty/headless` for DOM-free terminal state, replay, and backend-owned sessions. If a browser pane passively renders a backend-owned/headless session, set `terminal.forwardTerminalReplies` to `false`.
- Use `restty/esm` only when you need the standalone single-file browser ESM bundle. Normal bundler users should keep importing from `restty`.

### Features

- Added the new native `Restty`/`createRestty` surface API with multi-pane layout, pane handles, active-pane helpers, pane style controls, default context menus, and lifecycle events.
- Added `restty/headless` for DOM-free WASM terminal usage with snapshots, bounded replay journals, resize/write replay, terminal reply draining, Kitty state inspection, and WASM search controls.
- Added built-in pane search UI and pane-local search APIs, including active-pane helpers, pane-handle methods, callbacks, themed match colors, and WASM-backed search state.
- Added a plugin runtime with manifest loading, plugin diagnostics, lifecycle hooks, input/output interceptors, render hooks, and managed shader stage handles.
- Added standalone browser ESM output at `restty/esm`; the package now ships the normal library entrypoints plus one self-contained ESM bundle for direct browser/CDN usage.
- Added programming ligatures, runtime ligature toggles, font hinting controls, `fontSizeMode`, Local Font Access inputs, richer fallback font inputs, and shared font resource reuse across panes.
- Added configurable scrollback limits through `maxScrollbackBytes`.
- Added desktop multi-click selection, word/line selection, touch selection modes, and drag selection behavior for longer scrollback selections.
- Added xterm-style compatibility improvements, including buffered writes before `open(...)`, callbacks, resize events, addon activation/disposal, and native `Restty` access for gradual migration.

### Fixes

- Auto-scroll the viewport while drag-selecting text past the top or bottom terminal edge, matching Ghostty-style long selection across scrollback.
- Support common shell navigation keys in the default keyboard mapper: Ctrl+A/E and Home/End are covered by regression tests, and Ctrl/Cmd+Left/Right now emit readline-compatible word-jump sequences outside Kitty keyboard protocol mode.
- Updated the Ghostty/libvt Kitty runtime reference and rebuilt the embedded WASM so Kitty graphics and terminal protocol behavior track current upstream more closely.
- Reworked Kitty graphics handling for file-medium rewrites, direct-medium placement, unicode placeholder placement, chunk boundaries, echoed response filtering, and invalid control sanitization.
- Render symbol/nerd fallback fonts at the primary font's em size, matching Ghostty's same-point-size rule instead of normalizing each fallback by its own line height.
- Fix the `fit_cover1` glyph constraint's multi-cell upscale cap double-applying `relative_width`/`relative_height`, which undersized icons whose constraint defines a relative scale group.
- Switch the default symbols fallback to `SymbolsNerdFont-Regular.ttf` (the non-Mono variant Ghostty embeds); the Mono variant draws icons larger within the em, diverging from Ghostty's icon sizing.
- Broaden emoji and symbol fallback classification, including concatenated font filename labels and emoji-like symbol ranges.
- Feed PTY output to the terminal as it arrives instead of coalescing through 10ms/40ms flush timers; presentation now coalesces in the render loop, removing the ~25fps ceiling during sustained output.
- Hold presentation at frame time while synchronized output (mode 2026) is active instead of dropping frames whose data ended mid-update; the frame right after the end sequence now presents immediately.
- Accumulate mouse wheel deltas by cell size for app mouse reporting, emitting one report per scrolled cell instead of one per DOM wheel event, and add horizontal wheel reports.
- Present dirty foreground frames on every animation frame; the previous elapsed-time FPS budget quantized against vsync and skipped frames on high-refresh displays.
- Fix pointer mapping when canvas CSS scale differs from device pixel ratio.
- Use the native Cmd+V paste path with IME input while keeping macOS Ctrl+V available for TUI bindings.
- Keep IME preedit overlays readable and avoid hiding the focused IME textarea from accessibility APIs.
- Stabilize pane initialization, cursor reporting, resize timing, hyperlink resize handling, terminal reply routing, and queued runtime IO before lifecycle readiness.

### Internal

- Updated the publish workflow to be tag-driven, validate package/changelog consistency, require annotated release tags, publish with npm provenance, and create or update the GitHub Release from `CHANGELOG.md`.
- Reduced package distribution size by keeping React, React DOM, React Router, Fumadocs, and playground-only shell dependencies in `devDependencies`; `text-shaper` remains the runtime dependency.
- Reworked the embedded WASM packaging path and removed dead generated asset paths.
- Split runtime and surface internals into narrower modules and contracts, with architecture tests guarding module boundaries and public export ownership.
- Curated unstable internal exports under `restty/internal`, `restty/internal/runtime`, and `restty/internal/surface`.

### Playground

- Replaced the legacy playground shell with the React Router and Fumadocs docs app used by the hosted documentation.
- Default the playground to the Just Bash backend and lazy-load WebContainer only when selected.
- Restore and expand terminal demos, bundled fonts, shader presets, split dividers, theme backgrounds, and pane/search controls.
- Bundle `SymbolsNerdFont-Regular.ttf` (non-Mono) as the symbols fallback font instead of `SymbolsNerdFontMono-Regular.ttf`.
- Document Cloudflare Pages build settings for the hosted playground/docs.

### Docs

- Rebuilt the README around the new public API, entrypoints, and canonical hosted docs.
- Added or refreshed docs for getting started, configuration, API surface, surface and panes, PTY backends, headless mode, search, fonts, themes and shaders, plugins, xterm compatibility, troubleshooting, architecture, and runnable examples.

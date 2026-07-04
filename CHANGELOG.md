# Changelog

All notable changes to this project are documented here.

This project follows SemVer. While restty is pre-1.0, breaking public API changes increment the minor version.

## [Unreleased]

### Breaking Changes

### Migration

### Features

### Fixes

- Auto-scroll the viewport while drag-selecting text past the top or bottom terminal edge, matching Ghostty-style long selection across scrollback.
- Support common shell navigation keys in the default keyboard mapper: Ctrl+A/E and Home/End are covered by regression tests, and Ctrl/Cmd+Left/Right now emit readline-compatible word-jump sequences outside Kitty keyboard protocol mode.
- Render symbol/nerd fallback fonts at the primary font's em size (matching Ghostty's same-point-size rule) instead of normalizing each font by its own line height; Nerd Font icons no longer render up to ~30% oversized, filling the full two-cell span and swallowing the following space.
- Fix the `fit_cover1` glyph constraint's multi-cell upscale cap double-applying `relative_width`/`relative_height`, which undersized icons whose constraint defines a relative scale group.
- Switch the default symbols fallback to `SymbolsNerdFont-Regular.ttf` (the non-Mono variant Ghostty embeds); the Mono variant draws icons larger within the em, diverging from Ghostty's icon sizing.
- Feed PTY output to the terminal as it arrives instead of coalescing through 10ms/40ms flush timers; presentation now coalesces in the render loop, removing the ~25fps ceiling during sustained output (fast scrolling in nvim and similar TUIs).
- Hold presentation at frame time while synchronized output (mode 2026) is active instead of dropping frames whose data ended mid-update; the frame right after the end sequence now presents immediately.
- Accumulate mouse wheel deltas by cell size for app mouse reporting (matching precision-scroll handling in the local viewport path), emitting one report per scrolled cell instead of one per DOM wheel event, and add horizontal wheel reports (buttons 66/67).
- Present dirty foreground frames on every animation frame; the previous elapsed-time FPS budget quantized against vsync and skipped frames on high-refresh displays.

### Internal

### Playground

- Bundle `SymbolsNerdFont-Regular.ttf` (non-Mono) as the symbols fallback font instead of `SymbolsNerdFontMono-Regular.ttf`.

### Docs

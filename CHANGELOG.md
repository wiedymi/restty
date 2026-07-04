# Changelog

All notable changes to this project are documented here.

This project follows SemVer. While restty is pre-1.0, breaking public API changes increment the minor version.

## [Unreleased]

### Breaking Changes

### Migration

### Features

### Fixes

- Feed PTY output to the terminal as it arrives instead of coalescing through 10ms/40ms flush timers; presentation now coalesces in the render loop, removing the ~25fps ceiling during sustained output (fast scrolling in nvim and similar TUIs).
- Hold presentation at frame time while synchronized output (mode 2026) is active instead of dropping frames whose data ended mid-update; the frame right after the end sequence now presents immediately.
- Accumulate mouse wheel deltas by cell size for app mouse reporting (matching precision-scroll handling in the local viewport path), emitting one report per scrolled cell instead of one per DOM wheel event, and add horizontal wheel reports (buttons 66/67).
- Present dirty foreground frames on every animation frame; the previous elapsed-time FPS budget quantized against vsync and skipped frames on high-refresh displays.

### Internal

### Playground

### Docs

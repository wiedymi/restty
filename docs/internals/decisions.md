# Architecture Decisions

## Rendering Mode
- Default: grayscale atlas with hinting.
- Optional: LCD subpixel atlas (toggle).
- No SDF/MSDF path (removed; raster atlas only).

## Ligatures
- Enabled by default.
- Draw shaped glyphs across cell ranges and skip per-cell glyphs in that span.
- Cursor/selection rendered as overlays to avoid breaking ligatures.

## Fonts
- Bundle JetBrains Mono (OFL-1.1).
- Allow local fonts via queryLocalFonts (Chromium only, user gesture).

## WASM Strategy
- Keep a small Zig adapter over the upstream terminal API and retain bulk typed-array reads.
- Use upstream stream processing, text formatting, and whole-terminal search.
- Pin Zig 0.16.0 and compile ReleaseSafe with WASM SIMD128.
- Keep only the explicit browser graphics opt-in and unsupported file-media guard in the Ghostty fork.
- Decode PNGs through Wuffs; use browser time for image animations.
- Embed WASM in the JS bundle and rebuild it in CI and release jobs.

## Rendering Backend
- WebGPU primary; WebGL2 fallback.
- Keep shader and buffer layout compatible across backends.

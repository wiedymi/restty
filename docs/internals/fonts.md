# Font Strategy

## Default Font
- Bundle JetBrains Mono (OFL-1.1) as default ligature-capable font.
- Provide a fallback mono stack (CSS for DOM controls / non-gpu text).

## Local Fonts (Chromium)
- Use `queryLocalFonts()` when available and user grants permission.
- Only invoke from a user gesture (button/action).
- Cache the chosen font metadata + binary in IndexedDB if allowed.
- Fallback to bundled font if permission denied or unavailable.

## Font Loading
- Load font binaries via fetch (bundled) or File API / local font API.
- Use text-shaper `Font.load(arrayBuffer)`.
- Support variable fonts (optional) using `Face` if needed.

## Font Selection
- Provide a custom API:
  - `setFont({ source: 'bundled' | 'local', name, data })`
  - `setFontSize(px)`
  - `setFontFeatures({ liga, calt, kern, ... })`

## Metrics
- Compute cell metrics from font data:
  - `cellHeight = ascender - descender + lineGap`
  - `cellWidth = advanceWidth('M')` or measured average if configured.

## Fallback Fonts
- If glyph missing, fallback to another font and re-shape the run.
- Keep separate atlas per font to avoid mixed metrics.
- Bundle a symbols-only Nerd Font (monospace) as a dedicated fallback for icon glyphs.

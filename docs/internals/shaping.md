# Text Shaping and Ligature Strategy

## Goals
- Support complex scripts (Arabic, Indic, etc.).
- Support ligatures by default.
- Preserve terminal grid semantics (cell-aligned selection/cursor).

## Data Sources
- RenderState provides:
  - per-cell codepoint + grapheme slice
  - style id
  - wide cell info

## Shaping Pipeline
1. Build **row runs** grouped by:
   - font family + weight + style
   - size
   - fg/bg/underline style (optional, can be split earlier or later)
2. For each run, build a `UnicodeBuffer`:
   - For each cell in run:
     - Add base codepoint (from cell).
     - If grapheme data exists, append remaining codepoints to same cluster.
   - Cluster id equals **cell index within row**. For wide chars, cluster id is
     the starting cell; the following spacer tail cell is excluded.
3. Call `shapeInto(font, buffer, glyphBuffer, { features: liga/calt/etc. })`.
4. Build a **glyph -> cell span** mapping:
   - Use `glyphBuffer.infos[i].cluster` as the start cell index.
   - Compute the end cell index by looking at the next cluster boundary or the
     run end.
   - Result: (start_cell, end_cell, glyph_id, xAdvance, offsets).

## Ligature Rendering Rule
- Draw glyphs from shaped output, not per-cell glyphs.
- For cells covered by a multi-cell ligature, **skip per-cell glyphs**.
- Cursor and selection remain cell-based and are drawn **after** background
  but **before** glyphs (selection) and **after** glyphs (cursor), as overlays.

## Cursor and Selection
- Selection uses cell rectangles (not glyph bounds).
- Cursor uses cell bounds but offsets if wide-tail cell.

## Script/Direction Handling
- Use text-shaper's script/direction detection when needed.
- Default direction for terminal is LTR, but BiDi runs are shaped with
  `direction: rtl` when detected per-run.

## Performance Notes
- Reuse `UnicodeBuffer` and `GlyphBuffer` instances.
- Cache shaped runs by (text hash, style, font, size) when possible.
- Shape only dirty rows when RenderState provides dirty rows.

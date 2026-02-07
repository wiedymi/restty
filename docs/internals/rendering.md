# Rendering Architecture (WebGPU + WebGL2)

## Goals
- GPU-first text rendering with minimal CPU overhead.
- Support per-cell backgrounds, selection, cursor, decorations.
- Use a shared glyph atlas (grayscale by default, LCD optional).

## Render Passes
1. **Background pass**
   - Draw per-cell quads with background colors.
   - Apply selection highlight overlay (rectangles).
2. **Glyph pass**
   - Draw glyphs as textured quads from atlas.
   - Use instanced rendering for batches.
3. **Decoration pass**
   - Underlines, strikethrough, overline.
4. **Cursor pass**
   - Block, bar, or underline cursor with blink state.

## WebGPU Pipeline
- Vertex buffer: unit quad.
- Instance buffer per glyph:
  - x, y (pixels)
  - w, h (pixels)
  - uv rect in atlas
  - color (RGBA)
- Bind groups:
  - atlas texture + sampler
  - uniform: viewport size, cell size

## WebGL2 Fallback
- Same data layout as WebGPU.
- Use instancing (ANGLE_instanced_arrays when needed).
- Keep shaders equivalent to minimize divergence.

## Glyph Atlas Strategy
- Start with grayscale atlas (PixelMode.Gray).
- Optional LCD atlas (PixelMode.LCD) using separate shader path.
- Support atlas resizing + LRU eviction when full.
- Update subregions via `queue.writeTexture` (WebGPU) or `texSubImage2D` (WebGL).

## Cell Metrics
- `cellWidth` and `cellHeight` derived from font metrics:
  - Use text-shaper's font ascender/descender + lineGap.
- Align glyph baseline within cell using font ascent.

## Dirty Rendering
- If RenderState exposes dirty rows, only update instance buffers for dirty rows.
- Full redraw on palette change, resize, or full dirty flag.

## Color Handling
- Colors are resolved in WASM based on palette + style, or in JS if style IDs
  are passed and palette is available.
- Underline color falls back to foreground when unset.

## HDR / Color Space
- Use sRGB textures and linearize in shader if needed.

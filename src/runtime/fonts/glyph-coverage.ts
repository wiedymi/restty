import type { Font, FontSizeMode } from "../../fonts";
import type { GlyphRasterizeOptions, RasterizedGlyph } from "text-shaper";

export type GlyphCoverageRasterizer = (
  font: Font,
  glyphId: number,
  fontSize: number,
  options?: GlyphRasterizeOptions,
) => RasterizedGlyph | null;

export type GlyphCoverageProbeOptions = {
  font: Font;
  glyphId: number;
  sizeMode: FontSizeMode;
  rasterizeGlyph: GlyphCoverageRasterizer;
};

/** Check whether a claimed glyph can produce visible raster coverage. */
export function glyphHasVisibleRaster(options: GlyphCoverageProbeOptions): boolean {
  const { font, glyphId, sizeMode, rasterizeGlyph } = options;
  if (!glyphId) return false;

  try {
    const raster = rasterizeGlyph(font, glyphId, 32, {
      padding: 0,
      sizeMode,
      hinting: false,
    });
    const bitmap = raster?.bitmap;
    if (!bitmap?.width || !bitmap.rows || !bitmap.buffer?.length) return false;
    return bitmap.buffer.some((value) => value !== 0);
  } catch {
    return false;
  }
}

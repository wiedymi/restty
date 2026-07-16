export type WideFallbackScaleOptions = {
  scale: number;
  advanceUnits: number;
  cellWidth: number;
  maxSpan: number;
};

/** Resolve the raster scale used for a fallback that may occupy multiple cells. */
export function resolveWideFallbackScale(options: WideFallbackScaleOptions): number {
  const { scale, advanceUnits, cellWidth, maxSpan } = options;
  if (maxSpan <= 1) return scale;
  const widthPx = advanceUnits * scale;
  const widthAdjustRaw = widthPx > 0 ? (cellWidth * maxSpan) / widthPx : 1;
  const widthAdjust = Math.max(0.5, Math.min(1, widthAdjustRaw));
  return scale * widthAdjust;
}

export type FallbackGlyphCenterOptions = {
  cellX: number;
  cellWidth: number;
  glyphWidth: number;
  isFallback: boolean;
  glyphCount: number;
  symbolLike: boolean;
};

/** Return a centered fallback glyph x position, or null when normal placement applies. */
export function resolveFallbackGlyphCenterX(options: FallbackGlyphCenterOptions): number | null {
  const { cellX, cellWidth, glyphWidth, isFallback, glyphCount, symbolLike } = options;
  if (!isFallback || glyphCount !== 1 || symbolLike) {
    return null;
  }
  return cellX + (cellWidth - glyphWidth) * 0.5;
}

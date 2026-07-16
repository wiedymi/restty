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

export type FallbackTextScaleOptions = {
  baseScale: number;
  primaryEmScale: number;
  metricAdjust: number;
  advanceUnits: number;
  cellWidth: number;
  maxSpan: number;
  fontHeightUnits: number;
  lineHeight: number;
};

/** Resolve the raster scale used for an ordinary fallback text face. */
export function resolveFallbackTextScale(options: FallbackTextScaleOptions): number {
  const {
    baseScale,
    primaryEmScale,
    metricAdjust,
    advanceUnits,
    cellWidth,
    maxSpan,
    fontHeightUnits,
    lineHeight,
  } = options;
  if (maxSpan > 1 && primaryEmScale > 0) {
    return resolveWideFallbackScale({
      scale: primaryEmScale,
      advanceUnits,
      cellWidth,
      maxSpan,
    });
  }
  let scale = baseScale * metricAdjust;
  const heightPx = fontHeightUnits * scale;
  if (heightPx > lineHeight && heightPx > 0) scale *= lineHeight / heightPx;
  return scale;
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

export type FallbackBaselineAdjustOptions = {
  primaryScale: number;
  fallbackScale: number;
  primaryAscender: number;
  fallbackAscender: number;
  regularTextFallback: boolean;
};

/** Resolve the vertical offset applied to a fallback glyph baseline. */
export function resolveFallbackBaselineAdjust(options: FallbackBaselineAdjustOptions): number {
  const { primaryScale, fallbackScale, primaryAscender, fallbackAscender, regularTextFallback } =
    options;
  if (regularTextFallback) return 0;
  return primaryAscender * primaryScale - fallbackAscender * fallbackScale;
}

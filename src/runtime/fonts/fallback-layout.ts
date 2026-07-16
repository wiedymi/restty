import type { Font } from "../../fonts";

type FallbackFaceMetrics = {
  unitsPerEm: number;
  ascender: number;
  lineHeight: number;
  cellWidth: number;
  asciiHeight: number;
  icWidth: number;
  exHeight: number;
  capHeight: number;
};

const fallbackFaceMetricsCache = new WeakMap<Font, FallbackFaceMetrics>();

function positive(value: number | null | undefined): number {
  return Number.isFinite(value) && (value ?? 0) > 0 ? (value ?? 0) : 0;
}

function glyphHeight(font: Font, ch: string): number {
  const glyphId = font.glyphIdForChar(ch);
  if (!glyphId) return 0;
  const bounds = font.getGlyphBounds(glyphId);
  if (!bounds) return 0;
  return positive(bounds.yMax - bounds.yMin);
}

function measureFallbackFace(font: Font): FallbackFaceMetrics {
  const cached = fallbackFaceMetricsCache.get(font);
  if (cached) return cached;

  let cellWidth = 0;
  let asciiTop = 0;
  let asciiBottom = 0;
  for (let codepoint = 32; codepoint < 127; codepoint += 1) {
    const glyphId = font.glyphIdForChar(String.fromCodePoint(codepoint));
    if (!glyphId) continue;
    cellWidth = Math.max(cellWidth, positive(font.advanceWidth(glyphId)));
    const bounds = font.getGlyphBounds(glyphId);
    if (!bounds) continue;
    if (Number.isFinite(bounds.yMax)) asciiTop = Math.max(asciiTop, bounds.yMax);
    if (Number.isFinite(bounds.yMin)) asciiBottom = Math.min(asciiBottom, bounds.yMin);
  }

  let icWidth = 0;
  const ideographGlyphId = font.glyphIdForChar("水");
  if (ideographGlyphId) {
    const advance = positive(font.advanceWidth(ideographGlyphId));
    const bounds = font.getGlyphBounds(ideographGlyphId);
    const outlineWidth = bounds ? positive(bounds.xMax - bounds.xMin) : 0;
    if (advance > 0 && (outlineWidth <= 0 || outlineWidth <= advance)) icWidth = advance;
  }

  const metrics = {
    unitsPerEm: positive(font.unitsPerEm),
    ascender: positive(font.ascender),
    lineHeight: positive(font.height),
    cellWidth,
    asciiHeight: positive(asciiTop - asciiBottom),
    icWidth,
    exHeight: positive(font.os2?.sxHeight) || glyphHeight(font, "x"),
    capHeight: positive(font.os2?.sCapHeight) || glyphHeight(font, "H"),
  };
  fallbackFaceMetricsCache.set(font, metrics);
  return metrics;
}

function capHeight(metrics: FallbackFaceMetrics): number {
  return metrics.capHeight || metrics.ascender * 0.75;
}

function exHeight(metrics: FallbackFaceMetrics): number {
  return metrics.exHeight || capHeight(metrics) * 0.75;
}

function icWidth(metrics: FallbackFaceMetrics): number {
  if (metrics.icWidth > 0) return metrics.icWidth;
  const asciiHeight = metrics.asciiHeight || capHeight(metrics) * 1.5;
  return Math.min(asciiHeight, metrics.cellWidth * 2);
}

function normalizedMetricFactor(
  primaryMetric: number,
  primary: FallbackFaceMetrics,
  fallbackMetric: number,
  fallback: FallbackFaceMetrics,
): number {
  if (
    primaryMetric <= 0 ||
    fallbackMetric <= 0 ||
    primary.unitsPerEm <= 0 ||
    fallback.unitsPerEm <= 0
  ) {
    return 1;
  }
  const factor = primaryMetric / primary.unitsPerEm / (fallbackMetric / fallback.unitsPerEm);
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

/** Match Ghostty's default ic-width fallback size adjustment. */
export function resolveFallbackScaleAdjustment(
  primaryFont: Font | null | undefined,
  fallbackFont: Font | null | undefined,
): number {
  if (!primaryFont || !fallbackFont) return 1;
  const primary = measureFallbackFace(primaryFont);
  const fallback = measureFallbackFace(fallbackFont);

  // Ghostty only uses ic-width when the fallback has a valid explicit 水
  // advance. Otherwise it falls through ex-height, cap-height, and
  // finally line-height while estimating the corresponding primary metric.
  if (fallback.icWidth > 0) {
    return normalizedMetricFactor(icWidth(primary), primary, fallback.icWidth, fallback);
  }
  if (fallback.exHeight > 0) {
    return normalizedMetricFactor(exHeight(primary), primary, fallback.exHeight, fallback);
  }
  if (fallback.capHeight > 0) {
    return normalizedMetricFactor(capHeight(primary), primary, fallback.capHeight, fallback);
  }
  return normalizedMetricFactor(primary.lineHeight, primary, fallback.lineHeight, fallback);
}

/** Return a face's valid explicit ideograph advance, if it has one. */
export function resolveFallbackIcWidth(font: Font | null | undefined): number {
  return font ? measureFallbackFace(font).icWidth : 0;
}

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
  let scale = (primaryEmScale > 0 ? primaryEmScale : baseScale) * metricAdjust;
  if (maxSpan > 1) {
    return resolveWideFallbackScale({
      scale,
      advanceUnits,
      cellWidth,
      maxSpan,
    });
  }
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

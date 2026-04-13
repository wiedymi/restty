export const OVERLAY_SCROLLBAR_WIDTH_CSS_PX = 7;
export const OVERLAY_SCROLLBAR_MARGIN_CSS_PX = 4;
export const OVERLAY_SCROLLBAR_INSET_Y_CSS_PX = 2;
export const OVERLAY_SCROLLBAR_MIN_THUMB_CSS_PX = 28;

export type OverlayScrollbarLayout = {
  total: number;
  offset: number;
  len: number;
  denom: number;
  width: number;
  trackX: number;
  trackY: number;
  trackH: number;
  thumbY: number;
  thumbH: number;
};

export function computeOverlayScrollbarLayout(
  total: number,
  offset: number,
  len: number,
  canvasWidth: number,
  canvasHeight: number,
  currentDpr: number,
): OverlayScrollbarLayout | null {
  if (!(total > len && len > 0)) return null;
  const dpr = Math.max(1, currentDpr || 1);
  const width = Math.max(1, Math.round(OVERLAY_SCROLLBAR_WIDTH_CSS_PX * dpr));
  const margin = Math.max(1, Math.round(OVERLAY_SCROLLBAR_MARGIN_CSS_PX * dpr));
  const insetY = Math.max(0, Math.round(OVERLAY_SCROLLBAR_INSET_Y_CSS_PX * dpr));
  const trackX = Math.max(0, canvasWidth - margin - width);
  const trackY = insetY;
  const trackH = Math.max(width, canvasHeight - insetY * 2);
  const denom = Math.max(1, total - len);
  const dynamicThumbH = Math.round(trackH * (len / total));
  const minThumbH = Math.max(width, Math.round(OVERLAY_SCROLLBAR_MIN_THUMB_CSS_PX * dpr));
  const thumbH = Math.min(trackH, Math.max(minThumbH, dynamicThumbH));
  const thumbY = trackY + Math.round((offset / denom) * (trackH - thumbH));
  return { total, offset, len, denom, width, trackX, trackY, trackH, thumbY, thumbH };
}

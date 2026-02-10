import { clamp, fontHeightUnits } from "../../grid";
import type { Font } from "../../fonts";
import type { GlyphConstraintMeta, AtlasConstraintContext } from "../atlas-builder";

const NERD_CELL_FIT_COVER_SCALE = 1.0;
const NERD_ICON_FIT_COVER_SCALE = 2 / 3;

export function resolveFontScaleForAtlas(
  font: Font | null | undefined,
  fontSize: number,
  sizeMode?: "em" | "height" | null,
): number {
  if (font && typeof font.scaleForSize === "function") {
    return font.scaleForSize(fontSize, sizeMode ?? undefined);
  }
  const upem = font?.unitsPerEm ?? 1000;
  return upem > 0 ? fontSize / upem : 1;
}

export function fontCapHeightUnits(font: Font | null | undefined): number {
  if (!font) return 1;

  const capFromOs2 = font?.os2?.sCapHeight ?? font?._os2?.sCapHeight;
  if (Number.isFinite(capFromOs2) && capFromOs2 > 0) return capFromOs2;

  if (typeof font.glyphIdForChar === "function" && typeof font.getGlyphBounds === "function") {
    const capGlyphId = font.glyphIdForChar("H");
    if (capGlyphId !== undefined && capGlyphId !== null && capGlyphId !== 0) {
      const bounds = font.getGlyphBounds(capGlyphId);
      const yMax = bounds?.yMax;
      if (Number.isFinite(yMax) && yMax > 0) return yMax;
      const height = (bounds?.yMax ?? 0) - (bounds?.yMin ?? 0);
      if (Number.isFinite(height) && height > 0) return height;
    }
  }

  const ascender = font?.ascender;
  if (Number.isFinite(ascender) && ascender > 0) return ascender * 0.75;

  const faceHeight = fontHeightUnits(font);
  if (Number.isFinite(faceHeight) && faceHeight > 0) return faceHeight * 0.6;

  return 1;
}

export function buildNerdMetrics(
  cellW: number,
  cellH: number,
  lineHeight: number,
  primaryFont: Font | null | undefined,
  primaryScale: number,
  iconScale: number,
) {
  let faceWidth = cellW;
  if (
    primaryFont &&
    typeof primaryFont.glyphIdForChar === "function" &&
    typeof primaryFont.advanceWidth === "function"
  ) {
    const mGlyphId = primaryFont.glyphIdForChar("M");
    if (mGlyphId !== undefined && mGlyphId !== null && mGlyphId !== 0) {
      const width = primaryFont.advanceWidth(mGlyphId) * primaryScale;
      if (Number.isFinite(width) && width > 0) faceWidth = width;
    }
  }

  const capHeight = fontCapHeightUnits(primaryFont) * primaryScale;
  const safeIconScale = Number.isFinite(iconScale) ? Math.max(0.5, Math.min(2, iconScale)) : 1;
  const iconHeight = lineHeight * safeIconScale;
  const iconHeightSingle = clamp(((2 * capHeight + lineHeight) / 3) * safeIconScale, 1, iconHeight);

  return {
    cellWidth: cellW,
    cellHeight: cellH,
    faceWidth,
    faceHeight: lineHeight,
    faceY: (cellH - lineHeight) * 0.5,
    iconHeight,
    iconHeightSingle,
  };
}

export function nerdConstraintSignature(
  glyphMeta?: Map<number, GlyphConstraintMeta>,
  constraintContext?: AtlasConstraintContext | null,
): string {
  if (!glyphMeta?.size || !constraintContext) return "";
  const m = constraintContext.nerdMetrics;
  return [
    `ih:${m.iconHeight.toFixed(3)}`,
    `ih1:${m.iconHeightSingle.toFixed(3)}`,
    `iw:${m.cellWidth.toFixed(3)}`,
    `cw:${constraintContext.cellW.toFixed(3)}`,
    `ch:${constraintContext.cellH.toFixed(3)}`,
    `is:${NERD_ICON_FIT_COVER_SCALE.toFixed(4)}`,
    `cs:${NERD_CELL_FIT_COVER_SCALE.toFixed(4)}`,
  ].join("|");
}

function scaleGlyphBoxAroundCenter(
  box: { x: number; y: number; width: number; height: number },
  factor: number,
) {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-6) return box;
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;
  const w = box.width * factor;
  const h = box.height * factor;
  return {
    x: cx - w * 0.5,
    y: cy - h * 0.5,
    width: w,
    height: h,
  };
}

function scaleGlyphBoxAnchoredLeft(
  box: { x: number; y: number; width: number; height: number },
  factor: number,
) {
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-6) return box;
  const w = box.width * factor;
  const h = box.height * factor;
  return {
    x: box.x,
    y: box.y + (box.height - h) * 0.5,
    width: w,
    height: h,
  };
}

export function tightenNerdConstraintBox(
  box: { x: number; y: number; width: number; height: number },
  constraint: import("../../fonts").NerdConstraint | null,
) {
  if (!constraint) return box;
  if (constraint.size !== "fit_cover1") return box;
  if (constraint.height === "icon") {
    return scaleGlyphBoxAnchoredLeft(box, NERD_ICON_FIT_COVER_SCALE);
  }
  if (constraint.height !== undefined && constraint.height !== "cell") return box;
  return scaleGlyphBoxAroundCenter(box, NERD_CELL_FIT_COVER_SCALE);
}

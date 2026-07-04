import type { NerdConstraint } from "../../fonts/nerd-constraints";
import type { GlyphBox, NerdMetrics } from "./types";

/**
 * Apply a Nerd Font constraint to a glyph bounding box, adjusting size and
 * alignment to fit within the cell according to the constraint rules.
 */
export function constrainGlyphBox(
  glyph: GlyphBox,
  constraint: NerdConstraint,
  metrics: NerdMetrics,
  constraintWidth: number,
): GlyphBox {
  if (!constraint) return glyph;

  const sizeMode = constraint.size ?? "none";
  const alignH = constraint.align_horizontal ?? "none";
  const alignV = constraint.align_vertical ?? "none";
  const padLeft = constraint.pad_left ?? 0;
  const padRight = constraint.pad_right ?? 0;
  const padTop = constraint.pad_top ?? 0;
  const padBottom = constraint.pad_bottom ?? 0;
  const relW = constraint.relative_width ?? 1;
  const relH = constraint.relative_height ?? 1;
  const relX = constraint.relative_x ?? 0;
  const relY = constraint.relative_y ?? 0;
  const maxWidth = constraint.max_constraint_width ?? 2;
  const minConstraintWidth = Math.min(constraintWidth, maxWidth);

  if (glyph.width <= 0 || glyph.height <= 0) return glyph;

  const groupWidth = glyph.width / relW;
  const groupHeight = glyph.height / relH;
  let groupX = glyph.x - groupWidth * relX;
  let groupY = glyph.y - groupHeight * relY;

  // Mirrors ghostty face.zig scale_factors: computed on the group box so the
  // fit_cover1 single-cell cap can recurse without re-deriving the group.
  const scaleFactors = (constrainWidth: number): [number, number] => {
    if (sizeMode === "none") return [1, 1];

    const multiCell = constrainWidth > 1;
    const padWidthFactor = constrainWidth - (padLeft + padRight);
    const padHeightFactor = 1 - (padBottom + padTop);
    const targetWidth = padWidthFactor * metrics.faceWidth;
    const baseHeight =
      (constraint.height ?? "cell") === "icon"
        ? multiCell
          ? metrics.iconHeight
          : metrics.iconHeightSingle
        : metrics.faceHeight;
    const targetHeight = padHeightFactor * baseHeight;

    let widthFactor = targetWidth / groupWidth;
    let heightFactor = targetHeight / groupHeight;

    if (sizeMode === "fit") {
      heightFactor = Math.min(1, widthFactor, heightFactor);
      widthFactor = heightFactor;
    } else if (sizeMode === "cover") {
      heightFactor = Math.min(widthFactor, heightFactor);
      widthFactor = heightFactor;
    } else if (sizeMode === "fit_cover1") {
      // Scale down to fit, or up to cover at least one cell; multi-cell
      // upscaling is capped at the single-cell scale factor.
      heightFactor = Math.min(widthFactor, heightFactor);
      if (multiCell && heightFactor > 1) {
        const [, singleHeightFactor] = scaleFactors(1);
        heightFactor = Math.max(1, singleHeightFactor);
      }
      widthFactor = heightFactor;
    }
    // "stretch" keeps the independent width/height factors.

    if (constraint.max_xy_ratio !== undefined && constraint.max_xy_ratio !== null) {
      const ratio = constraint.max_xy_ratio;
      if (groupWidth * widthFactor > groupHeight * heightFactor * ratio) {
        widthFactor = (groupHeight * heightFactor * ratio) / groupWidth;
      }
    }

    return [widthFactor, heightFactor];
  };

  const [widthFactor, heightFactor] = scaleFactors(minConstraintWidth);

  const centerX = groupX + groupWidth * 0.5;
  const centerY = groupY + groupHeight * 0.5;
  const scaledGroupWidth = groupWidth * widthFactor;
  const scaledGroupHeight = groupHeight * heightFactor;
  groupX = centerX - scaledGroupWidth * 0.5;
  groupY = centerY - scaledGroupHeight * 0.5;

  const padBottomDy = padBottom * metrics.faceHeight;
  const padTopDy = padTop * metrics.faceHeight;
  const startY = metrics.faceY + padBottomDy;
  const endY = metrics.faceY + (metrics.faceHeight - scaledGroupHeight - padTopDy);
  const centerYAligned = (startY + endY) * 0.5;

  if (!(sizeMode === "none" && alignV === "none")) {
    if (alignV === "start") groupY = startY;
    else if (alignV === "end") groupY = endY;
    else if (alignV === "center" || alignV === "center1") groupY = centerYAligned;
    else groupY = Math.max(startY, Math.min(groupY, endY));
  }

  const padLeftDx = padLeft * metrics.faceWidth;
  const padRightDx = padRight * metrics.faceWidth;
  const fullFaceSpan = metrics.faceWidth + (minConstraintWidth - 1) * metrics.cellWidth;
  const startX = padLeftDx;
  const endX = fullFaceSpan - scaledGroupWidth - padRightDx;

  if (!(sizeMode === "none" && alignH === "none")) {
    if (alignH === "start") groupX = startX;
    else if (alignH === "end") groupX = Math.max(startX, endX);
    else if (alignH === "center") groupX = Math.max(startX, (startX + endX) * 0.5);
    else if (alignH === "center1") {
      const end1 = metrics.faceWidth - scaledGroupWidth - padRightDx;
      groupX = Math.max(startX, (startX + end1) * 0.5);
    } else {
      groupX = Math.max(startX, Math.min(groupX, endX));
    }
  }

  return {
    width: glyph.width * widthFactor,
    height: glyph.height * heightFactor,
    x: groupX + scaledGroupWidth * relX,
    y: groupY + scaledGroupHeight * relY,
  };
}

import {
  getNerdConstraint,
  glyphWidthUnits,
  type Font,
  type FontAtlas,
  type FontAtlasBitmap,
  type FontAtlasGlyphMetrics,
  type FontSizeMode,
} from "../../fonts";
import { constrainGlyphBox } from "../../renderer";
import type { GlyphConstraintMeta, AtlasConstraintContext } from "../atlas-builder";
import type {
  GlyphRasterizeOptions,
  Matrix2D,
  Matrix3x3,
  RasterizedGlyph,
} from "text-shaper";
import { cloneBitmap, copyBitmapToAtlas, createAtlasBitmap } from "./bitmap-utils";
import { packGlyphs } from "./packing-utils";
import { resolveFontScaleForAtlas, tightenNerdConstraintBox } from "./nerd-metrics-utils";

export type RasterizeGlyphTransformOptions = GlyphRasterizeOptions & {
  offsetX26?: number;
  offsetY26?: number;
};

export type RasterizeGlyphFn = (
  font: Font,
  glyphId: number,
  fontSize: number,
  options?: GlyphRasterizeOptions,
) => RasterizedGlyph | null;

export type RasterizeGlyphWithTransformFn = (
  font: Font,
  glyphId: number,
  fontSize: number,
  matrix: Matrix2D | Matrix3x3,
  options?: RasterizeGlyphTransformOptions,
) => RasterizedGlyph | null;

export type BuildGlyphAtlasWithConstraintsOptions = {
  font: Font;
  glyphIds: number[];
  fontSize: number;
  sizeMode: FontSizeMode;
  padding: number;
  maxWidth: number;
  maxHeight: number;
  pixelMode: number;
  hinting: boolean;
  rasterizeGlyph?: RasterizeGlyphFn;
  rasterizeGlyphWithTransform?: RasterizeGlyphWithTransformFn;
  glyphMeta?: Map<number, GlyphConstraintMeta>;
  constraintContext?: AtlasConstraintContext;
};

export type BuildGlyphAtlasWithConstraintsResult = {
  atlas: FontAtlas | null;
  constrainedGlyphWidths: Map<number, number> | null;
};

export function buildGlyphAtlasWithConstraints(
  options: BuildGlyphAtlasWithConstraintsOptions,
): BuildGlyphAtlasWithConstraintsResult {
  const {
    font,
    glyphIds,
    fontSize,
    sizeMode,
    padding,
    maxWidth,
    maxHeight,
    pixelMode,
    hinting,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    glyphMeta,
    constraintContext,
  } = options;

  const scale = resolveFontScaleForAtlas(font, fontSize, sizeMode);
  const glyphData: Array<{
    glyphId: number;
    bitmap: FontAtlasBitmap;
    bearingX: number;
    bearingY: number;
    advance: number;
    constraintWidth: number;
  }> = [];

  if (!rasterizeGlyph) {
    return { atlas: null, constrainedGlyphWidths: null };
  }

  const rasterOptions = {
    padding: 0,
    pixelMode,
    sizeMode,
    hinting,
  };

  for (let i = 0; i < glyphIds.length; i += 1) {
    const glyphId = glyphIds[i];
    const raster = rasterizeGlyph(font, glyphId, fontSize, rasterOptions);
    if (!raster) continue;

    let didConstraint = false;
    const meta = glyphMeta?.get(glyphId);
    const widthSet =
      meta?.widths && meta.widths.size
        ? Array.from(meta.widths.values())
        : [Math.max(1, meta?.constraintWidth ?? 1)];
    const widths = Array.from(new Set(widthSet.map((w) => Math.max(1, w)))).sort();
    const constraint = meta?.cp ? getNerdConstraint(meta.cp) : null;

    if (constraint && constraintContext && rasterizeGlyphWithTransform) {
      for (let j = 0; j < widths.length; j += 1) {
        const constraintWidth = widths[j];
        const maxCellWidth = constraintContext.cellW * constraintWidth;
        const maxCellHeight = constraintContext.cellH;
        let bitmapScale = 1;

        const widthUnits = glyphWidthUnits(constraintContext.fontEntry, glyphId);
        let glyphWidthPx = widthUnits * constraintContext.fontScale;
        if (!Number.isFinite(glyphWidthPx) || glyphWidthPx <= 0) {
          glyphWidthPx = raster.bitmap?.width ?? 0;
        }
        if (glyphWidthPx > 0 && maxCellWidth > 0) {
          const fit = maxCellWidth / glyphWidthPx;
          if (fit > 0 && fit < 1) bitmapScale = fit;
        }

        let gw = (raster.bitmap?.width ?? 0) * bitmapScale;
        let gh = (raster.bitmap?.rows ?? 0) * bitmapScale;
        if (gw > 0 && gh > 0 && maxCellWidth > 0 && maxCellHeight > 0) {
          const fitScale = Math.min(1, maxCellWidth / gw, maxCellHeight / gh);
          if (fitScale < 1) {
            bitmapScale *= fitScale;
            gw *= fitScale;
            gh *= fitScale;
          }
        }

        const baseY =
          constraintContext.yPad +
          constraintContext.baselineOffset +
          constraintContext.baselineAdjust;
        const scaledBox = {
          x: raster.bearingX * bitmapScale,
          y: baseY - raster.bearingY * bitmapScale,
          width: gw,
          height: gh,
        };
        const adjusted = constrainGlyphBox(
          scaledBox,
          constraint,
          constraintContext.nerdMetrics,
          constraintWidth,
        );
        const tightened = tightenNerdConstraintBox(adjusted, constraint);

        if (
          tightened.width > 0 &&
          tightened.height > 0 &&
          raster.bitmap?.width &&
          raster.bitmap?.rows
        ) {
          const targetLeft = tightened.x;
          const targetTop = baseY - tightened.y;
          const scaleX = tightened.width / raster.bitmap.width;
          const scaleY = tightened.height / raster.bitmap.rows;
          if (Number.isFinite(scaleX) && scaleX > 0 && Number.isFinite(scaleY) && scaleY > 0) {
            const tx = targetLeft - raster.bearingX * scaleX;
            const ty = targetTop - raster.bearingY * scaleY;
            const transformed = rasterizeGlyphWithTransform(
              font,
              glyphId,
              fontSize,
              [scaleX, 0, 0, scaleY, tx, ty],
              rasterOptions,
            );
            if (transformed) {
              glyphData.push({
                glyphId,
                bitmap: cloneBitmap(transformed.bitmap),
                bearingX: transformed.bearingX,
                bearingY: transformed.bearingY,
                advance: font.advanceWidth(glyphId) * scale,
                constraintWidth,
              });
              didConstraint = true;
            }
          }
        }
      }
    }

    if (!didConstraint) {
      const advance = font.advanceWidth(glyphId) * scale;
      glyphData.push({
        glyphId,
        bitmap: cloneBitmap(raster.bitmap),
        bearingX: raster.bearingX,
        bearingY: raster.bearingY,
        advance,
        constraintWidth: 0,
      });
    }
  }

  glyphData.sort((a, b) => (b.bitmap?.rows ?? 0) - (a.bitmap?.rows ?? 0));

  const {
    width: atlasWidth,
    height: atlasHeight,
    placements,
  } = packGlyphs(
    glyphData.map((g) => ({
      width: (g.bitmap?.width ?? 0) + padding * 2,
      height: (g.bitmap?.rows ?? 0) + padding * 2,
    })),
    maxWidth,
    maxHeight,
  );

  const atlas = createAtlasBitmap(atlasWidth, atlasHeight, pixelMode);
  const glyphMetrics = new Map<number, FontAtlasGlyphMetrics>();

  const glyphMetricsByWidth = new Map<number, Map<number, FontAtlasGlyphMetrics>>();

  for (let i = 0; i < glyphData.length; i += 1) {
    const glyph = glyphData[i];
    const placement = placements[i];
    if (!placement?.placed || !glyph.bitmap) continue;
    copyBitmapToAtlas(glyph.bitmap, atlas, placement.x + padding, placement.y + padding);
    const metrics = {
      glyphId: glyph.glyphId,
      atlasX: placement.x + padding,
      atlasY: placement.y + padding,
      width: glyph.bitmap.width,
      height: glyph.bitmap.rows,
      bearingX: glyph.bearingX,
      bearingY: glyph.bearingY,
      advance: glyph.advance,
    };
    const widthKey = glyph.constraintWidth ?? 0;
    if (widthKey > 0) {
      let widthMap = glyphMetricsByWidth.get(widthKey);
      if (!widthMap) {
        widthMap = new Map<number, FontAtlasGlyphMetrics>();
        glyphMetricsByWidth.set(widthKey, widthMap);
      }
      widthMap.set(glyph.glyphId, metrics);
      if (!glyphMetrics.has(glyph.glyphId) || widthKey === 1) {
        glyphMetrics.set(glyph.glyphId, metrics);
      }
    } else {
      if (!glyphMetrics.has(glyph.glyphId)) {
        glyphMetrics.set(glyph.glyphId, metrics);
      }
    }
  }

  return {
    atlas: {
      bitmap: atlas,
      glyphs: glyphMetrics,
      glyphsByWidth: glyphMetricsByWidth,
      fontSize,
    },
    constrainedGlyphWidths: null,
  };
}

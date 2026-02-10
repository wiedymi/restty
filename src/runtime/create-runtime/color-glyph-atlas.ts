import type {
  FontAtlas,
  FontAtlasBitmap,
  FontAtlasGlyphMetrics,
  FontEntry,
} from "../../fonts";
import {
  createAtlasBitmap,
  copyBitmapToAtlas,
} from "../font-atlas-utils/bitmap-utils";
import { packGlyphs } from "../font-atlas-utils/packing-utils";
import { resolveFontScaleForAtlas } from "../font-atlas-utils/nerd-metrics-utils";
import { atlasBitmapToRGBA as atlasBitmapToRGBAFromBitmap } from "./atlas-debug-utils";
import type {
  BuildColorEmojiAtlasWithCanvas,
  BuildColorEmojiAtlasWithCanvasOptions,
} from "./font-runtime-helpers.types";
import type { RasterizedGlyph } from "text-shaper";

const COLOR_EMOJI_FONT_STACK =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","EmojiOne Color","Twemoji Mozilla",sans-serif';

type CreateColorGlyphAtlasHelpersOptions = {
  pixelModeRgba: number;
  atlasToRGBA: (atlas: FontAtlas) => Uint8Array;
};

export function createColorGlyphAtlasHelpers(options: CreateColorGlyphAtlasHelpersOptions) {
  const { pixelModeRgba, atlasToRGBA } = options;
  let colorGlyphCanvas: HTMLCanvasElement | null = null;
  let colorGlyphCtx: CanvasRenderingContext2D | null = null;

  const atlasBitmapToRGBA = (atlas: FontAtlas): Uint8Array | null =>
    atlasBitmapToRGBAFromBitmap(atlas, pixelModeRgba, atlasToRGBA);

  function getColorGlyphContext(): CanvasRenderingContext2D | null {
    if (colorGlyphCtx) return colorGlyphCtx;
    if (typeof document === "undefined") return null;
    colorGlyphCanvas = document.createElement("canvas");
    colorGlyphCtx = colorGlyphCanvas.getContext("2d", { willReadFrequently: true });
    return colorGlyphCtx;
  }

  function resolveColorGlyphFontCss(entry: FontEntry, fontSize: number): string {
    const label = String(entry.label ?? "")
      .split("(")[0]
      .trim()
      .replace(/"/g, '\\"');
    const families: string[] = [];
    if (label && !/openmoji/i.test(label)) {
      families.push(`"${label}"`);
    }
    families.push(COLOR_EMOJI_FONT_STACK);
    return `${Math.max(1, Math.round(fontSize))}px ${families.join(",")}`;
  }

  function rasterizeColorGlyphWithCanvas(
    entry: FontEntry,
    text: string,
    fontSize: number,
  ): RasterizedGlyph | null {
    if (!text) return null;
    const ctx = getColorGlyphContext();
    if (!ctx) return null;
    const fontCss = resolveColorGlyphFontCss(entry, fontSize);

    ctx.save();
    ctx.font = fontCss;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    const metrics = ctx.measureText(text);
    const left = Math.max(0, metrics.actualBoundingBoxLeft ?? 0);
    const right = Math.max(1, metrics.actualBoundingBoxRight ?? metrics.width ?? 1);
    const ascent = Math.max(1, metrics.actualBoundingBoxAscent ?? fontSize * 0.8);
    const descent = Math.max(0, metrics.actualBoundingBoxDescent ?? fontSize * 0.2);
    const width = Math.max(1, Math.ceil(left + right + 1));
    const height = Math.max(1, Math.ceil(ascent + descent + 1));

    if (!colorGlyphCanvas) {
      ctx.restore();
      return null;
    }
    if (colorGlyphCanvas.width !== width || colorGlyphCanvas.height !== height) {
      colorGlyphCanvas.width = width;
      colorGlyphCanvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.font = fontCss;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.fillText(text, left, ascent);
    const image = ctx.getImageData(0, 0, width, height);
    ctx.restore();

    return {
      bitmap: {
        width,
        rows: height,
        pitch: width * 4,
        buffer: new Uint8Array(image.data),
        pixelMode: pixelModeRgba,
        numGrays: 256,
      },
      bearingX: -left,
      bearingY: ascent,
    };
  }

  const buildColorEmojiAtlasWithCanvas: BuildColorEmojiAtlasWithCanvas = (
    options: BuildColorEmojiAtlasWithCanvasOptions,
  ) => {
    const {
      font,
      fontEntry,
      glyphIds,
      fontSize,
      sizeMode,
      padding,
      maxWidth,
      maxHeight,
      pixelMode,
    } = options;
    if (pixelMode !== pixelModeRgba && pixelMode !== 4) return null;
    if (!fontEntry.colorGlyphTexts?.size) return null;

    const scale = resolveFontScaleForAtlas(font, fontSize, sizeMode);
    const glyphData: Array<{
      glyphId: number;
      bitmap: FontAtlasBitmap;
      bearingX: number;
      bearingY: number;
      advance: number;
    }> = [];

    for (let i = 0; i < glyphIds.length; i += 1) {
      const glyphId = glyphIds[i];
      const text = fontEntry.colorGlyphTexts.get(glyphId);
      if (!text) continue;
      const raster = rasterizeColorGlyphWithCanvas(fontEntry, text, fontSize);
      if (!raster) continue;
      glyphData.push({
        glyphId,
        bitmap: raster.bitmap,
        bearingX: raster.bearingX,
        bearingY: raster.bearingY,
        advance: font.advanceWidth(glyphId) * scale,
      });
    }

    if (!glyphData.length) return null;

    glyphData.sort((a, b) => (b.bitmap?.rows ?? 0) - (a.bitmap?.rows ?? 0));
    const {
      width: atlasWidth,
      height: atlasHeight,
      placements,
    } = packGlyphs(
      glyphData.map((glyph) => ({
        width: (glyph.bitmap?.width ?? 0) + padding * 2,
        height: (glyph.bitmap?.rows ?? 0) + padding * 2,
      })),
      maxWidth,
      maxHeight,
    );
    const atlasBitmap = createAtlasBitmap(atlasWidth, atlasHeight, pixelModeRgba);
    const glyphMetrics = new Map<number, FontAtlasGlyphMetrics>();

    for (let i = 0; i < glyphData.length; i += 1) {
      const glyph = glyphData[i];
      const placement = placements[i];
      if (!placement?.placed || !glyph.bitmap) continue;
      copyBitmapToAtlas(glyph.bitmap, atlasBitmap, placement.x + padding, placement.y + padding);
      glyphMetrics.set(glyph.glyphId, {
        glyphId: glyph.glyphId,
        atlasX: placement.x + padding,
        atlasY: placement.y + padding,
        width: glyph.bitmap.width,
        height: glyph.bitmap.rows,
        bearingX: glyph.bearingX,
        bearingY: glyph.bearingY,
        advance: glyph.advance,
      });
    }

    return {
      atlas: {
        bitmap: atlasBitmap,
        glyphs: glyphMetrics,
        glyphsByWidth: new Map<number, Map<number, FontAtlasGlyphMetrics>>(),
        fontSize,
        colorGlyphs: new Set<number>(glyphMetrics.keys()),
      },
      constrainedGlyphWidths: null,
    };
  };

  return {
    atlasBitmapToRGBA,
    buildColorEmojiAtlasWithCanvas,
  };
}

export type GlyphConstraintMeta = {
  cp: number;
  constraintWidth: number;
  variable?: boolean;
  widths?: Set<number>;
};

export type AtlasConstraintContext = {
  cellW: number;
  cellH: number;
  yPad: number;
  baselineOffset: number;
  baselineAdjust: number;
  fontScale: number;
  nerdMetrics: {
    cellWidth: number;
    cellHeight: number;
    faceWidth: number;
    faceHeight: number;
    faceY: number;
    iconHeight: number;
    iconHeightSingle: number;
  };
  fontEntry: any;
};

type BuildAtlasDeps = {
  fontScaleOverrides: Array<{ match: RegExp; scale: number }>;
  sizeMode: string;
  isSymbolFont: (entry: any) => boolean;
  fontScaleOverride: (
    entry: any,
    overrides: Array<{ match: RegExp; scale: number }>,
  ) => number;
  resolveGlyphPixelMode: (entry: any) => number;
  atlasBitmapToRGBA: (atlas: any) => Uint8Array | null;
  padAtlasRGBA: (rgba: Uint8Array, atlas: any, padding: number) => Uint8Array;
  buildAtlas: (font: any, glyphIds: number[], options: any) => any;
  buildGlyphAtlasWithConstraints: (
    options: any,
  ) => { atlas: any; constrainedGlyphWidths?: any } | null;
  buildColorEmojiAtlasWithCanvas: (options: any) => { atlas: any } | null;
  rasterizeGlyph?: any;
  rasterizeGlyphWithTransform?: any;
  nerdConstraintSignature: (
    glyphMeta: Map<number, GlyphConstraintMeta> | undefined,
    constraintContext: AtlasConstraintContext | null | undefined,
  ) => string;
  constants: {
    atlasPadding: number;
    symbolAtlasPadding: number;
    symbolAtlasMaxSize: number;
    defaultAtlasMaxSize: number;
    pixelModeRgbaValue: number;
  };
  resolvePreferNearest: (params: {
    fontIndex: number;
    isSymbol: boolean;
    atlasScale: number;
  }) => boolean;
};

export type BuildFontAtlasParams = {
  entry: any;
  neededGlyphIds: Set<number>;
  glyphMeta?: Map<number, GlyphConstraintMeta>;
  fontSizePx: number;
  atlasScale: number;
  fontIndex: number;
  constraintContext?: AtlasConstraintContext | null;
  deps: BuildAtlasDeps;
};

export type BuildFontAtlasResult = {
  rebuilt: boolean;
  atlas: any | null;
  rgba: Uint8Array | null;
  colorGlyphs?: Set<number>;
  preferNearest: boolean;
};

export function buildFontAtlasIfNeeded(
  params: BuildFontAtlasParams,
): BuildFontAtlasResult {
  const {
    entry,
    neededGlyphIds,
    glyphMeta,
    fontSizePx,
    atlasScale,
    fontIndex,
    constraintContext,
    deps,
  } = params;

  if (!entry?.font) {
    return { rebuilt: false, atlas: null, rgba: null, preferNearest: false };
  }

  const {
    fontScaleOverrides,
    sizeMode,
    isSymbolFont,
    fontScaleOverride,
    resolveGlyphPixelMode,
    atlasBitmapToRGBA,
    padAtlasRGBA,
    buildAtlas,
    buildGlyphAtlasWithConstraints,
    buildColorEmojiAtlasWithCanvas,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    nerdConstraintSignature,
    constants,
    resolvePreferNearest,
  } = deps;

  const scaleOverride = fontScaleOverride(entry, fontScaleOverrides);
  const effectiveFontSizePx = Math.max(
    1,
    Math.round(fontSizePx * (atlasScale || 1) * scaleOverride),
  );

  let needsRebuild =
    !entry.atlas ||
    entry.fontSizePx !== effectiveFontSizePx ||
    entry.atlasScale !== (atlasScale || 1);

  const isSymbol = isSymbolFont(entry);
  const constraintSignature = isSymbol
    ? nerdConstraintSignature(glyphMeta, constraintContext)
    : "";

  if (
    !needsRebuild &&
    isSymbol &&
    (entry.constraintSignature ?? "") !== constraintSignature
  ) {
    needsRebuild = true;
  }

  if (!needsRebuild) {
    for (const glyphId of neededGlyphIds) {
      if (!entry.glyphIds.has(glyphId)) {
        needsRebuild = true;
        break;
      }
    }
  }

  if (!needsRebuild && glyphMeta && glyphMeta.size && isSymbol) {
    const widthMaps = entry.atlas?.glyphsByWidth;
    if (!widthMaps) {
      needsRebuild = true;
    } else {
      for (const [glyphId, meta] of glyphMeta.entries()) {
        const widths = meta.widths ?? new Set([meta.constraintWidth ?? 1]);
        for (const width of widths) {
          if (!widthMaps.get(width)?.has(glyphId)) {
            needsRebuild = true;
            break;
          }
        }
        if (needsRebuild) break;
      }
    }
  }

  if (!needsRebuild) {
    return {
      rebuilt: false,
      atlas: entry.atlas ?? null,
      rgba: null,
      preferNearest: false,
    };
  }

  const union = new Set(entry.glyphIds);
  for (const glyphId of neededGlyphIds) union.add(glyphId);
  if (union.size === 0) {
    return { rebuilt: false, atlas: null, rgba: null, preferNearest: false };
  }

  const useHinting = fontIndex === 0 && !isSymbol;
  const atlasPadding = isSymbol
    ? Math.max(constants.atlasPadding, constants.symbolAtlasPadding)
    : constants.atlasPadding;
  const atlasMaxSize = isSymbol
    ? constants.symbolAtlasMaxSize
    : constants.defaultAtlasMaxSize;
  const glyphPixelMode = resolveGlyphPixelMode(entry);
  const colorGlyphAtlas =
    glyphPixelMode === constants.pixelModeRgbaValue || glyphPixelMode === 4;
  const useCanvasColorAtlas = colorGlyphAtlas;

  let atlas = null;
  if (
    isSymbol &&
    rasterizeGlyph &&
    rasterizeGlyphWithTransform &&
    constraintContext &&
    glyphMeta
  ) {
    const result = buildGlyphAtlasWithConstraints({
      font: entry.font,
      glyphIds: [...union],
      fontSize: effectiveFontSizePx,
      sizeMode,
      padding: atlasPadding,
      pixelMode: glyphPixelMode,
      hinting: useHinting,
      maxWidth: atlasMaxSize,
      maxHeight: atlasMaxSize,
      rasterizeGlyph,
      rasterizeGlyphWithTransform,
      glyphMeta,
      constraintContext,
    });
    atlas = result?.atlas ?? null;
  }

  if (!atlas && useCanvasColorAtlas) {
    const result = buildColorEmojiAtlasWithCanvas({
      font: entry.font,
      fontEntry: entry,
      glyphIds: [...union],
      fontSize: effectiveFontSizePx,
      sizeMode,
      padding: atlasPadding,
      pixelMode: glyphPixelMode,
      maxWidth: atlasMaxSize,
      maxHeight: atlasMaxSize,
    });
    atlas = result?.atlas ?? null;
  }

  if (!atlas && rasterizeGlyph && colorGlyphAtlas) {
    const result = buildGlyphAtlasWithConstraints({
      font: entry.font,
      glyphIds: [...union],
      fontSize: effectiveFontSizePx,
      sizeMode,
      padding: atlasPadding,
      pixelMode: glyphPixelMode,
      hinting: useHinting,
      maxWidth: atlasMaxSize,
      maxHeight: atlasMaxSize,
      rasterizeGlyph,
      rasterizeGlyphWithTransform,
    });
    atlas = result?.atlas ?? null;
  }

  if (!atlas) {
    atlas = buildAtlas(entry.font, [...union], {
      fontSize: effectiveFontSizePx,
      sizeMode,
      padding: atlasPadding,
      pixelMode: glyphPixelMode,
      hinting: useHinting,
      maxWidth: atlasMaxSize,
      maxHeight: atlasMaxSize,
    });
  }

  if (!atlas || !atlas.bitmap?.width || !atlas.bitmap?.rows) {
    return { rebuilt: false, atlas: null, rgba: null, preferNearest: false };
  }

  const colorGlyphs = colorGlyphAtlas
    ? new Set<number>(atlas.glyphs.keys())
    : undefined;
  atlas.colorGlyphs = colorGlyphs;

  let rgba = atlasBitmapToRGBA(atlas);
  if (!rgba) {
    return { rebuilt: false, atlas: null, rgba: null, preferNearest: false };
  }
  rgba = padAtlasRGBA(rgba, atlas, atlasPadding);

  entry.atlas = atlas;
  entry.glyphIds = union;
  entry.fontSizePx = effectiveFontSizePx;
  entry.atlasScale = atlasScale || 1;
  entry.constraintSignature = constraintSignature;

  return {
    rebuilt: true,
    atlas,
    rgba,
    colorGlyphs,
    preferNearest: resolvePreferNearest({ fontIndex, isSymbol, atlasScale }),
  };
}

import type { EmitWebGPUQueuedGlyphsParams } from "./render-tick-webgpu.types";

export function emitWebGPUQueuedGlyphs(params: EmitWebGPUQueuedGlyphsParams) {
  const {
    deps,
    state,
    frame,
    queueByFont,
    targetMaps,
    cellW,
    cellH,
    yPad,
    baselineOffset,
    primaryScale,
  } = params;

  const {
    defaultBg,
    resolveSymbolConstraint,
    isAppleSymbolsFont,
    DEFAULT_APPLE_SYMBOLS_CONSTRAINT,
    DEFAULT_SYMBOL_CONSTRAINT,
    DEFAULT_EMOJI_CONSTRAINT,
    constrainGlyphBox,
    tightenNerdConstraintBox,
    fontEntryHasItalicStyle,
    fontEntryHasBoldStyle,
    ITALIC_SLANT,
    BOLD_OFFSET,
    GLYPH_RENDER_MODE_COLOR,
    GLYPH_RENDER_MODE_MONO,
    clamp,
  } = deps;

  const getGlyphData = (map: Map<number, number[]>, fontIndex: number) => {
    if (!map.has(fontIndex)) map.set(fontIndex, []);
    return map.get(fontIndex)!;
  };

  for (const [fontIndex, queue] of queueByFont.entries()) {
    const entry = deps.fontState.fonts[fontIndex];
    const atlasState = state.glyphAtlases?.get(fontIndex);
    if (!entry || !entry.atlas || !atlasState) continue;
    const atlas = entry.atlas;
    const atlasW = atlas.bitmap.width;
    const atlasH = atlas.bitmap.rows;
    const baseInset = Number.isFinite(atlas.inset) ? atlas.inset : 0;
    const colorGlyphs = atlasState.colorGlyphs ?? atlas.colorGlyphs;
    for (const item of queue) {
      const bg = item.bg ?? defaultBg;
      let penX = 0;
      const scale = item.scale ?? primaryScale;
      const maxWidth = item.cellWidth ?? cellW;
      const maxHeight = cellH;
      const symbolLike = item.symbolLike;
      const symbolConstraint = item.symbolConstraint;
      const glyphDataNearest = getGlyphData(targetMaps.nearest, fontIndex);
      const glyphDataLinear = getGlyphData(targetMaps.linear, fontIndex);
      let itemScale = scale;
      if (!symbolConstraint) {
        if (item.forceFit && item.glyphWidthPx && maxWidth > 0) {
          const fit = maxWidth / item.glyphWidthPx;
          if (fit > 0 && fit < 1) itemScale = scale * fit;
        }
        if (!symbolLike) {
          const advancePx = item.shaped.advance * scale;
          if (advancePx > maxWidth && advancePx > 0) {
            itemScale = scale * (maxWidth / advancePx);
          }
        }
      }
      const scaleFactor = scale > 0 ? itemScale / scale : 1;
      const widthKey = item.constraintWidth ?? 0;
      const widthMap = atlas.glyphsByWidth?.get(widthKey);
      for (const glyph of item.shaped.glyphs) {
        const colorGlyph = !!colorGlyphs?.has(glyph.glyphId);
        const metrics = widthMap?.get(glyph.glyphId) ?? atlas.glyphs.get(glyph.glyphId);
        if (!metrics) continue;
        let bitmapScale = scaleFactor;
        const glyphConstrained = symbolLike && !!widthMap?.has(glyph.glyphId);
        if (glyphConstrained) bitmapScale = 1;
        if (fontIndex > 0 && !symbolLike) {
          const widthScale = maxWidth > 0 ? maxWidth / metrics.width : 1;
          const heightScale = maxHeight > 0 ? maxHeight / metrics.height : 1;
          const clampScale = Math.min(1, widthScale, heightScale);
          bitmapScale *= clampScale;
        }
        const baselineAdjust = frame.baselineAdjustByFont[fontIndex] ?? 0;
        let gw = metrics.width * bitmapScale;
        let gh = metrics.height * bitmapScale;
        if (symbolLike && !glyphConstrained) {
          const scaleToFit = gw > 0 && gh > 0 ? Math.min(maxWidth / gw, maxHeight / gh) : 1;
          if (scaleToFit < 1) {
            bitmapScale *= scaleToFit;
            gw *= scaleToFit;
            gh *= scaleToFit;
          }
          gw = Math.max(1, Math.round(gw));
          gh = Math.max(1, Math.round(gh));
        }
        let x = item.x + item.xPad + (penX + glyph.xOffset) * itemScale + metrics.bearingX * bitmapScale;
        if (fontIndex > 0 && item.shaped.glyphs.length === 1 && !symbolLike && maxWidth <= cellW * 1.05) {
          x = item.x + (maxWidth - gw) * 0.5;
        }
        const minX = item.x;
        const maxX = item.x + maxWidth;
        if (x < minX) x = minX;
        if (x + gw > maxX) x = Math.max(minX, maxX - gw);

        let y = item.baseY + baselineAdjust - metrics.bearingY * bitmapScale - glyph.yOffset * itemScale;
        if (!glyphConstrained && symbolLike && item.cp) {
          const nerdConstraint = resolveSymbolConstraint(item.cp);
          const defaultConstraint = isAppleSymbolsFont(entry)
            ? DEFAULT_APPLE_SYMBOLS_CONSTRAINT
            : DEFAULT_SYMBOL_CONSTRAINT;
          const constraint =
            nerdConstraint ?? (colorGlyph ? DEFAULT_EMOJI_CONSTRAINT : defaultConstraint);
          const rowY = item.baseY - yPad - baselineOffset;
          const constraintWidth = Math.max(1, item.constraintWidth ?? Math.round(maxWidth / cellW));
          const adjusted = constrainGlyphBox(
            { x: x - item.x, y: y - rowY, width: gw, height: gh },
            constraint,
            frame.nerdMetrics,
            constraintWidth,
          );
          const tightened = nerdConstraint ? tightenNerdConstraintBox(adjusted, nerdConstraint) : adjusted;
          x = item.x + tightened.x;
          y = rowY + tightened.y;
          gw = tightened.width;
          gh = tightened.height;
        }
        if (gw < 1) gw = 1;
        if (gh < 1) gh = 1;
        const scaled = Math.abs(gw - metrics.width) > 0.01 || Math.abs(gh - metrics.height) > 0.01;
        const useNearest = atlasState.nearest && !scaled;
        if (useNearest) {
          gw = metrics.width;
          gh = metrics.height;
        }
        const uvInset = baseInset + (useNearest ? 0.5 : 0);
        const px = Math.round(x);
        const py = Math.round(y);
        const insetX = Math.min(uvInset, (metrics.width - 1) * 0.5);
        const insetY = Math.min(uvInset, (metrics.height - 1) * 0.5);
        const u0 = (metrics.atlasX + insetX) / atlasW;
        const v0 = (metrics.atlasY + insetY) / atlasH;
        const u1 = (metrics.atlasX + metrics.width - insetX) / atlasW;
        const v1 = (metrics.atlasY + metrics.height - insetY) / atlasH;
        const glyphData = useNearest ? glyphDataNearest : glyphDataLinear;
        const italic = !!item.italic;
        const bold = !!item.bold;
        const syntheticItalic = italic && !fontEntryHasItalicStyle(entry);
        const syntheticBold = bold && !fontEntryHasBoldStyle(entry);
        const slant = syntheticItalic && !colorGlyph ? gh * ITALIC_SLANT : 0;
        const boldOffset =
          syntheticBold && !colorGlyph ? Math.max(1, Math.round(gw * BOLD_OFFSET)) : 0;
        const renderMode = colorGlyph ? GLYPH_RENDER_MODE_COLOR : GLYPH_RENDER_MODE_MONO;
        const pushGlyph = (xPos: number) => {
          glyphData.push(
            xPos,
            py,
            gw,
            gh,
            u0,
            v0,
            u1,
            v1,
            item.fg[0],
            item.fg[1],
            item.fg[2],
            item.fg[3],
            bg[0],
            bg[1],
            bg[2],
            bg[3],
            slant,
            renderMode,
          );
        };
        pushGlyph(px);
        if (boldOffset > 0) {
          const minGlyphX = Math.round(item.x);
          const maxGlyphX = Math.round(item.x + maxWidth - gw);
          let bx = clamp(px + boldOffset, minGlyphX, maxGlyphX);
          if (bx === px) bx = clamp(px - boldOffset, minGlyphX, maxGlyphX);
          // If a glyph fully occupies its cell, we can't offset; reinforce at the same x.
          if (bx === px) pushGlyph(px);
          else pushGlyph(bx);
        }
        penX += glyph.xAdvance;
      }
    }
  }
}

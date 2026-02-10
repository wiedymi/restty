import type { GlyphQueueItem } from "./render-tick-webgpu.types";
import type { WebGLTickContext } from "./render-tick-webgl.types";

export function renderWebGLGlyphPipeline(ctx: WebGLTickContext) {
  const {
    deps,
    state,
    cellW,
    cellH,
    fontSizePx,
    primaryScale,
    baselineOffset,
    yPad,
    bgData,
    selectionData,
    underlineData,
    cursorData,
    fgRectData,
    overlayData,
    glyphDataByFont,
    glyphQueueByFont,
    overlayGlyphDataByFont,
    overlayGlyphQueueByFont,
    neededGlyphIdsByFont,
    neededGlyphMetaByFont,
    scaleByFont,
    bitmapScaleByFont,
    baselineAdjustByFont,
    nerdMetrics,
    getGlyphData,
    useLinearBlending,
    useLinearCorrection,
    compiledWebGLStages,
    stageTargets,
    hasShaderStages,
  } = ctx;

  const {
    fontState,
    defaultBg,
    buildFontAtlasIfNeeded,
    FONT_SCALE_OVERRIDES,
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
    ATLAS_PADDING,
    SYMBOL_ATLAS_PADDING,
    SYMBOL_ATLAS_MAX_SIZE,
    PixelMode,
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
    ensureGLInstanceBuffer,
    GLYPH_INSTANCE_FLOATS,
    clamp,
    canvas,
  } = deps;

  const { gl } = state;

  for (const [fontIndex, neededIds] of neededGlyphIdsByFont.entries()) {
    const fontEntry = fontState.fonts[fontIndex];
    if (!fontEntry?.font) continue;
    let atlasState = state.glyphAtlases.get(fontIndex);
    const meta = neededGlyphMetaByFont.get(fontIndex);

    const bitmapScale = bitmapScaleByFont[fontIndex] ?? 1;
    const constraintContext = meta
      ? {
          cellW,
          cellH,
          yPad,
          baselineOffset,
          baselineAdjust: baselineAdjustByFont[fontIndex] ?? 0,
          fontScale: scaleByFont[fontIndex] ?? primaryScale,
          nerdMetrics,
          fontEntry,
        }
      : null;

    const built = buildFontAtlasIfNeeded({
      entry: fontEntry,
      neededGlyphIds: neededIds,
      glyphMeta: meta,
      fontSizePx,
      atlasScale: bitmapScale,
      fontIndex,
      constraintContext,
      deps: {
        fontScaleOverrides: FONT_SCALE_OVERRIDES,
        sizeMode: fontState.sizeMode,
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
        constants: {
          atlasPadding: ATLAS_PADDING,
          symbolAtlasPadding: SYMBOL_ATLAS_PADDING,
          symbolAtlasMaxSize: SYMBOL_ATLAS_MAX_SIZE,
          defaultAtlasMaxSize: 2048,
          pixelModeRgbaValue: PixelMode.RGBA ?? 4,
        },
        resolvePreferNearest: ({ fontIndex: idx, isSymbol }) => idx === 0 || isSymbol,
      },
    });

    if (!built.rebuilt || !built.atlas || !built.rgba) continue;
    const atlas = built.atlas;
    const colorGlyphs = built.colorGlyphs;
    const rgba = built.rgba;
    const preferNearest = built.preferNearest;

    if (atlasState) {
      gl.deleteTexture(atlasState.texture);
    }

    const texture = gl.createTexture();
    if (!texture) continue;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      atlas.bitmap.width,
      atlas.bitmap.rows,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(rgba),
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      preferNearest ? gl.NEAREST : gl.LINEAR,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      preferNearest ? gl.NEAREST : gl.LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    atlasState = {
      texture,
      width: atlas.bitmap.width,
      height: atlas.bitmap.rows,
      inset: atlas.inset,
      colorGlyphs,
      nearest: preferNearest,
    };
    state.glyphAtlases.set(fontIndex, atlasState);
  }

  const emitGlyphs = (queueByFont: Map<number, GlyphQueueItem[]>, targetMap: Map<number, number[]>) => {
    for (const [fontIndex, queue] of queueByFont.entries()) {
      const entry = fontState.fonts[fontIndex];
      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!entry || !entry.atlas || !atlasState) continue;
      const atlas = entry.atlas;
      const atlasW = atlas.bitmap.width;
      const atlasH = atlas.bitmap.rows;
      const baseInset = Number.isFinite(atlas.inset) ? atlas.inset : 0;
      const uvInset = baseInset + (atlasState.nearest ? 0.5 : 0);
      const colorGlyphs = atlasState.colorGlyphs ?? atlas.colorGlyphs;
      const glyphData = getGlyphData(targetMap, fontIndex);
      for (const item of queue) {
        const bg = item.bg ?? defaultBg;
        let penX = 0;
        const scale = item.scale ?? primaryScale;
        const maxWidth = item.cellWidth ?? cellW;
        const maxHeight = cellH;
        const symbolLike = item.symbolLike;
        const symbolConstraint = item.symbolConstraint;
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
          const baselineAdjust = baselineAdjustByFont[fontIndex] ?? 0;
          let gw = metrics.width * bitmapScale;
          let gh = metrics.height * bitmapScale;
          if (symbolLike && !glyphConstrained) {
            const scaleToFit = gw > 0 && gh > 0 ? Math.min(maxWidth / gw, maxHeight / gh) : 1;
            if (scaleToFit < 1) {
              bitmapScale *= scaleToFit;
              gw *= scaleToFit;
              gh *= scaleToFit;
            }
            gw = Math.round(gw);
            gh = Math.round(gh);
          }
          let x =
            item.x +
            item.xPad +
            (penX + glyph.xOffset) * itemScale +
            metrics.bearingX * bitmapScale;
          if (
            fontIndex > 0 &&
            item.shaped.glyphs.length === 1 &&
            !symbolLike &&
            maxWidth <= cellW * 1.05
          ) {
            const center = item.x + (maxWidth - gw) * 0.5;
            x = center;
          }
          const minX = item.x;
          const maxX = item.x + maxWidth;
          if (x < minX) x = minX;
          if (x + gw > maxX) x = Math.max(minX, maxX - gw);

          let y =
            item.baseY +
            baselineAdjust -
            metrics.bearingY * bitmapScale -
            glyph.yOffset * itemScale;
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
              {
                x: x - item.x,
                y: y - rowY,
                width: gw,
                height: gh,
              },
              constraint,
              nerdMetrics,
              constraintWidth,
            );
            const tightened = nerdConstraint
              ? tightenNerdConstraintBox(adjusted, nerdConstraint)
              : adjusted;
            x = item.x + tightened.x;
            y = rowY + tightened.y;
            gw = tightened.width;
            gh = tightened.height;
          }
          if (gw < 1) gw = 1;
          if (gh < 1) gh = 1;
          const px = Math.round(x);
          const py = Math.round(y);
          const insetX = Math.min(uvInset, (metrics.width - 1) * 0.5);
          const insetY = Math.min(uvInset, (metrics.height - 1) * 0.5);
          const u0 = (metrics.atlasX + insetX) / atlasW;
          const v0 = (metrics.atlasY + insetY) / atlasH;
          const u1 = (metrics.atlasX + metrics.width - insetX) / atlasW;
          const v1 = (metrics.atlasY + metrics.height - insetY) / atlasH;
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
            if (bx === px) pushGlyph(px);
            else pushGlyph(bx);
          }
          penX += glyph.xAdvance;
        }
      }
    }
  };

  emitGlyphs(glyphQueueByFont, glyphDataByFont);
  emitGlyphs(overlayGlyphQueueByFont, overlayGlyphDataByFont);

  const drawRects = (data: number[]) => {
    if (!data.length) return;
    const rectArray = new Float32Array(data);
    ensureGLInstanceBuffer(state, "rect", rectArray.byteLength);
    gl.bindVertexArray(state.rectVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.rectInstanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, rectArray);
    gl.useProgram(state.rectProgram);
    gl.uniform2f(state.rectResolutionLoc, canvas.width, canvas.height);
    gl.uniform2f(state.rectBlendLoc, useLinearBlending ? 1 : 0, useLinearCorrection ? 1 : 0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.length / 8);
    gl.bindVertexArray(null);
  };

  const drawGlyphs = (fontIndex: number, data: number[]) => {
    if (!data.length) return;
    const atlasState = state.glyphAtlases.get(fontIndex);
    if (!atlasState) return;
    const glyphArray = new Float32Array(data);
    ensureGLInstanceBuffer(state, "glyph", glyphArray.byteLength);
    gl.bindVertexArray(state.glyphVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.glyphInstanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, glyphArray);
    gl.useProgram(state.glyphProgram);
    gl.uniform2f(state.glyphResolutionLoc, canvas.width, canvas.height);
    gl.uniform2f(state.glyphBlendLoc, useLinearBlending ? 1 : 0, useLinearCorrection ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasState.texture);
    gl.uniform1i(state.glyphAtlasLoc, 0);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, data.length / GLYPH_INSTANCE_FLOATS);
    gl.bindVertexArray(null);
  };

  drawRects(bgData);
  drawRects(selectionData);
  drawRects(underlineData);
  drawRects(fgRectData);

  for (const [fontIndex, glyphData] of glyphDataByFont.entries()) {
    drawGlyphs(fontIndex, glyphData);
  }

  drawRects(cursorData);
  drawRects(overlayData);

  for (const [fontIndex, glyphData] of overlayGlyphDataByFont.entries()) {
    drawGlyphs(fontIndex, glyphData);
  }

  if (hasShaderStages && stageTargets) {
    gl.disable(gl.BLEND);
    gl.bindVertexArray(stageTargets.quadVao);
    const nowSec = performance.now() * 0.001;
    let sourceTex = stageTargets.sceneTexture;
    for (let i = 0; i < compiledWebGLStages.length; i += 1) {
      const stage = compiledWebGLStages[i];
      const isLast = i === compiledWebGLStages.length - 1;
      const nextIsPing =
        sourceTex === stageTargets.sceneTexture || sourceTex === stageTargets.pongTexture;
      const targetFramebuffer = isLast
        ? null
        : nextIsPing
          ? stageTargets.pingFramebuffer
          : stageTargets.pongFramebuffer;
      const nextTexture = nextIsPing ? stageTargets.pingTexture : stageTargets.pongTexture;

      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(stage.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTex);
      gl.uniform1i(stage.sourceLoc, 0);
      gl.uniform2f(stage.resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(stage.timeLoc, nowSec);
      gl.uniform4f(
        stage.params0Loc,
        stage.params[0] ?? 0,
        stage.params[1] ?? 0,
        stage.params[2] ?? 0,
        stage.params[3] ?? 0,
      );
      gl.uniform4f(
        stage.params1Loc,
        stage.params[4] ?? 0,
        stage.params[5] ?? 0,
        stage.params[6] ?? 0,
        stage.params[7] ?? 0,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      sourceTex = nextTexture;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
}

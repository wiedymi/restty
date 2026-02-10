import type { AugmentWebGPUFrameParams } from "./render-tick-webgpu.types";

export function augmentWebGPUFrameWithOverlaysAndAtlas(params: AugmentWebGPUFrameParams) {
  const {
    deps,
    state,
    frame,
    cursor,
    cursorImeAnchor,
    cursorCell,
    cols,
    cellW,
    cellH,
    yPad,
    baselineOffset,
    underlineOffsetPx,
    underlineThicknessPx,
    lineHeight,
    primaryScale,
    fontSizePx,
  } = params;

  const {
    fontState,
    imeState,
    pickFontIndexForText,
    shapeClusterWithFont,
    noteColorGlyphText,
    fitTextTailToWidth,
    PREEDIT_BG,
    PREEDIT_UL,
    PREEDIT_ACTIVE_BG,
    PREEDIT_CARET,
    PREEDIT_FG,
    resizeState,
    RESIZE_OVERLAY_HOLD_MS,
    RESIZE_OVERLAY_FADE_MS,
    clamp,
    pushRect,
    pushRectBox,
    ensureAtlasForFont,
  } = deps;

  if (cursor && imeState.preedit) {
    const preeditText = imeState.preedit;
    const preeditFontIndex = pickFontIndexForText(preeditText, 1);
    const preeditEntry = fontState.fonts[preeditFontIndex] ?? fontState.fonts[0];
    const preeditScale = frame.scaleByFont[preeditFontIndex] ?? primaryScale;
    const preeditRow = cursorImeAnchor?.row ?? cursorCell?.row ?? cursor.row;
    const preeditCol = cursorImeAnchor?.col ?? cursorCell?.col ?? cursor.col;
    const maxPreeditWidthPx = Math.max(cellW, (cols - preeditCol) * cellW);
    const fittedPreedit = fitTextTailToWidth(preeditText, maxPreeditWidthPx, (value) => {
      if (!value) return 0;
      return shapeClusterWithFont(preeditEntry, value).advance * preeditScale;
    });
    const visiblePreeditText = fittedPreedit.text;
    if (visiblePreeditText) {
      const shaped = shapeClusterWithFont(preeditEntry, visiblePreeditText);
      noteColorGlyphText(preeditEntry, visiblePreeditText, shaped);
      const glyphSet = frame.getGlyphSet(preeditFontIndex);
      for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);
      const baseY = preeditRow * cellH + yPad + baselineOffset;
      const x = preeditCol * cellW;
      const advancePx = shaped.advance * preeditScale;
      const widthPx = Math.max(
        cellW,
        Math.min(maxPreeditWidthPx, Math.max(fittedPreedit.widthPx, advancePx)),
      );
      const rowY = preeditRow * cellH;
      pushRect(frame.bgData, x, rowY, widthPx, cellH, PREEDIT_BG);
      const thickness = underlineThicknessPx;
      const underlineBaseY = clamp(baseY + underlineOffsetPx, rowY + 1, rowY + cellH - thickness - 1);
      pushRect(frame.underlineData, x, underlineBaseY, widthPx, thickness, PREEDIT_UL);
      const selectionOffset = fittedPreedit.offset;
      const rawSelStart = imeState.selectionStart || 0;
      const rawSelEnd = imeState.selectionEnd || 0;
      const selStart = Math.max(
        0,
        Math.min(visiblePreeditText.length, rawSelStart - selectionOffset),
      );
      const selEnd = Math.max(
        selStart,
        Math.min(visiblePreeditText.length, rawSelEnd - selectionOffset),
      );
      if (selEnd > selStart) {
        const leftWidth =
          shapeClusterWithFont(preeditEntry, visiblePreeditText.slice(0, selStart)).advance *
          preeditScale;
        const selWidth =
          shapeClusterWithFont(preeditEntry, visiblePreeditText.slice(selStart, selEnd)).advance *
          preeditScale;
        pushRect(frame.bgData, x + leftWidth, rowY, selWidth, cellH, PREEDIT_ACTIVE_BG);
        pushRect(frame.underlineData, x + leftWidth, underlineBaseY, selWidth, thickness, PREEDIT_UL);
      } else {
        const caretWidth = Math.max(1, Math.floor(cellW * 0.1));
        const caretX =
          x +
          shapeClusterWithFont(preeditEntry, visiblePreeditText.slice(0, selStart)).advance *
            preeditScale;
        pushRect(frame.cursorData, caretX, rowY + 2, caretWidth, cellH - 4, PREEDIT_CARET);
      }
      frame.getGlyphQueue(preeditFontIndex).push({
        x,
        baseY,
        xPad: 0,
        fg: PREEDIT_FG,
        bg: PREEDIT_BG,
        shaped,
        fontIndex: preeditFontIndex,
        scale: preeditScale,
        cellWidth: widthPx,
        symbolLike: false,
      });
    }
  }

  const resizeAge = performance.now() - resizeState.lastAt;
  if (
    resizeState.cols > 0 &&
    resizeState.rows > 0 &&
    resizeAge >= 0 &&
    resizeAge < RESIZE_OVERLAY_HOLD_MS + RESIZE_OVERLAY_FADE_MS
  ) {
    const fade =
      resizeAge <= RESIZE_OVERLAY_HOLD_MS
        ? 1
        : 1 - (resizeAge - RESIZE_OVERLAY_HOLD_MS) / RESIZE_OVERLAY_FADE_MS;
    const alpha = clamp(fade, 0, 1);
    if (alpha > 0.01) {
      const overlayText = `${resizeState.cols}x${resizeState.rows}`;
      const overlayEntry = fontState.fonts[0];
      if (overlayEntry?.font) {
        const shaped = shapeClusterWithFont(overlayEntry, overlayText);
        const glyphSet = frame.getGlyphSet(0);
        for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);
        const textWidth = shaped.advance * primaryScale;
        const padX = Math.max(8, cellW * 0.6);
        const padY = Math.max(6, cellH * 0.4);
        const boxW = textWidth + padX * 2;
        const boxH = lineHeight + padY * 2;
        const boxX = (deps.canvas.width - boxW) * 0.5;
        const boxY = (deps.canvas.height - boxH) * 0.5;
        const overlayBg = [0, 0, 0, 0.6 * alpha] as [number, number, number, number];
        pushRectBox(frame.overlayData, boxX, boxY, boxW, boxH, overlayBg);
        pushRectBox(frame.overlayData, boxX, boxY, boxW, 1, [1, 1, 1, 0.12 * alpha]);
        const textRowY = boxY + (boxH - lineHeight) * 0.5;
        const baseY = textRowY + yPad + baselineOffset;
        frame.getOverlayGlyphQueue(0).push({
          x: boxX + padX,
          baseY,
          xPad: 0,
          fg: [1, 1, 1, alpha],
          bg: overlayBg,
          shaped,
          fontIndex: 0,
          scale: primaryScale,
          cellWidth: textWidth,
          symbolLike: false,
        });
      }
    }
  }

  for (const [fontIndex, neededSet] of frame.neededGlyphIdsByFont.entries()) {
    const entry = fontState.fonts[fontIndex];
    if (!entry) continue;
    const atlasScale = frame.bitmapScaleByFont[fontIndex] ?? 1;
    const meta = frame.neededGlyphMetaByFont.get(fontIndex);
    const constraintContext = meta
      ? {
          cellW,
          cellH,
          yPad,
          baselineOffset,
          baselineAdjust: frame.baselineAdjustByFont[fontIndex] ?? 0,
          fontScale: frame.scaleByFont[fontIndex] ?? primaryScale,
          nerdMetrics: frame.nerdMetrics,
          fontEntry: entry,
        }
      : null;
    ensureAtlasForFont(
      state.device,
      state,
      entry,
      neededSet,
      fontSizePx,
      fontIndex,
      atlasScale,
      meta,
      constraintContext,
    );
  }
}

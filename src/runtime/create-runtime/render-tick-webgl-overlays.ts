import type { Color } from "../../renderer";
import type { WebGLTickContext } from "./render-tick-webgl.types";

export function populateWebGLOverlays(ctx: WebGLTickContext) {
  const {
    deps,
    rows,
    cols,
    cursor,
    cursorPos,
    cursorStyle,
    cursorCell,
    cursorImeAnchor,
    cellW,
    cellH,
    primaryScale,
    lineHeight,
    baselineOffset,
    yPad,
    underlineOffsetPx,
    underlineThicknessPx,
    bgData,
    underlineData,
    cursorData,
    fgRectData,
    overlayData,
    scaleByFont,
    getGlyphQueue,
    getOverlayGlyphQueue,
    getGlyphSet,
  } = ctx;

  const {
    fontState,
    pickFontIndexForText,
    fitTextTailToWidth,
    shapeClusterWithFont,
    noteColorGlyphText,
    imeState,
    PREEDIT_BG,
    PREEDIT_UL,
    PREEDIT_ACTIVE_BG,
    PREEDIT_CARET,
    PREEDIT_FG,
    resizeState,
    RESIZE_OVERLAY_HOLD_MS,
    RESIZE_OVERLAY_FADE_MS,
    canvas,
    pushRect,
    pushRectBox,
    decodePackedRGBA,
    cursorFallback,
    clamp,
    wasmExports,
    wasmHandle,
    scrollbarState,
    syncScrollbar,
  } = deps;

  if (cursor && imeState.preedit) {
    const preeditText = imeState.preedit;
    const preeditFontIndex = pickFontIndexForText(preeditText, 1);
    const preeditEntry = fontState.fonts[preeditFontIndex] ?? fontState.fonts[0];
    const preeditScale = scaleByFont[preeditFontIndex] ?? primaryScale;
    const preeditRow = cursorImeAnchor?.row ?? cursorCell?.row ?? cursor.row;
    const preeditCol = cursorImeAnchor?.col ?? cursorCell?.col ?? cursor.col;
    const maxPreeditWidthPx = Math.max(cellW, (cols - preeditCol) * cellW);
    const fittedPreedit = fitTextTailToWidth(preeditText, maxPreeditWidthPx, (value) => {
      if (!value) return 0;
      return shapeClusterWithFont(preeditEntry, value).advance * preeditScale;
    });
    const visiblePreeditText = fittedPreedit.text;
    if (!visiblePreeditText) {
      // nothing visible in viewport
    } else {
      const shaped = shapeClusterWithFont(preeditEntry, visiblePreeditText);
      noteColorGlyphText(preeditEntry, visiblePreeditText, shaped);
      const glyphSet = getGlyphSet(preeditFontIndex);
      for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);
      const baseY = preeditRow * cellH + yPad + baselineOffset;
      const x = preeditCol * cellW;
      const advancePx = shaped.advance * preeditScale;
      const widthPx = Math.max(
        cellW,
        Math.min(maxPreeditWidthPx, Math.max(fittedPreedit.widthPx, advancePx)),
      );
      const rowY = preeditRow * cellH;
      pushRect(bgData, x, rowY, widthPx, cellH, PREEDIT_BG);
      const thickness = underlineThicknessPx;
      const underlineBaseY = clamp(
        baseY + underlineOffsetPx,
        rowY + 1,
        rowY + cellH - thickness - 1,
      );
      pushRect(underlineData, x, underlineBaseY, widthPx, thickness, PREEDIT_UL);
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
        pushRect(bgData, x + leftWidth, rowY, selWidth, cellH, PREEDIT_ACTIVE_BG);
        pushRect(underlineData, x + leftWidth, underlineBaseY, selWidth, thickness, PREEDIT_UL);
      } else {
        const caretWidth = Math.max(1, Math.floor(cellW * 0.1));
        const caretX =
          x +
          shapeClusterWithFont(preeditEntry, visiblePreeditText.slice(0, selStart)).advance *
            preeditScale;
        pushRect(cursorData, caretX, rowY + 2, caretWidth, cellH - 4, PREEDIT_CARET);
      }
      getGlyphQueue(preeditFontIndex).push({
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
        const glyphSet = getGlyphSet(0);
        for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);
        const textWidth = shaped.advance * primaryScale;
        const padX = Math.max(8, cellW * 0.6);
        const padY = Math.max(6, cellH * 0.4);
        const boxW = textWidth + padX * 2;
        const boxH = lineHeight + padY * 2;
        const boxX = (canvas.width - boxW) * 0.5;
        const boxY = (canvas.height - boxH) * 0.5;
        const overlayBg: Color = [0, 0, 0, 0.6 * alpha];
        pushRectBox(overlayData, boxX, boxY, boxW, boxH, overlayBg);
        pushRectBox(overlayData, boxX, boxY, boxW, 1, [1, 1, 1, 0.12 * alpha]);
        const textRowY = boxY + (boxH - lineHeight) * 0.5;
        const baseY = textRowY + yPad + baselineOffset;
        getOverlayGlyphQueue(0).push({
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

  if (cursorStyle !== null && cursorPos) {
    let cursorCol = cursorPos.col;
    let cursorRow = cursorPos.row;
    let cursorWidth = cellW;
    if (cursorPos.wideTail && cursorCol > 0) {
      cursorCol -= 1;
      cursorWidth = cellW * 2;
    }
    if (cursorRow < rows && cursorCol < cols) {
      const x = cursorCol * cellW;
      const y = cursorRow * cellH;
      const cursorColor = cursor?.color ? decodePackedRGBA(cursor.color) : cursorFallback;
      const cursorThicknessPx = underlineThicknessPx;
      if (cursorStyle === 0) {
        pushRect(fgRectData, x, y, cursorWidth, cellH, cursorColor);
      } else if (cursorStyle === 1) {
        const offset = Math.floor((cursorThicknessPx + 1) / 2);
        pushRect(cursorData, x - offset, y, cursorThicknessPx, cellH, cursorColor);
      } else if (cursorStyle === 2) {
        const baseY = cursorRow * cellH + yPad + baselineOffset;
        const underlineY = clamp(
          baseY + underlineOffsetPx,
          y + 1,
          y + cellH - cursorThicknessPx - 1,
        );
        pushRect(cursorData, x, underlineY, cursorWidth, cursorThicknessPx, cursorColor);
      } else if (cursorStyle === 3) {
        pushRect(cursorData, x, y, cursorWidth, cursorThicknessPx, cursorColor);
        pushRect(
          cursorData,
          x,
          y + cellH - cursorThicknessPx,
          cursorWidth,
          cursorThicknessPx,
          cursorColor,
        );
        pushRect(cursorData, x, y, cursorThicknessPx, cellH, cursorColor);
        pushRect(
          cursorData,
          x + cursorWidth - cursorThicknessPx,
          y,
          cursorThicknessPx,
          cellH,
          cursorColor,
        );
      } else {
        pushRect(cursorData, x, y, cursorWidth, cellH, cursorColor);
      }
    }
  }

  if (wasmExports && wasmHandle && wasmExports.restty_scrollbar_total) {
    const total = wasmExports.restty_scrollbar_total(wasmHandle) || 0;
    const offset = wasmExports.restty_scrollbar_offset
      ? wasmExports.restty_scrollbar_offset(wasmHandle)
      : 0;
    const len = wasmExports.restty_scrollbar_len
      ? wasmExports.restty_scrollbar_len(wasmHandle)
      : rows;
    if (
      total !== scrollbarState.lastTotal ||
      offset !== scrollbarState.lastOffset ||
      len !== scrollbarState.lastLen
    ) {
      scrollbarState.lastTotal = total;
      scrollbarState.lastOffset = offset;
      scrollbarState.lastLen = len;
    }
    syncScrollbar(total, offset, len);
  }
}

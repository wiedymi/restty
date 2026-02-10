import type { Color } from "../../renderer";
import type { GlyphConstraintMeta } from "../atlas-builder";
import type {
  CollectWebGPUCellPassParams,
  GlyphQueueItem,
} from "./render-tick-webgpu.types";

export function collectWebGPUCellPass(params: CollectWebGPUCellPassParams) {
  const {
    deps,
    render,
    cellW,
    cellH,
    fontSizePx,
    primaryScale,
    lineHeight,
    baselineOffset,
    yPad,
    underlineOffsetPx,
    underlineThicknessPx,
    cursorBlock,
    cursorCell,
    blinkVisible,
    defaultBg,
  } = params;
  const {
    rows,
    cols,
    codepoints,
    contentTags,
    wide,
    styleFlags,
    linkIds,
    fgBytes,
    bgBytes,
    ulBytes,
    ulStyle,
    graphemeOffset,
    graphemeLen,
    graphemeBuffer,
  } = render;
  const {
    fontState,
    fontHeightUnits,
    fontScaleOverride,
    FONT_SCALE_OVERRIDES,
    isSymbolFont,
    isColorEmojiFont,
    fontAdvanceUnits,
    shapeClusterWithFont,
    fontMaxCellSpan,
    clamp,
    buildNerdMetrics,
    nerdIconScale,
    selectionState,
    selectionForRow,
    pushRect,
    selectionColor,
    STYLE_BOLD,
    STYLE_ITALIC,
    STYLE_FAINT,
    STYLE_BLINK,
    STYLE_INVERSE,
    STYLE_INVISIBLE,
    STYLE_STRIKE,
    STYLE_OVERLINE,
    STYLE_UNDERLINE_MASK,
    decodeRGBAWithCache,
    brighten,
    BOLD_BRIGHTEN,
    fade,
    FAINT_ALPHA,
    linkState,
    drawUnderlineStyle,
    drawStrikethrough,
    drawOverline,
    KITTY_PLACEHOLDER_CP,
    isSpaceCp,
    shouldMergeTrailingClusterCodepoint,
    isBlockElement,
    drawBlockElement,
    isBoxDrawing,
    drawBoxDrawing,
    isBraille,
    drawBraille,
    isPowerline,
    drawPowerline,
    pickFontIndexForText,
    stylePreferenceFromFlags,
    noteColorGlyphText,
    isRenderSymbolLike,
    resolveSymbolConstraint,
    isGraphicsElement,
    glyphWidthUnits,
  } = deps;

  const bgData: number[] = [];
  const selectionData: number[] = [];
  const underlineData: number[] = [];
  const cursorData: number[] = [];
  const fgRectData: number[] = [];
  const overlayData: number[] = [];
  const glyphDataNearestByFont = new Map<number, number[]>();
  const glyphDataLinearByFont = new Map<number, number[]>();
  const glyphQueueByFont = new Map<number, GlyphQueueItem[]>();
  const overlayGlyphDataNearestByFont = new Map<number, number[]>();
  const overlayGlyphDataLinearByFont = new Map<number, number[]>();
  const overlayGlyphQueueByFont = new Map<number, GlyphQueueItem[]>();
  const neededGlyphIdsByFont = new Map<number, Set<number>>();
  const neededGlyphMetaByFont = new Map<number, Map<number, GlyphConstraintMeta>>();
  const fgColorCache = new Map<number, Color>();
  const bgColorCache = new Map<number, Color>();
  const ulColorCache = new Map<number, Color>();

  const primaryEntry = fontState.fonts[0];
  const baseScaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font) return primaryScale;
    if (idx === 0) return primaryScale;
    return (
      entry.font.scaleForSize(fontSizePx, fontState.sizeMode) *
      fontScaleOverride(entry, FONT_SCALE_OVERRIDES)
    );
  });

  const scaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font) return primaryScale;
    if (idx === 0) return primaryScale;
    const baseScale = baseScaleByFont[idx] ?? primaryScale;
    if (isSymbolFont(entry) || isColorEmojiFont(entry)) return baseScale;
    const advanceUnits = fontAdvanceUnits(entry, shapeClusterWithFont);
    const maxSpan = fontMaxCellSpan(entry);
    const widthPx = advanceUnits * baseScale;
    const widthAdjustRaw = widthPx > 0 ? (cellW * maxSpan) / widthPx : 1;
    const widthAdjust = clamp(widthAdjustRaw, 0.5, 2);
    let adjustedScale = baseScale * widthAdjust;
    const adjustedHeightPx = fontHeightUnits(entry.font) * adjustedScale;
    if (adjustedHeightPx > lineHeight && adjustedHeightPx > 0) {
      adjustedScale *= lineHeight / adjustedHeightPx;
    }
    return adjustedScale;
  });

  const bitmapScaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font || idx === 0) return 1;
    if (isSymbolFont(entry)) return 1;
    const baseScale = baseScaleByFont[idx] ?? 0;
    if (baseScale <= 0) return 1;
    const targetScale = scaleByFont[idx] ?? baseScale;
    return clamp(targetScale / baseScale, 0.5, 2);
  });

  const baselineAdjustByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font || idx === 0 || !primaryEntry?.font) return 0;
    const scale = scaleByFont[idx] ?? primaryScale;
    return primaryEntry.font.ascender * primaryScale - entry.font.ascender * scale;
  });

  const nerdMetrics = buildNerdMetrics(
    cellW,
    cellH,
    lineHeight,
    primaryEntry?.font,
    primaryScale,
    nerdIconScale,
  );

  const getGlyphQueue = (fontIndex: number) => {
    if (!glyphQueueByFont.has(fontIndex)) glyphQueueByFont.set(fontIndex, []);
    return glyphQueueByFont.get(fontIndex)!;
  };
  const getOverlayGlyphQueue = (fontIndex: number) => {
    if (!overlayGlyphQueueByFont.has(fontIndex)) overlayGlyphQueueByFont.set(fontIndex, []);
    return overlayGlyphQueueByFont.get(fontIndex)!;
  };
  const getGlyphSet = (fontIndex: number) => {
    if (!neededGlyphIdsByFont.has(fontIndex)) neededGlyphIdsByFont.set(fontIndex, new Set());
    return neededGlyphIdsByFont.get(fontIndex)!;
  };
  const getGlyphMeta = (fontIndex: number) => {
    if (!neededGlyphMetaByFont.has(fontIndex)) neededGlyphMetaByFont.set(fontIndex, new Map());
    return neededGlyphMetaByFont.get(fontIndex)!;
  };
  const noteGlyphMeta = (fontIndex: number, glyphId: number, cp: number, constraintWidth: number) => {
    if (!glyphId || !cp) return;
    const meta = getGlyphMeta(fontIndex);
    const prev = meta.get(glyphId);
    if (!prev) {
      const width = Math.max(1, constraintWidth || 1);
      meta.set(glyphId, {
        cp,
        constraintWidth: width,
        widths: new Set([width]),
        variable: false,
      });
      return;
    }
    if (prev.constraintWidth !== constraintWidth) {
      prev.widths?.add(Math.max(1, constraintWidth || 1));
      meta.set(glyphId, {
        ...prev,
        constraintWidth: Math.min(prev.constraintWidth, Math.max(1, constraintWidth || 1)),
        variable: true,
      });
    }
  };

  const mergedEmojiSkip = new Uint8Array(codepoints.length);
  const isRegionalIndicator = (value: number) => value >= 0x1f1e6 && value <= 0x1f1ff;
  const readCellCluster = (
    cellIndex: number,
  ): { cp: number; text: string; span: number } | null => {
    const flag = wide ? (wide[cellIndex] ?? 0) : 0;
    if (flag === 2 || flag === 3) return null;
    const cp = codepoints[cellIndex] ?? 0;
    if (!cp) return null;
    let text = String.fromCodePoint(cp);
    const extra =
      graphemeLen && graphemeOffset && graphemeBuffer ? (graphemeLen[cellIndex] ?? 0) : 0;
    if (extra > 0 && graphemeOffset && graphemeBuffer) {
      const start = graphemeOffset[cellIndex] ?? 0;
      const cps = [cp];
      for (let j = 0; j < extra; j += 1) {
        const extraCp = graphemeBuffer[start + j];
        if (extraCp) cps.push(extraCp);
      }
      text = String.fromCodePoint(...cps);
    }
    return { cp, text, span: flag === 1 ? 2 : 1 };
  };

  for (let row = 0; row < rows; row += 1) {
    const rowY = row * cellH;
    const baseY = rowY + yPad + baselineOffset;
    const localSel = selectionState.active ? selectionForRow(row, cols) : null;
    const selStart = localSel?.start ?? -1;
    const selEnd = localSel?.end ?? -1;
    if (selStart >= 0 && selEnd > selStart) {
      const start = Math.max(0, selStart);
      const end = Math.min(cols, selEnd);
      pushRect(selectionData, start * cellW, rowY, (end - start) * cellW, cellH, selectionColor);
    }

    for (let col = 0; col < cols; col += 1) {
      const idx = row * cols + col;
      const x = col * cellW;

      const tag = contentTags ? contentTags[idx] : 0;
      const bgOnly = tag === 2 || tag === 3;
      const flags = styleFlags ? styleFlags[idx] : 0;
      const bold = (flags & STYLE_BOLD) !== 0;
      const italic = (flags & STYLE_ITALIC) !== 0;
      const faint = (flags & STYLE_FAINT) !== 0;
      const blink = (flags & STYLE_BLINK) !== 0;
      const inverse = (flags & STYLE_INVERSE) !== 0;
      const invisible = (flags & STYLE_INVISIBLE) !== 0;
      const strike = (flags & STYLE_STRIKE) !== 0;
      const overline = (flags & STYLE_OVERLINE) !== 0;
      const underlineStyle = ulStyle ? ulStyle[idx] : (flags & STYLE_UNDERLINE_MASK) >> 8;

      let fg = decodeRGBAWithCache(fgBytes, idx, fgColorCache);
      let bg = bgBytes ? decodeRGBAWithCache(bgBytes, idx, bgColorCache) : defaultBg;
      let ul = ulBytes ? decodeRGBAWithCache(ulBytes, idx, ulColorCache) : fg;
      const underlineUsesFg =
        ul[0] === fg[0] && ul[1] === fg[1] && ul[2] === fg[2] && ul[3] === fg[3];

      if (inverse) {
        const tmp = fg;
        fg = bg;
        bg = tmp;
        if (underlineUsesFg) ul = fg;
      }

      if (bold) {
        fg = brighten(fg, BOLD_BRIGHTEN);
        ul = brighten(ul, BOLD_BRIGHTEN);
      }
      if (faint) {
        fg = fade(fg, FAINT_ALPHA);
        ul = fade(ul, FAINT_ALPHA);
      }

      const bgForText =
        bg[3] < 1
          ? [
              bg[0] + defaultBg[0] * (1 - bg[3]),
              bg[1] + defaultBg[1] * (1 - bg[3]),
              bg[2] + defaultBg[2] * (1 - bg[3]),
              1,
            ]
          : bg;
      if ((bgBytes || inverse) && bg[3] > 0) pushRect(bgData, x, rowY, cellW, cellH, bg);

      const linkId = linkIds ? (linkIds[idx] ?? 0) : 0;
      const linkHovered = linkId && linkId === linkState.hoverId;
      const blinkOff = blink && !blinkVisible;
      const textHidden = invisible || blinkOff;
      if (!textHidden && !bgOnly) {
        if (underlineStyle > 0 && ul[3] > 0) {
          drawUnderlineStyle(
            underlineData,
            underlineStyle,
            x,
            rowY,
            cellW,
            cellH,
            baseY,
            underlineOffsetPx,
            underlineThicknessPx,
            ul,
          );
        }
        if (linkHovered && !selectionState.active && !selectionState.dragging) {
          drawUnderlineStyle(
            underlineData,
            1,
            x,
            rowY,
            cellW,
            cellH,
            baseY,
            underlineOffsetPx,
            underlineThicknessPx,
            ul,
          );
        }
        if (strike) drawStrikethrough(underlineData, x, rowY, cellW, cellH, fg);
        if (overline) drawOverline(underlineData, x, rowY, cellW, fg);
      }

      if (bgOnly || textHidden) continue;

      if (mergedEmojiSkip[idx]) continue;
      const cluster = readCellCluster(idx);
      if (!cluster) continue;
      const cp = cluster.cp;
      if (cp === KITTY_PLACEHOLDER_CP) continue;
      let text = cluster.text;
      let baseSpan = cluster.span;
      const rowEnd = row * cols + cols;

      if (isRegionalIndicator(cp)) {
        const nextIdx = idx + baseSpan;
        if (nextIdx < rowEnd && !mergedEmojiSkip[nextIdx]) {
          const next = readCellCluster(nextIdx);
          if (next && isRegionalIndicator(next.cp)) {
            text += next.text;
            baseSpan += next.span;
            mergedEmojiSkip[nextIdx] = 1;
          }
        }
      }

      let nextSeqIdx = idx + baseSpan;
      let guard = 0;
      while (nextSeqIdx < rowEnd && guard < 12) {
        const next = readCellCluster(nextSeqIdx);
        if (!next || !next.cp || isSpaceCp(next.cp)) break;
        const shouldMerge =
          text.endsWith("\u200d") || shouldMergeTrailingClusterCodepoint(next.cp);
        if (!shouldMerge) break;
        text += next.text;
        baseSpan += next.span;
        mergedEmojiSkip[nextSeqIdx] = 1;
        nextSeqIdx += next.span;
        guard += 1;
      }

      const extra = text.length > String.fromCodePoint(cp).length ? 1 : 0;
      if (extra === 0 && isSpaceCp(cp)) continue;

      if (
        cursorBlock &&
        cursorCell &&
        row === cursorCell.row &&
        col >= cursorCell.col &&
        col < cursorCell.col + (cursorCell.wide ? 2 : 1)
      ) {
        fg = [bgForText[0], bgForText[1], bgForText[2], 1];
      }

      if (isBlockElement(cp)) {
        if (drawBlockElement(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }

      if (isBoxDrawing(cp)) {
        if (drawBoxDrawing(cp, x, rowY, cellW, cellH, fg, fgRectData, underlineThicknessPx)) {
          continue;
        }
      }

      if (isBraille(cp)) {
        if (drawBraille(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }

      if (isPowerline(cp)) {
        if (drawPowerline(cp, x, rowY, cellW, cellH, fg, fgRectData)) continue;
      }

      if (extra > 0 && text.trim() === "") continue;

      const fontIndex = pickFontIndexForText(text, baseSpan, stylePreferenceFromFlags(bold, italic));
      const fontEntry = fontState.fonts[fontIndex] ?? fontState.fonts[0];
      const shaped = shapeClusterWithFont(fontEntry, text);
      if (!shaped.glyphs.length) continue;
      noteColorGlyphText(fontEntry, text, shaped);
      const glyphSet = getGlyphSet(fontIndex);
      for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);

      const fontScale = scaleByFont[fontIndex] ?? primaryScale;
      let cellSpan = baseSpan;
      const symbolLike = isRenderSymbolLike(cp);
      const nerdConstraint = symbolLike ? resolveSymbolConstraint(cp) : null;
      const symbolConstraint = !!nerdConstraint;
      let constraintWidth = baseSpan;
      let forceFit = false;
      let glyphWidthPx = 0;
      if (symbolLike) {
        if (baseSpan === 1) {
          // Match Ghostty behavior for icon-like Nerd glyphs: allow 2-cell span only
          // when followed by whitespace and not in a symbol run.
          if (nerdConstraint?.height === "icon") {
            constraintWidth = 1;
            if (col < cols - 1) {
              if (col > 0) {
                const prevCp = codepoints[idx - 1];
                if (isRenderSymbolLike(prevCp) && !isGraphicsElement(prevCp)) {
                  constraintWidth = 1;
                } else {
                  const nextCp = codepoints[idx + 1];
                  if (!nextCp || isSpaceCp(nextCp)) constraintWidth = 2;
                }
              } else {
                const nextCp = codepoints[idx + 1];
                if (!nextCp || isSpaceCp(nextCp)) constraintWidth = 2;
              }
            }
          } else {
            constraintWidth = 1;
          }
          cellSpan = constraintWidth;
        }
        if (shaped.glyphs.length === 1) {
          const glyphId = shaped.glyphs[0].glyphId;
          const widthUnits = glyphWidthUnits(fontEntry, glyphId);
          if (widthUnits > 0) {
            glyphWidthPx = widthUnits * fontScale;
          }
        }
        if (!glyphWidthPx) {
          glyphWidthPx = shaped.advance * fontScale;
        }
        if (glyphWidthPx > cellW * cellSpan * 1.05) {
          forceFit = true;
        }
      }
      if (symbolConstraint) {
        for (const glyph of shaped.glyphs) {
          noteGlyphMeta(fontIndex, glyph.glyphId, cp, constraintWidth);
        }
      }
      const cellWidthPx = cellW * cellSpan;
      const xPad = 0;
      getGlyphQueue(fontIndex).push({
        x,
        baseY,
        xPad,
        fg,
        bg: bgForText,
        shaped,
        fontIndex,
        scale: fontScale,
        cellWidth: cellWidthPx,
        symbolLike,
        symbolConstraint,
        constraintWidth,
        forceFit,
        glyphWidthPx,
        cp,
        italic,
        bold,
      });
    }
  }
  return {
    bgData,
    selectionData,
    underlineData,
    cursorData,
    fgRectData,
    overlayData,
    glyphDataNearestByFont,
    glyphDataLinearByFont,
    glyphQueueByFont,
    overlayGlyphDataNearestByFont,
    overlayGlyphDataLinearByFont,
    overlayGlyphQueueByFont,
    neededGlyphIdsByFont,
    neededGlyphMetaByFont,
    scaleByFont,
    bitmapScaleByFont,
    baselineAdjustByFont,
    nerdMetrics,
    getGlyphQueue,
    getOverlayGlyphQueue,
    getGlyphSet,
  };
}

import type { Color } from "../../renderer";
import { fallbackEmScale, type Font, type FontEntry } from "../../fonts";
import type { GlyphConstraintMeta } from "../fonts/atlas-builder";
import { resolveFallbackBaselineAdjust, resolveWideFallbackScale } from "../fonts/fallback-layout";
import { resolveLigatureRun, resolveRenderableLigatureRun } from "./ligature-runs";
import type { CollectWebGPUCellPassParams, GlyphQueueItem } from "./render-tick-webgpu.types";
import {
  resolveHighlightBackgroundColor,
  resolveHighlightForegroundColor,
} from "./highlight-terminal-color-utils";
import { searchHighlightForColumn } from "./search-highlight-utils";

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
    isAppleSymbolsFont,
    isColorEmojiFont,
    fontAdvanceUnits,
    shapeClusterWithFont,
    fontMaxCellSpan,
    clamp,
    buildNerdMetrics,
    nerdIconScale,
    selectionState,
    selectionForRow,
    getSearchViewportMatches,
    pushRect,
    selectionBackgroundColor,
    selectionForegroundColor,
    searchMatchBackgroundColor,
    searchCurrentMatchBackgroundColor,
    searchMatchTextColor,
    searchCurrentMatchTextColor,
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
  const mergedLigatureSkip = new Uint8Array(codepoints.length);

  const primaryEntry = fontState.fonts[0];
  type FallbackScaleMetric = "ic_width" | "ex_height" | "cap_height" | "line_height";
  const resolveFallbackMetric = (font: Font | null | undefined, metric: FallbackScaleMetric) => {
    if (!font) return 0;
    if (metric === "ic_width") {
      const glyphId = font.glyphIdForChar("水");
      if (!glyphId) return 0;
      const advance = font.advanceWidth(glyphId);
      if (!Number.isFinite(advance) || advance <= 0) return 0;
      const bounds = font.getGlyphBounds(glyphId);
      if (bounds) {
        const width = bounds.xMax - bounds.xMin;
        // If outline width exceeds advance, ic-width is likely unreliable for scaling.
        if (Number.isFinite(width) && width > advance) return 0;
      }
      return advance;
    }
    if (metric === "ex_height") {
      const exHeight = font.os2?.sxHeight ?? 0;
      return Number.isFinite(exHeight) && exHeight > 0 ? exHeight : 0;
    }
    if (metric === "cap_height") {
      const capHeight = font.os2?.sCapHeight ?? 0;
      return Number.isFinite(capHeight) && capHeight > 0 ? capHeight : 0;
    }
    const lineHeightUnits = font.height;
    return Number.isFinite(lineHeightUnits) && lineHeightUnits > 0 ? lineHeightUnits : 0;
  };
  const fallbackScaleAdjustment = (
    primary: FontEntry | undefined,
    entry: FontEntry | undefined,
  ): number => {
    if (!primary?.font || !entry?.font) return 1;
    const metricOrder: FallbackScaleMetric[] = [
      "ic_width",
      "ex_height",
      "cap_height",
      "line_height",
    ];
    for (let i = 0; i < metricOrder.length; i += 1) {
      const metric = metricOrder[i];
      const primaryMetric = resolveFallbackMetric(primary.font, metric);
      const fallbackMetric = resolveFallbackMetric(entry.font, metric);
      if (primaryMetric <= 0 || fallbackMetric <= 0) continue;
      const factor = primaryMetric / fallbackMetric;
      if (Number.isFinite(factor) && factor > 0) return factor;
    }
    return 1;
  };
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
    const preserveNaturalSymbolScale = isSymbolFont(entry) && !isAppleSymbolsFont(entry);
    if (preserveNaturalSymbolScale) {
      // Match Ghostty: symbol fonts render at the primary font's em size with
      // no per-face size normalization (SizeAdjustment.none).
      const emScale = fallbackEmScale(primaryEntry?.font, primaryScale, entry.font);
      if (emScale > 0) return emScale * fontScaleOverride(entry, FONT_SCALE_OVERRIDES);
      return baseScale;
    }
    if (isColorEmojiFont(entry)) return baseScale;
    const metricAdjust = clamp(fallbackScaleAdjustment(primaryEntry, entry), 1, 2);
    let adjustedScale = baseScale * metricAdjust;
    const maxSpan = fontMaxCellSpan(entry);
    if (maxSpan > 1) {
      const advanceUnits = fontAdvanceUnits(entry, shapeClusterWithFont);
      adjustedScale = resolveWideFallbackScale({
        scale: adjustedScale,
        advanceUnits,
        cellWidth: cellW,
        maxSpan,
      });
    }
    const adjustedHeightPx = fontHeightUnits(entry.font) * adjustedScale;
    if (adjustedHeightPx > lineHeight && adjustedHeightPx > 0) {
      adjustedScale *= lineHeight / adjustedHeightPx;
    }
    return adjustedScale;
  });

  const bitmapScaleByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font || idx === 0) return 1;
    const baseScale = baseScaleByFont[idx] ?? 0;
    if (baseScale <= 0) return 1;
    const targetScale = scaleByFont[idx] ?? baseScale;
    return clamp(targetScale / baseScale, 0.5, 2);
  });

  const baselineAdjustByFont = fontState.fonts.map((entry, idx) => {
    if (!entry?.font || idx === 0 || !primaryEntry?.font) return 0;
    const scale = scaleByFont[idx] ?? primaryScale;
    const preserveNaturalSymbolScale = isSymbolFont(entry) && !isAppleSymbolsFont(entry);
    return resolveFallbackBaselineAdjust({
      primaryScale,
      fallbackScale: scale,
      primaryAscender: primaryEntry.font.ascender,
      fallbackAscender: entry.font.ascender,
      regularTextFallback: !preserveNaturalSymbolScale && !isColorEmojiFont(entry),
    });
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
  const noteGlyphMeta = (
    fontIndex: number,
    glyphId: number,
    cp: number,
    constraintWidth: number,
  ) => {
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
  const searchMatches = getSearchViewportMatches();
  let searchMatchIndex = 0;
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
    const rowSearchStartIndex = searchMatchIndex;
    while (searchMatchIndex < searchMatches.length) {
      const match = searchMatches[searchMatchIndex]!;
      if (match.row < row) {
        searchMatchIndex += 1;
        continue;
      }
      if (match.row > row) break;
      searchMatchIndex += 1;
    }
    const rowSearchEndIndex = searchMatchIndex;
    let rowSearchCursor = rowSearchStartIndex;

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

      const selectionActiveForCell = selStart >= 0 && col >= selStart && col < selEnd;
      let searchHighlightKind = 0;
      if (!selectionActiveForCell && rowSearchCursor < rowSearchEndIndex) {
        const searchHighlight = searchHighlightForColumn(
          searchMatches,
          rowSearchCursor,
          rowSearchEndIndex,
          col,
          cols,
        );
        rowSearchCursor = searchHighlight.nextIndex;
        searchHighlightKind = searchHighlight.kind;
      }

      if (selectionActiveForCell) {
        const selectionBg = resolveHighlightBackgroundColor(
          selectionBackgroundColor,
          fg,
          bg,
          inverse,
        );
        pushRect(selectionData, x, rowY, cellW, cellH, selectionBg);
        if (selectionForegroundColor) {
          const selectionFg = resolveHighlightForegroundColor(
            selectionForegroundColor,
            fg,
            bg,
            inverse,
          );
          fg = selectionFg;
          ul = selectionFg;
        }
      } else if (searchHighlightKind === 1 || searchHighlightKind === 2) {
        const searchBg = resolveHighlightBackgroundColor(
          searchHighlightKind === 2
            ? searchCurrentMatchBackgroundColor
            : searchMatchBackgroundColor,
          fg,
          bg,
          inverse,
        );
        const searchFg = resolveHighlightForegroundColor(
          searchHighlightKind === 2 ? searchCurrentMatchTextColor : searchMatchTextColor,
          fg,
          bg,
          inverse,
        );
        pushRect(selectionData, x, rowY, cellW, cellH, searchBg);
        fg = searchFg;
        ul = searchFg;
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

      if (mergedEmojiSkip[idx] || mergedLigatureSkip[idx]) continue;
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
        const shouldMerge = text.endsWith("\u200d") || shouldMergeTrailingClusterCodepoint(next.cp);
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

      const ligatureRun = deps.getLigatures()
        ? resolveLigatureRun({
            idx,
            row,
            col,
            cols,
            contentTags,
            styleFlags,
            linkIds,
            fgBytes,
            bgBytes,
            ulBytes,
            ulStyle,
            cursorBlock,
            cursorCell,
            readCellCluster,
          })
        : null;
      const renderableLigatureRun = ligatureRun
        ? resolveRenderableLigatureRun({
            ligatureRun,
            stylePreference: stylePreferenceFromFlags(bold, italic),
            fonts: fontState.fonts,
            pickFontIndexForText,
            shapeClusterWithFont,
            readCellCluster,
          })
        : null;
      if (renderableLigatureRun) {
        text = renderableLigatureRun.text;
        baseSpan = renderableLigatureRun.span;
        for (let i = 1; i < renderableLigatureRun.indices.length; i += 1) {
          mergedLigatureSkip[renderableLigatureRun.indices[i]] = 1;
        }
      }

      const fontIndex = pickFontIndexForText(
        text,
        baseSpan,
        stylePreferenceFromFlags(bold, italic),
      );
      const fontEntry = fontState.fonts[fontIndex] ?? fontState.fonts[0];
      const shaped = shapeClusterWithFont(fontEntry, text);
      if (!shaped.glyphs.length) continue;
      noteColorGlyphText(fontEntry, text, shaped);
      const glyphSet = getGlyphSet(fontIndex);
      for (const glyph of shaped.glyphs) glyphSet.add(glyph.glyphId);

      const fontScale = scaleByFont[fontIndex] ?? primaryScale;
      let cellSpan = baseSpan;
      const nerdConstraint = resolveSymbolConstraint(cp);
      const symbolLike = isRenderSymbolLike(cp) || !!nerdConstraint;
      const symbolConstraint = !!nerdConstraint;
      let constraintWidth = baseSpan;
      let forceFit = false;
      let glyphWidthPx = 0;
      if (symbolLike) {
        if (baseSpan === 1) {
          // Match Ghostty's symbol constraint width rule:
          // allow 2-cell span only when followed by whitespace and not in a symbol run.
          constraintWidth = 1;
          if (col < cols - 1) {
            if (col > 0) {
              const prevCp = codepoints[idx - 1];
              if (
                !(
                  (isRenderSymbolLike(prevCp) || !!resolveSymbolConstraint(prevCp)) &&
                  !isGraphicsElement(prevCp)
                )
              ) {
                const nextCp = codepoints[idx + 1];
                if (!nextCp || isSpaceCp(nextCp)) constraintWidth = 2;
              }
            } else {
              const nextCp = codepoints[idx + 1];
              if (!nextCp || isSpaceCp(nextCp)) constraintWidth = 2;
            }
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

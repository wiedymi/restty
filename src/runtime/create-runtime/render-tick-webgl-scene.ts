import type { WebGLTickContext } from "./render-tick-webgl.types";
import {
  resolveHighlightBackgroundColor,
  resolveHighlightForegroundColor,
} from "./highlight-terminal-color-utils";
import { searchHighlightForColumn } from "./search-highlight-utils";

import { resolveLigatureRun, resolveRenderableLigatureRun } from "./ligature-runs";

export function populateWebGLSceneData(ctx: WebGLTickContext) {
  const {
    deps,
    rows,
    cols,
    codepoints,
    contentTags,
    styleFlags,
    linkIds,
    fgBytes,
    bgBytes,
    ulBytes,
    ulStyle,
    mergedEmojiSkip,
    readCellCluster,
    blinkVisible,
    cursorStyle,
    cursorCell,
    cellW,
    cellH,
    primaryScale,
    baselineOffset,
    yPad,
    underlineOffsetPx,
    underlineThicknessPx,
    bgData,
    selectionData,
    underlineData,
    fgRectData,
    fgColorCache,
    bgColorCache,
    ulColorCache,
    scaleByFont,
    getGlyphQueue,
    getGlyphSet,
    noteGlyphMeta,
  } = ctx;
  const mergedLigatureSkip = new Uint8Array(codepoints.length);

  const {
    fontState,
    defaultBg,
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
    shapeClusterWithFont,
  } = deps;

  const isRegionalIndicator = (value: number) => value >= 0x1f1e6 && value <= 0x1f1ff;
  const searchMatches = getSearchViewportMatches();
  let searchMatchIndex = 0;

  const cursorBlock = cursorStyle === 0 && !!cursorCell;
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
        if (drawBoxDrawing(cp, x, rowY, cellW, cellH, fg, fgRectData, underlineThicknessPx))
          continue;
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
}

import type { Color, WebGLState } from "../../renderer";
import type { GlyphConstraintMeta } from "../atlas-builder";
import type { GlyphQueueItem } from "./render-tick-webgpu.types";
import type { WebGLTickContext, WebGLTickDeps } from "./render-tick-webgl.types";

export type { WebGLTickContext } from "./render-tick-webgl.types";

export function buildWebGLTickContext(deps: WebGLTickDeps, state: WebGLState): WebGLTickContext | null {
  const {
    isShaderStagesDirty,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    getCompiledWebGLShaderStages,
    ensureWebGLStageTargets,
    canvas,
    defaultBg,
    fontError,
    termDebug,
    reportDebugText,
    updateGrid,
    getRenderState,
    fontState,
    clearKittyOverlay,
    resolveBlendFlags,
    alphaBlending,
    reportTermSize,
    resolveCursorPosition,
    reportCursor,
    FORCE_CURSOR_BLINK,
    CURSOR_BLINK_MS,
    imeInput,
    resolveCursorStyle,
    isFocused,
    imeState,
    resolveImeAnchor,
    gridState,
    fontHeightUnits,
    updateImePosition,
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
  } = deps;

  const { gl } = state;
  if (isShaderStagesDirty()) {
    rebuildWebGLShaderStages(state);
    setShaderStagesDirty(false);
  }
  const compiledWebGLStages = getCompiledWebGLShaderStages();
  const stageTargets = compiledWebGLStages.length > 0 ? ensureWebGLStageTargets(state) : null;
  const hasShaderStages = compiledWebGLStages.length > 0 && !!stageTargets;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.bindFramebuffer(
    gl.FRAMEBUFFER,
    hasShaderStages && stageTargets ? stageTargets.sceneFramebuffer : null,
  );
  gl.clearColor(defaultBg[0], defaultBg[1], defaultBg[2], defaultBg[3]);
  gl.clear(gl.COLOR_BUFFER_BIT);

  if (fontError) {
    const text = `Font error: ${fontError.message}`;
    if (termDebug) termDebug.textContent = text;
    reportDebugText(text);
  }

  updateGrid();

  const render = getRenderState();
  if (!render || !fontState.font) {
    clearKittyOverlay();
    return null;
  }

  deps.lastRenderState = render;

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
    cursor,
  } = render;

  if (!codepoints || !fgBytes) {
    clearKittyOverlay();
    return null;
  }

  const mergedEmojiSkip = new Uint8Array(codepoints.length);
  const readCellCluster = (cellIndex: number): { cp: number; text: string; span: number } | null => {
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

  const { useLinearBlending, useLinearCorrection } = resolveBlendFlags(alphaBlending, "webgl2");

  reportTermSize(cols, rows);
  const cursorPos = cursor ? resolveCursorPosition(cursor) : null;
  reportCursor(cursorPos);
  const isBlinking = (cursor?.blinking || 0) !== 0 || FORCE_CURSOR_BLINK;
  const blinkVisible = !isBlinking || Math.floor(performance.now() / CURSOR_BLINK_MS) % 2 === 0;
  const imeFocused =
    typeof document !== "undefined" && imeInput ? document.activeElement === imeInput : false;
  const cursorStyle = cursor
    ? resolveCursorStyle(cursor, {
        focused: isFocused || imeFocused,
        preedit: Boolean(imeState.preedit),
        blinkVisible,
      })
    : null;
  let cursorCell: { row: number; col: number; wide: boolean } | null = null;
  if (cursorStyle !== null && cursorPos) {
    let col = cursorPos.col;
    const row = cursorPos.row;
    let wideCell = false;
    if (cursorPos.wideTail && col > 0) {
      col -= 1;
      wideCell = true;
    }
    cursorCell = { row, col, wide: wideCell };
  }
  const cursorImeAnchor = resolveImeAnchor(cursorPos, cols, rows);

  const cellW = gridState.cellW || canvas.width / cols;
  const cellH = gridState.cellH || canvas.height / rows;
  const fontSizePx = gridState.fontSizePx || Math.max(1, Math.round(cellH));
  const primaryEntry = fontState.fonts[0];
  const primaryScale =
    gridState.scale || fontState.font.scaleForSize(fontSizePx, fontState.sizeMode);
  const lineHeight = gridState.lineHeight || fontHeightUnits(fontState.font) * primaryScale;
  const baselineOffset = gridState.baselineOffset || fontState.font.ascender * primaryScale;
  const yPad = gridState.yPad ?? (cellH - lineHeight) / 2;
  const post = fontState.font.post;
  const underlinePosition = post?.underlinePosition ?? Math.round(-fontState.font.upem * 0.08);
  const underlineThickness = post?.underlineThickness ?? Math.round(fontState.font.upem * 0.05);
  const underlineOffsetPx = -underlinePosition * primaryScale;
  const underlineThicknessPx = Math.max(1, Math.ceil(underlineThickness * primaryScale));

  if (cursorImeAnchor) {
    updateImePosition(cursorImeAnchor, cellW, cellH);
  }

  const bgData: number[] = [];
  const selectionData: number[] = [];
  const underlineData: number[] = [];
  const cursorData: number[] = [];
  const fgRectData: number[] = [];
  const overlayData: number[] = [];
  const glyphDataByFont = new Map<number, number[]>();
  const glyphQueueByFont = new Map<number, GlyphQueueItem[]>();
  const overlayGlyphDataByFont = new Map<number, number[]>();
  const overlayGlyphQueueByFont = new Map<number, GlyphQueueItem[]>();
  const neededGlyphIdsByFont = new Map<number, Set<number>>();
  const neededGlyphMetaByFont = new Map<number, Map<number, GlyphConstraintMeta>>();
  const fgColorCache = new Map<number, Color>();
  const bgColorCache = new Map<number, Color>();
  const ulColorCache = new Map<number, Color>();

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
  const getGlyphData = (map: Map<number, number[]>, fontIndex: number) => {
    if (!map.has(fontIndex)) map.set(fontIndex, []);
    return map.get(fontIndex)!;
  };

  return {
    deps,
    state,
    rows,
    cols,
    codepoints: codepoints as Uint32Array,
    contentTags,
    wide,
    styleFlags,
    linkIds,
    fgBytes: fgBytes as Uint8Array,
    bgBytes,
    ulBytes,
    ulStyle,
    graphemeOffset,
    graphemeLen,
    graphemeBuffer,
    cursor,
    mergedEmojiSkip,
    readCellCluster,
    useLinearBlending,
    useLinearCorrection,
    blinkVisible,
    cursorPos,
    cursorStyle,
    cursorCell,
    cursorImeAnchor,
    cellW,
    cellH,
    fontSizePx,
    primaryEntry,
    primaryScale,
    lineHeight,
    baselineOffset,
    yPad,
    underlineOffsetPx,
    underlineThicknessPx,
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
    fgColorCache,
    bgColorCache,
    ulColorCache,
    scaleByFont,
    bitmapScaleByFont,
    baselineAdjustByFont,
    nerdMetrics,
    getGlyphQueue,
    getOverlayGlyphQueue,
    getGlyphSet,
    noteGlyphMeta,
    getGlyphData,
    compiledWebGLStages,
    stageTargets,
    hasShaderStages,
  };
}

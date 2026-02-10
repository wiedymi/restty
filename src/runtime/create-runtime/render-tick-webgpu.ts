import type { WebGPUState } from "../../renderer";
import { collectWebGPUCellPass } from "./render-tick-webgpu-cell-pass";
import { drawWebGPUFrame } from "./render-tick-webgpu-draw-pass";
import { augmentWebGPUFrameWithOverlaysAndAtlas } from "./render-tick-webgpu-overlays-atlas";
import type { RuntimeTickDeps } from "./render-tick-webgpu.types";

export function tickWebGPU(deps: RuntimeTickDeps, state: WebGPUState) {
  const {
    isShaderStagesDirty,
    rebuildWebGPUShaderStages,
    setShaderStagesDirty,
    getCompiledWebGPUShaderStages,
    ensureWebGPUStageTargets,
    fontError,
    termDebug,
    reportDebugText,
    updateGrid,
    getRenderState,
    fontState,
    clearKittyOverlay,
    resolveBlendFlags,
    alphaBlending,
    srgbToLinearColor,
    defaultBg,
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
    dbgEl,
    wasmExports,
    wasmHandle,
    gridState,
    canvas,
    fontHeightUnits,
    updateImePosition,
  } = deps;

  const { device, context } = state;
  if (isShaderStagesDirty()) {
    rebuildWebGPUShaderStages(state);
    setShaderStagesDirty(false);
  }
  const compiledWebGPUStages = getCompiledWebGPUShaderStages();
  const shaderStageCount = compiledWebGPUStages.length;
  const stageTargets = shaderStageCount > 0 ? ensureWebGPUStageTargets(state) : null;
  const hasShaderStages = shaderStageCount > 0 && !!stageTargets;

  if (fontError) {
    const text = `Font error: ${fontError.message}`;
    if (termDebug) termDebug.textContent = text;
    reportDebugText(text);
  }

  updateGrid();

  const render = getRenderState();
  if (!render || !fontState.font) {
    // During live resize, render state can be momentarily unavailable.
    // Keep the last presented frame instead of flashing a cleared frame.
    if (deps.lastRenderState) {
      clearKittyOverlay();
      return;
    }
    const { useLinearBlending } = resolveBlendFlags(alphaBlending, "webgpu", state);
    const clearColor = useLinearBlending ? srgbToLinearColor(defaultBg) : defaultBg;
    const encoder = device.createCommandEncoder();
    const presentView = context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: presentView,
          clearValue: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.end();
    device.queue.submit([encoder.finish()]);
    clearKittyOverlay();
    return;
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

  if (!codepoints || !fgBytes) return;

  const { useLinearBlending, useLinearCorrection } = resolveBlendFlags(
    alphaBlending,
    "webgpu",
    state,
  );
  const clearColor = useLinearBlending ? srgbToLinearColor(defaultBg) : defaultBg;

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
  if (dbgEl && wasmExports && wasmHandle) {
    const cx = wasmExports.restty_debug_cursor_x ? wasmExports.restty_debug_cursor_x(wasmHandle) : 0;
    const cy = wasmExports.restty_debug_cursor_y ? wasmExports.restty_debug_cursor_y(wasmHandle) : 0;
    const sl = wasmExports.restty_debug_scroll_left
      ? wasmExports.restty_debug_scroll_left(wasmHandle)
      : 0;
    const sr = wasmExports.restty_debug_scroll_right
      ? wasmExports.restty_debug_scroll_right(wasmHandle)
      : 0;
    const tc = wasmExports.restty_debug_term_cols ? wasmExports.restty_debug_term_cols(wasmHandle) : 0;
    const tr = wasmExports.restty_debug_term_rows ? wasmExports.restty_debug_term_rows(wasmHandle) : 0;
    const pc = wasmExports.restty_debug_page_cols ? wasmExports.restty_debug_page_cols(wasmHandle) : 0;
    const pr = wasmExports.restty_debug_page_rows ? wasmExports.restty_debug_page_rows(wasmHandle) : 0;
    const text = `${cx},${cy} | ${sl}-${sr} | t:${tc}x${tr} p:${pc}x${pr}`;
    reportDebugText(text);
  }

  const cellW = gridState.cellW || canvas.width / cols;
  const cellH = gridState.cellH || canvas.height / rows;
  const fontSizePx = gridState.fontSizePx || Math.max(1, Math.round(cellH));
  const primaryScale =
    gridState.scale || fontState.font.scaleForSize(fontSizePx, fontState.sizeMode);
  const lineHeight = gridState.lineHeight || fontHeightUnits(fontState.font) * primaryScale;
  const baselineOffset = gridState.baselineOffset || fontState.font.ascender * primaryScale;
  const yPad = gridState.yPad ?? (cellH - lineHeight) / 2;
  const post = fontState.font.post;
  const underlinePosition = post?.underlinePosition ?? Math.round(-fontState.font.upem * 0.08);
  const underlineThickness = post?.underlineThickness ?? Math.round(fontState.font.upem * 0.05);
  // OpenType underlinePosition is in Y-up font space (negative means below baseline).
  // Screen space is Y-down, so we flip the sign.
  const underlineOffsetPx = -underlinePosition * primaryScale;
  const underlineThicknessPx = Math.max(1, Math.ceil(underlineThickness * primaryScale));

  if (cursorImeAnchor) {
    updateImePosition(cursorImeAnchor, cellW, cellH);
  }

  const frame = collectWebGPUCellPass({
    deps,
    render: {
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
    },
    cellW,
    cellH,
    fontSizePx,
    primaryScale,
    lineHeight,
    baselineOffset,
    yPad,
    underlineOffsetPx,
    underlineThicknessPx,
    cursorBlock: cursorStyle === 0 && !!cursorCell,
    cursorCell,
    blinkVisible,
    defaultBg,
  });

  augmentWebGPUFrameWithOverlaysAndAtlas({
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
  });

  drawWebGPUFrame({
    deps,
    state,
    frame,
    cursor,
    cursorPos,
    cursorStyle,
    rows,
    cols,
    cellW,
    cellH,
    yPad,
    baselineOffset,
    underlineOffsetPx,
    underlineThicknessPx,
    primaryScale,
    useLinearBlending,
    useLinearCorrection,
    clearColor,
    hasShaderStages,
    stageTargets,
    compiledWebGPUStages,
  });
}

import { expect, test } from "bun:test";
import { populateWebGLOverlays } from "../src/runtime/create-runtime/render-tick-webgl-overlays";

function createOverlayContext(options: {
  cols: number;
  rows: number;
  holdMs: number;
  fadeMs: number;
}) {
  const overlayQueue: Array<Record<string, unknown>> = [];
  const overlayGlyphSet = new Set<number>();
  const overlayData: number[] = [];

  const ctx = {
    deps: {
      fontState: { fonts: [{ font: {} }] },
      pickFontIndexForText: () => 0,
      fitTextTailToWidth: () => ({ text: "", widthPx: 0, offset: 0 }),
      shapeClusterWithFont: (_entry: unknown, text: string) => ({
        advance: text.length * 10,
        glyphs: [{ glyphId: 101 }],
      }),
      noteColorGlyphText: () => undefined,
      imeState: { preedit: "", selectionStart: 0, selectionEnd: 0 },
      PREEDIT_BG: [0, 0, 0, 1],
      PREEDIT_UL: [0, 0, 0, 1],
      PREEDIT_ACTIVE_BG: [0, 0, 0, 1],
      PREEDIT_CARET: [0, 0, 0, 1],
      PREEDIT_FG: [1, 1, 1, 1],
      resizeState: {
        lastAt: performance.now(),
        cols: options.cols,
        rows: options.rows,
      },
      RESIZE_OVERLAY_HOLD_MS: options.holdMs,
      RESIZE_OVERLAY_FADE_MS: options.fadeMs,
      canvas: { width: 800, height: 480 },
      pushRect: () => undefined,
      pushRectBox: (target: number[], ...values: number[]) => {
        target.push(...values);
      },
      decodePackedRGBA: () => [1, 1, 1, 1],
      cursorFallback: [1, 1, 1, 1],
      clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
      wasmExports: null,
      wasmHandle: 0,
      scrollbarState: { lastTotal: 0, lastOffset: 0, lastLen: 0 },
      syncScrollbar: () => undefined,
    },
    rows: options.rows,
    cols: options.cols,
    cursor: null,
    cursorPos: null,
    cursorStyle: null,
    cursorCell: null,
    cursorImeAnchor: null,
    cellW: 10,
    cellH: 20,
    primaryScale: 1,
    lineHeight: 20,
    baselineOffset: 15,
    yPad: 0,
    underlineOffsetPx: 0,
    underlineThicknessPx: 1,
    bgData: [],
    underlineData: [],
    cursorData: [],
    fgRectData: [],
    overlayData,
    scaleByFont: [1],
    getGlyphQueue: () => [],
    getOverlayGlyphQueue: () => overlayQueue,
    getGlyphSet: () => overlayGlyphSet,
  };

  return {
    ctx,
    overlayData,
    overlayGlyphSet,
    overlayQueue,
  };
}

test("populateWebGLOverlays renders the resize badge by default", () => {
  const { ctx, overlayData, overlayGlyphSet, overlayQueue } = createOverlayContext({
    cols: 120,
    rows: 30,
    holdMs: 500,
    fadeMs: 400,
  });

  populateWebGLOverlays(ctx as never);

  expect(overlayData.length).toBeGreaterThan(0);
  expect(overlayGlyphSet.size).toBeGreaterThan(0);
  expect(overlayQueue).toHaveLength(1);
});

test("populateWebGLOverlays skips the resize badge when disabled", () => {
  const { ctx, overlayData, overlayGlyphSet, overlayQueue } = createOverlayContext({
    cols: 120,
    rows: 30,
    holdMs: 0,
    fadeMs: 0,
  });

  populateWebGLOverlays(ctx as never);

  expect(overlayData).toHaveLength(0);
  expect(overlayGlyphSet.size).toBe(0);
  expect(overlayQueue).toHaveLength(0);
});

import { expect, test } from "bun:test";
import {
  resolveFallbackBaselineAdjust,
  resolveFallbackGlyphCenterX,
  resolveFallbackTextScale,
  resolveWideFallbackScale,
} from "../src/runtime/fonts/fallback-layout";

test("wide CJK fallbacks keep their natural em scale", () => {
  const scale = resolveWideFallbackScale({
    scale: 0.016,
    advanceUnits: 1000,
    cellWidth: 9.6,
    maxSpan: 2,
  });

  expect(scale).toBeCloseTo(0.016, 5);
});

test("wide CJK fallbacks use the primary em instead of their taller line metrics", () => {
  const scale = resolveFallbackTextScale({
    baseScale: 18 / 1448,
    primaryEmScale: 18 / 1320,
    metricAdjust: 550 / 543,
    advanceUnits: 1000,
    cellWidth: 8,
    maxSpan: 2,
    fontHeightUnits: 1448,
    lineHeight: 18,
  });

  expect(scale).toBeCloseTo(18 / 1320, 6);
  expect(1000 * scale).toBeCloseTo(13.63636);
});

test("wide fallback glyphs are centered across their occupied cells", () => {
  const x = resolveFallbackGlyphCenterX({
    cellX: 40,
    cellWidth: 19.2,
    glyphWidth: 16,
    isFallback: true,
    glyphCount: 1,
    symbolLike: false,
  });

  expect(x).toBeCloseTo(41.6);
});

test("regular CJK fallback text stays on the primary baseline", () => {
  // Bundled Fira Code + Noto Sans CJK at the default 18px height. The old
  // metric-anchor calculation produced a visible 1.1475px downward offset.
  expect(1053 * 0.0075 - 543 * (18 / 1448)).toBeCloseTo(1.1475);

  const baselineAdjust = resolveFallbackBaselineAdjust({
    primaryScale: 0.0075,
    fallbackScale: 18 / 1448,
    primaryAscender: 1800,
    fallbackAscender: 1160,
    regularTextFallback: true,
  });

  expect(baselineAdjust).toBe(0);
});

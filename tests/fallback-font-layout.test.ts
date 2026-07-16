import { expect, test } from "bun:test";
import {
  resolveFallbackBaselineAdjust,
  resolveFallbackGlyphCenterX,
  resolveFallbackIcWidth,
  resolveFallbackScaleAdjustment,
  resolveFallbackTextScale,
  resolveWideFallbackScale,
} from "../src/runtime/fonts/fallback-layout";

function makeMetricFont(options: {
  unitsPerEm?: number;
  height: number;
  ascender: number;
  asciiAdvance: number;
  asciiTop: number;
  asciiBottom: number;
  waterAdvance?: number;
  waterWidth?: number;
  exHeight?: number;
  capHeight?: number;
}) {
  return {
    unitsPerEm: options.unitsPerEm ?? 1000,
    height: options.height,
    ascender: options.ascender,
    os2: {
      sxHeight: options.exHeight ?? 0,
      sCapHeight: options.capHeight ?? 0,
    },
    glyphIdForChar(ch: string) {
      if (ch === "水") return options.waterAdvance ? 0x6c34 : 0;
      const codepoint = ch.codePointAt(0) ?? 0;
      return codepoint >= 32 && codepoint < 127 ? codepoint : 0;
    },
    advanceWidth(glyphId: number) {
      return glyphId === 0x6c34 ? (options.waterAdvance ?? 0) : options.asciiAdvance;
    },
    getGlyphBounds(glyphId: number) {
      if (glyphId === 0x6c34) {
        return {
          xMin: 0,
          xMax: options.waterWidth ?? options.waterAdvance ?? 0,
          yMin: options.asciiBottom,
          yMax: options.asciiTop,
        };
      }
      return {
        xMin: 0,
        xMax: options.asciiAdvance,
        yMin: options.asciiBottom,
        yMax: options.asciiTop,
      };
    },
  } as any;
}

test("wide CJK fallbacks keep their natural em scale", () => {
  const scale = resolveWideFallbackScale({
    scale: 0.016,
    advanceUnits: 1000,
    cellWidth: 9.6,
    maxSpan: 2,
  });

  expect(scale).toBeCloseTo(0.016, 5);
});

test("wide CJK fallbacks apply Ghostty ic-width normalization at the primary em", () => {
  // Metrics measured from the bundled JetBrains Mono and Noto Sans CJK SC
  // faces. JetBrains has no 水, so Ghostty estimates its ideograph width as
  // min(ASCII height 1050, two 600-unit cells) and compares it with Noto's
  // explicit 1000-unit 水 advance.
  const primary = makeMetricFont({
    height: 1320,
    ascender: 1020,
    asciiAdvance: 600,
    asciiTop: 870,
    asciiBottom: -180,
    exHeight: 550,
    capHeight: 730,
  });
  const fallback = makeMetricFont({
    height: 1448,
    ascender: 1160,
    asciiAdvance: 946,
    asciiTop: 872,
    asciiBottom: -279,
    waterAdvance: 1000,
    waterWidth: 936,
    exHeight: 543,
    capHeight: 733,
  });
  const metricAdjust = resolveFallbackScaleAdjustment(primary, fallback);
  expect(metricAdjust).toBeCloseTo(1.05, 6);
  expect(resolveFallbackIcWidth(fallback)).toBe(1000);

  const scale = resolveFallbackTextScale({
    baseScale: 18 / 1448,
    primaryEmScale: 18 / 1320,
    metricAdjust,
    advanceUnits: 1000,
    cellWidth: 8,
    maxSpan: 2,
    fontHeightUnits: 1448,
    lineHeight: 18,
  });

  expect(scale).toBeCloseTo((18 / 1320) * 1.05, 6);
  expect(1000 * scale).toBeCloseTo(14.31818);
});

test("invalid fallback ic-width falls through to normalized ex-height", () => {
  const primary = makeMetricFont({
    unitsPerEm: 2000,
    height: 2400,
    ascender: 1900,
    asciiAdvance: 1200,
    asciiTop: 1700,
    asciiBottom: -300,
    exHeight: 1100,
    capHeight: 1460,
  });
  const fallback = makeMetricFont({
    height: 1448,
    ascender: 1160,
    asciiAdvance: 946,
    asciiTop: 872,
    asciiBottom: -279,
    waterAdvance: 500,
    waterWidth: 936,
    exHeight: 543,
    capHeight: 733,
  });

  expect(resolveFallbackIcWidth(fallback)).toBe(0);
  expect(resolveFallbackScaleAdjustment(primary, fallback)).toBeCloseTo(550 / 543, 6);
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

import { expect, test } from "bun:test";
import {
  resolveFallbackGlyphCenterX,
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

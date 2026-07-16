import { expect, test } from "bun:test";
import { createFontEntry, createFontManagerState } from "../src/fonts";
import { createFontRuntimeTextHelpers } from "../src/runtime/create-runtime/font-runtime/text";
import { glyphHasVisibleRaster } from "../src/runtime/fonts/glyph-coverage";

const font = {} as any;

test("claimed glyphs with empty raster coverage are rejected", () => {
  const visible = glyphHasVisibleRaster({
    font,
    glyphId: 42,
    sizeMode: "height",
    rasterizeGlyph: () => ({
      bitmap: {
        width: 16,
        rows: 16,
        pitch: 16,
        buffer: new Uint8Array(16 * 16),
        pixelMode: 2,
        numGrays: 256,
      },
      bearingX: 0,
      bearingY: 0,
    }),
  });

  expect(visible).toBe(false);
});

test("claimed glyphs with nonzero raster coverage remain eligible", () => {
  const buffer = new Uint8Array(16 * 16);
  buffer[20] = 255;
  const visible = glyphHasVisibleRaster({
    font,
    glyphId: 42,
    sizeMode: "height",
    rasterizeGlyph: () => ({
      bitmap: {
        width: 16,
        rows: 16,
        pitch: 16,
        buffer,
        pixelMode: 2,
        numGrays: 256,
      },
      bearingX: 0,
      bearingY: 0,
    }),
  });

  expect(visible).toBe(true);
});

test("font picking falls through when a fallback claims a blank glyph", () => {
  const missingFont = {
    glyphIdForChar: () => 0,
  } as any;
  const blankFont = {
    glyphIdForChar: () => 42,
  } as any;
  const visibleFont = {
    glyphIdForChar: () => 43,
  } as any;
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(missingFont, "Primary Mono"),
    createFontEntry(blankFont, "PingFang SC"),
    createFontEntry(visibleFont, "Hiragino Sans GB"),
  ];

  class TestUnicodeBuffer {
    addStr() {}
  }
  const helpers = createFontRuntimeTextHelpers({
    fontState: state,
    glyphShapeCacheLimit: 32,
    fontPickCacheLimit: 32,
    UnicodeBuffer: TestUnicodeBuffer as any,
    shape: (() => ({})) as any,
    glyphBufferToShapedGlyphs: () => [],
    rasterizeGlyph: (candidate) => {
      const buffer = new Uint8Array(16 * 16);
      if (candidate === visibleFont) buffer[20] = 255;
      return {
        bitmap: {
          width: 16,
          rows: 16,
          pitch: 16,
          buffer,
          pixelMode: 2,
          numGrays: 256,
        },
        bearingX: 0,
        bearingY: 0,
      };
    },
  });

  expect(helpers.pickFontIndexForText("漢", 2)).toBe(2);
});

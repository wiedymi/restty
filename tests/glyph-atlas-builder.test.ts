import { expect, test } from "bun:test";
import { buildGlyphAtlasWithConstraints } from "../src/runtime/font-atlas-utils/glyph-atlas-builder";
import { buildNerdMetrics } from "../src/runtime/font-atlas-utils/nerd-metrics-utils";
import { constrainGlyphBox } from "../src/renderer/shapes/glyph-box";
import { fallbackEmScale, createFontEntry } from "../src/fonts";
import type { NerdConstraint } from "../src/fonts";

test("buildGlyphAtlasWithConstraints forwards hintTarget to rasterize options", () => {
  const seenOptions: Array<{ hinting?: boolean; hintTarget?: string }> = [];
  const fakeFont = {
    scaleForSize: () => 1,
    advanceWidth: () => 600,
  } as any;

  const result = buildGlyphAtlasWithConstraints({
    font: fakeFont,
    glyphIds: [65],
    fontSize: 16,
    sizeMode: "height",
    padding: 1,
    maxWidth: 64,
    maxHeight: 64,
    pixelMode: 1,
    hinting: true,
    hintTarget: "light",
    rasterizeGlyph: (_font, _glyphId, _fontSize, options) => {
      seenOptions.push(options ?? {});
      return {
        bitmap: {
          width: 3,
          rows: 4,
          pitch: 3,
          buffer: new Uint8Array(12).fill(255),
          pixelMode: 1,
          numGrays: 256,
        },
        bearingX: 0,
        bearingY: 0,
      } as any;
    },
  });

  expect(result.atlas).not.toBeNull();
  expect(seenOptions).toHaveLength(1);
  expect(seenOptions[0]?.hinting).toBe(true);
  expect(seenOptions[0]?.hintTarget).toBe("light");
});

// JetBrains Mono at 36px cell height (18px @ dpr 2, sizeMode "height").
const PRIMARY_SCALE = 36 / 1320;
const FACE_WIDTH = 600 * PRIMARY_SCALE;
const NERD_METRICS = {
  cellWidth: 16,
  cellHeight: 36,
  faceWidth: FACE_WIDTH,
  faceHeight: 36,
  faceY: 0,
  iconHeight: 36,
  iconHeightSingle: (2 * 730 * PRIMARY_SCALE + 36) / 3,
};
const ICON_CONSTRAINT: NerdConstraint = {
  size: "fit_cover1",
  height: "icon",
  align_horizontal: "center1",
  align_vertical: "center1",
};

test("fallbackEmScale renders fallback at the primary font em size", () => {
  const primary = { unitsPerEm: 1000 } as any;
  const symbols = { unitsPerEm: 2048 } as any;
  const scale = fallbackEmScale(primary, PRIMARY_SCALE, symbols);
  expect(scale).toBeCloseTo((PRIMARY_SCALE * 1000) / 2048, 8);
  expect(fallbackEmScale({ unitsPerEm: 0 } as any, PRIMARY_SCALE, symbols)).toBe(0);
  expect(fallbackEmScale(primary, PRIMARY_SCALE, { unitsPerEm: Number.NaN } as any)).toBe(0);
  expect(fallbackEmScale(primary, 0, symbols)).toBe(0);
});

test("buildNerdMetrics matches ghostty icon height formulas", () => {
  const primary = {
    unitsPerEm: 1000,
    ascender: 1020,
    descender: -300,
    height: 1320,
    os2: { sCapHeight: 730 },
    glyphIdForChar: () => 1,
    advanceWidth: () => 600,
  } as any;
  const metrics = buildNerdMetrics(16, 36, 36, primary, PRIMARY_SCALE, 1);
  expect(metrics.faceWidth).toBeCloseTo(FACE_WIDTH, 6);
  expect(metrics.iconHeight).toBeCloseTo(36, 6);
  expect(metrics.iconHeightSingle).toBeCloseTo(NERD_METRICS.iconHeightSingle, 6);
});

test("constrainGlyphBox fit_cover1 keeps natural size when icon exceeds one cell but fits bounds", () => {
  const glyph = { x: 0, y: 5, width: 27.3, height: 17.3 };
  const out = constrainGlyphBox(glyph, ICON_CONSTRAINT, NERD_METRICS, 2);
  expect(out.width).toBeCloseTo(27.3, 6);
  expect(out.height).toBeCloseTo(17.3, 6);
});

test("constrainGlyphBox fit_cover1 caps multi-cell upscale at single-cell cover", () => {
  const glyph = { x: 0, y: 5, width: 8, height: 8 };
  const out = constrainGlyphBox(glyph, ICON_CONSTRAINT, NERD_METRICS, 2);
  // Upscaled to cover one cell (width binds), not the two-cell span.
  expect(out.width).toBeCloseTo(FACE_WIDTH, 6);
  expect(out.height).toBeCloseTo(FACE_WIDTH, 6);
});

test("constrainGlyphBox fit_cover1 single-cell cap respects relative group size", () => {
  const constraint: NerdConstraint = {
    ...ICON_CONSTRAINT,
    relative_height: 0.5,
    relative_y: 0,
  };
  const glyph = { x: 0, y: 5, width: 8, height: 8 };
  const out = constrainGlyphBox(glyph, constraint, NERD_METRICS, 2);
  // Group is 8x16; single-cell factor = iconHeightSingle / 16.
  const factor = NERD_METRICS.iconHeightSingle / 16;
  expect(out.width).toBeCloseTo(8 * factor, 6);
  expect(out.height).toBeCloseTo(8 * factor, 6);
});

test("buildGlyphAtlasWithConstraints keeps a nerd icon at natural size for width-2 constraints", () => {
  const symbolScale = (PRIMARY_SCALE * 1000) / 2048;
  const fakeFont = {
    unitsPerEm: 2048,
    scaleForSize: () => symbolScale,
    advanceWidth: () => 2050,
    getGlyphBounds: () => ({ xMin: 0, xMax: 2050, yMin: 0, yMax: 1290 }),
  } as any;
  const baseBitmap = {
    width: 27,
    rows: 17,
    pitch: 27,
    buffer: new Uint8Array(27 * 17).fill(255),
    pixelMode: 1,
    numGrays: 256,
  };
  const entry = createFontEntry(fakeFont, "Symbols Nerd Font");
  const result = buildGlyphAtlasWithConstraints({
    font: fakeFont,
    glyphIds: [512],
    fontSize: 27,
    sizeMode: "em",
    padding: 1,
    maxWidth: 512,
    maxHeight: 512,
    pixelMode: 1,
    hinting: false,
    rasterizeGlyph: () =>
      ({
        bitmap: { ...baseBitmap, buffer: baseBitmap.buffer.slice() },
        bearingX: 0,
        bearingY: 17,
      }) as any,
    rasterizeGlyphWithTransform: (_font, _glyphId, _fontSize, matrix) => {
      const scaleX = Array.isArray(matrix) ? Number(matrix[0]) : 1;
      const scaleY = Array.isArray(matrix) ? Number(matrix[3]) : 1;
      const width = Math.max(1, Math.round(baseBitmap.width * scaleX));
      const rows = Math.max(1, Math.round(baseBitmap.rows * scaleY));
      return {
        bitmap: {
          width,
          rows,
          pitch: width,
          buffer: new Uint8Array(width * rows).fill(255),
          pixelMode: 1,
          numGrays: 256,
        },
        bearingX: 0,
        bearingY: rows,
      } as any;
    },
    glyphMeta: new Map([[512, { cp: 0xe628, constraintWidth: 2, widths: new Set([2]) }]]),
    constraintContext: {
      cellW: 16,
      cellH: 36,
      yPad: 0,
      baselineOffset: 1020 * PRIMARY_SCALE,
      baselineAdjust: 0,
      fontScale: symbolScale,
      nerdMetrics: NERD_METRICS,
      fontEntry: entry,
    },
  });

  const metrics = result.atlas?.glyphsByWidth?.get(2)?.get(512);
  expect(metrics).toBeDefined();
  // Natural size preserved: not stretched to the 2-cell span (32px) or full cell height.
  expect(metrics!.width).toBe(27);
  expect(metrics!.height).toBe(17);
});

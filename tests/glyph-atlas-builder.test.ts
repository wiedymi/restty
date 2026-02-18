import { expect, test } from "bun:test";
import { buildGlyphAtlasWithConstraints } from "../src/runtime/font-atlas-utils/glyph-atlas-builder";

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

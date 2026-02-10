import { fontHeightUnits } from "../../grid/grid";
import type { Font, FontEntry, FontManagerState, ShapedCluster } from "../types";

/** Create a new FontEntry with empty caches and default metadata. */
export function createFontEntry(font: Font, label: string): FontEntry {
  return {
    font,
    label,
    glyphCache: new Map(),
    boundsCache: new Map(),
    colorGlyphTexts: new Map(),
    glyphIds: new Set(),
    atlas: null,
    fontSizePx: 0,
    atlasScale: 1,
    advanceUnits: 0,
    constraintSignature: "",
  };
}

/** Clear all caches and reset rendering metadata on a font entry. */
export function resetFontEntry(entry: FontEntry): void {
  entry.glyphCache.clear();
  entry.boundsCache.clear();
  entry.colorGlyphTexts.clear();
  entry.glyphIds.clear();
  entry.atlas = null;
  entry.fontSizePx = 0;
  entry.atlasScale = 1;
  entry.advanceUnits = 0;
  entry.constraintSignature = "";
}

/** Create an empty FontManagerState for initialization. */
export function createFontManagerState(): FontManagerState {
  return {
    font: null,
    fonts: [],
    fontSizePx: 0,
    sizeMode: "height",
    fontPickCache: new Map(),
  };
}

/** Check whether a font has a non-zero glyph ID for the given character. */
export function fontHasGlyph(font: Font, ch: string): boolean {
  const glyphId = font.glyphIdForChar(ch);
  return glyphId !== undefined && glyphId !== null && glyphId !== 0;
}

/** Get the horizontal advance width in font design units, computing and caching it if needed. */
export function fontAdvanceUnits(
  entry: FontEntry,
  shapeClusterWithFont: (entry: FontEntry, text: string) => ShapedCluster,
): number {
  if (!entry?.font) return 0;
  if (entry.advanceUnits) return entry.advanceUnits;

  const glyphId = entry.font.glyphIdForChar("M");
  let advance = 0;
  if (glyphId !== undefined && glyphId !== null) {
    advance = entry.font.advanceWidth(glyphId);
  }
  if (!advance) {
    advance = shapeClusterWithFont(entry, "M").advance;
  }
  if (!advance) {
    advance = fontHeightUnits(entry.font) || entry.font.unitsPerEm || 1000;
  }
  entry.advanceUnits = advance;
  return advance;
}

/** Get the bounding-box width of a glyph in font design units, with caching. */
export function glyphWidthUnits(entry: FontEntry, glyphId: number | undefined | null): number {
  if (!entry?.font || glyphId === undefined || glyphId === null) return 0;
  if (!entry.boundsCache) entry.boundsCache = new Map();
  if (entry.boundsCache.has(glyphId)) return entry.boundsCache.get(glyphId)!;

  const bounds = entry.font.getGlyphBounds(glyphId);
  let width = 0;
  if (bounds) {
    width = bounds.xMax - bounds.xMin;
  }
  if (!Number.isFinite(width) || width <= 0) {
    width = entry.font.advanceWidth(glyphId) || 0;
  }
  entry.boundsCache.set(glyphId, width);
  return width;
}

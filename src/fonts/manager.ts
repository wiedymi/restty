import type {
  FontEntry,
  FontManagerState,
  ShapedCluster,
  FallbackFontSource,
  FontScaleOverride,
} from "./types";
import { isNerdSymbolCodepoint } from "./nerd-ranges";
import { fontHeightUnits } from "../grid/grid";

// Font classification patterns
const SYMBOL_FONT_HINTS = [/symbols nerd font/i, /noto sans symbols/i];
const NERD_SYMBOL_FONT_HINTS = [/symbols nerd font/i, /nerd fonts symbols/i];
const COLOR_EMOJI_FONT_HINTS = [
  /apple color emoji/i,
  /noto color emoji/i,
  /segoe ui emoji/i,
  /twemoji/i,
];
const WIDE_FONT_HINTS = [
  /cjk/i,
  /emoji/i,
  /openmoji/i,
  /source han/i,
  /pingfang/i,
  /hiragino/i,
  /yu gothic/i,
  /meiryo/i,
  /yahei/i,
  /ms gothic/i,
  /simhei/i,
  /simsun/i,
  /nanum/i,
  /apple sd gothic/i,
];

/** Check whether a font entry is a symbol/icon font based on its label. */
export function isSymbolFont(entry: FontEntry | null | undefined): boolean {
  if (!entry?.label) return false;
  const label = String(entry.label).toLowerCase();
  return SYMBOL_FONT_HINTS.some((rule) => rule.test(label));
}

/** Check whether a font entry is a Nerd Font symbols font. */
export function isNerdSymbolFont(entry: FontEntry | null | undefined): boolean {
  if (!entry?.label) return false;
  const label = String(entry.label).toLowerCase();
  return NERD_SYMBOL_FONT_HINTS.some((rule) => rule.test(label));
}

/** Check whether a font entry is a color emoji font. */
export function isColorEmojiFont(entry: FontEntry | null | undefined): boolean {
  if (!entry?.label) return false;
  const label = String(entry.label).toLowerCase();
  return COLOR_EMOJI_FONT_HINTS.some((rule) => rule.test(label));
}

/** Return the maximum cell span for a font (2 for CJK/emoji, 1 otherwise). */
export function fontMaxCellSpan(entry: FontEntry | null | undefined): number {
  if (!entry?.label) return 1;
  const label = String(entry.label).toLowerCase();
  for (const rule of WIDE_FONT_HINTS) {
    if (rule.test(label)) return 2;
  }
  return 1;
}

/** Return the scale multiplier for a font entry by matching its label against overrides. */
export function fontScaleOverride(
  entry: FontEntry | null | undefined,
  overrides: FontScaleOverride[] = [],
): number {
  if (!entry?.label) return 1;
  const label = String(entry.label).toLowerCase();
  for (const rule of overrides) {
    if (rule.match.test(label)) return rule.scale;
  }
  return 1;
}

/** Compute the atlas raster scale for a font, applying symbol atlas scaling for fallback symbol fonts. */
export function fontRasterScale(
  entry: FontEntry | null | undefined,
  fontIndex: number,
  maxSymbolAtlasScale: number,
  overrides: FontScaleOverride[] = [],
): number {
  const scale = fontScaleOverride(entry, overrides);
  if (fontIndex > 0 && isSymbolFont(entry)) return scale * maxSymbolAtlasScale;
  return scale;
}

/** Create a new FontEntry with empty caches and default metadata. */
export function createFontEntry(font: any, label: string): FontEntry {
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
export function fontHasGlyph(font: any, ch: string): boolean {
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
    advance = fontHeightUnits(entry.font) || entry.font.upem || 1000;
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

function isSymbolCp(cp: number): boolean {
  const isPrivateUse =
    (cp >= 0xe000 && cp <= 0xf8ff) ||
    (cp >= 0xf0000 && cp <= 0xffffd) ||
    (cp >= 0x100000 && cp <= 0x10fffd);
  const isBoxDrawing = cp >= 0x2500 && cp <= 0x257f;
  const isBlockElement = cp >= 0x2580 && cp <= 0x259f;
  const isLegacyComputing = (cp >= 0x1fb00 && cp <= 0x1fbff) || (cp >= 0x1cc00 && cp <= 0x1cebf);
  const isPowerline = cp >= 0xe0b0 && cp <= 0xe0d7;
  const isGraphicsElement = isBoxDrawing || isBlockElement || isLegacyComputing || isPowerline;
  return isPrivateUse || isGraphicsElement;
}

/**
 * Select the best font index from the manager's font list for rendering the
 * given text cluster, preferring symbol fonts for Nerd/PUA codepoints and
 * scoring candidates by advance-width ratio fit.
 */
export function pickFontIndexForText(
  state: FontManagerState,
  text: string,
  expectedSpan: number,
  shapeClusterWithFont: (entry: FontEntry, text: string) => ShapedCluster,
): number {
  if (!state.fonts.length) return 0;

  const cacheKey = `${expectedSpan}:${text}`;
  const cached = state.fontPickCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const chars = Array.from(text);
  const primary = state.fonts[0];
  const primaryHeight = primary?.font ? fontHeightUnits(primary.font) : 0;
  const primaryAdvance = primary ? fontAdvanceUnits(primary, shapeClusterWithFont) : 0;
  const primaryRatio = primaryHeight > 0 ? primaryAdvance / primaryHeight : 0.5;
  const targetRatio = primaryRatio * expectedSpan;
  const firstCp = text.codePointAt(0) ?? 0;
  const nerdSymbol = isNerdSymbolCodepoint(firstCp);
  const preferSymbol = nerdSymbol || isSymbolCp(firstCp);

  // Prefer nerd symbol font for nerd symbols
  if (nerdSymbol) {
    const symbolIndex = state.fonts.findIndex((entry) => isSymbolFont(entry));
    if (symbolIndex >= 0) {
      const entry = state.fonts[symbolIndex];
      if (entry?.font) {
        let ok = true;
        for (const ch of chars) {
          if (!fontHasGlyph(entry.font, ch)) {
            ok = false;
            break;
          }
        }
        if (ok) {
          state.fontPickCache.set(cacheKey, symbolIndex);
          return symbolIndex;
        }
      }
    }
  }

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 0; i < state.fonts.length; i += 1) {
    const entry = state.fonts[i];
    if (!entry?.font) continue;

    let ok = true;
    for (const ch of chars) {
      if (!fontHasGlyph(entry.font, ch)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    const height = fontHeightUnits(entry.font);
    const advance = shapeClusterWithFont(entry, text).advance;
    const ratio = height > 0 ? advance / height : targetRatio;
    let score = Math.abs(ratio - targetRatio);

    if (preferSymbol && isSymbolFont(entry)) score *= nerdSymbol ? 0.2 : 0.6;
    if (!preferSymbol && isSymbolFont(entry)) score *= 1.4;
    if (nerdSymbol && !isSymbolFont(entry)) score *= 2.0;

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  state.fontPickCache.set(cacheKey, bestIndex);
  return bestIndex;
}

/** Fetch a font file from a URL and return its ArrayBuffer, or null on failure. */
export async function tryFetchFontBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (response.ok) return response.arrayBuffer();
  } catch {
    // Ignore and try local fonts.
  }
  return null;
}

/** Query locally installed fonts via the Local Font Access API and return the first match, or null. */
export async function tryLocalFontBuffer(matchers: string[]): Promise<ArrayBuffer | null> {
  if (!("queryLocalFonts" in navigator)) return null;
  try {
    const fonts = await (navigator as any).queryLocalFonts();
    const match = fonts.find((font: any) => {
      const name =
        `${font.family ?? ""} ${font.fullName ?? ""} ${font.postscriptName ?? ""}`.toLowerCase();
      return matchers.some((matcher) => name.includes(matcher));
    });
    if (match) {
      const blob = await match.blob();
      return blob.arrayBuffer();
    }
  } catch (err) {
    console.warn("queryLocalFonts failed", err);
  }
  return null;
}

/**
 * Load the primary font buffer, trying local Nerd Font matchers first,
 * then a remote fallback URL, then broader local font matchers. Throws
 * if all sources fail.
 */
export async function loadPrimaryFontBuffer(
  localMatchers: string[],
  fallbackUrl: string,
  fallbackLocalMatchers: string[],
): Promise<ArrayBuffer> {
  const nerdLocal = await tryLocalFontBuffer(localMatchers);
  if (nerdLocal) return nerdLocal;

  const buffer = await tryFetchFontBuffer(fallbackUrl);
  if (buffer) return buffer;

  const local = await tryLocalFontBuffer(fallbackLocalMatchers);
  if (local) return local;

  throw new Error("Unable to load primary font.");
}

/** Load fallback font buffers from a list of sources, trying remote URLs then local matchers. */
export async function loadFallbackFontBuffers(
  sources: FallbackFontSource[],
): Promise<{ name: string; buffer: ArrayBuffer }[]> {
  const results: { name: string; buffer: ArrayBuffer }[] = [];

  for (const source of sources) {
    const buffer = await tryFetchFontBuffer(source.url);
    if (buffer) {
      results.push({ name: source.name, buffer });
      continue;
    }
    if (source.matchers && source.matchers.length) {
      const local = await tryLocalFontBuffer(source.matchers);
      if (local) results.push({ name: source.name, buffer: local });
    }
  }

  return results;
}

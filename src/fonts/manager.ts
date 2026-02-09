import type {
  FontEntry,
  FontManagerState,
  ShapedCluster,
  FallbackFontSource,
  FontScaleOverride,
} from "./types";
import { isNerdSymbolCodepoint } from "./nerd-ranges";
import { fontHeightUnits } from "../grid/grid";
import { isSymbolLikeCodepoint } from "../unicode/symbols";

type LocalFontsPermissionDescriptor = PermissionDescriptor & { name: "local-fonts" };
type LocalFontFaceData = {
  family?: string;
  fullName?: string;
  postscriptName?: string;
  blob: () => Promise<Blob>;
};
type NavigatorWithLocalFontAccess = Navigator & {
  queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  permissions?: {
    query?: (permissionDesc: LocalFontsPermissionDescriptor) => Promise<PermissionStatus>;
  };
};
type GlobalWithLocalFontAccess = typeof globalThis & {
  queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  navigator?: NavigatorWithLocalFontAccess;
};

// Font classification patterns
const SYMBOL_FONT_HINTS = [/symbols nerd font/i, /noto sans symbols/i, /apple symbols/i, /symbola/i];
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
  return isSymbolLikeCodepoint(cp);
}

function isLikelyEmojiCodepoint(cp: number): boolean {
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true;
  if (cp >= 0x1f300 && cp <= 0x1faff) return true;
  return false;
}

function resolvePresentationPreference(
  text: string,
  chars: string[],
): "emoji" | "text" | "auto" {
  if (text.includes("\ufe0f")) return "emoji";
  if (text.includes("\ufe0e")) return "text";
  if (text.includes("\u200d")) return "emoji";
  for (const ch of chars) {
    const cp = ch.codePointAt(0) ?? 0;
    if (isLikelyEmojiCodepoint(cp)) return "emoji";
  }
  return "auto";
}

/**
 * Select the best font index from the manager's font list for rendering the
 * given text cluster, searching in fallback order similar to Ghostty.
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
  const firstCp = text.codePointAt(0) ?? 0;
  const nerdSymbol = isNerdSymbolCodepoint(firstCp);
  const presentation = resolvePresentationPreference(text, chars);

  const pickFirstMatch = (predicate?: (entry: FontEntry) => boolean): number => {
    for (let i = 0; i < state.fonts.length; i += 1) {
      const entry = state.fonts[i];
      if (!entry?.font) continue;
      if (predicate && !predicate(entry)) continue;
      let ok = true;
      for (const ch of chars) {
        if (!fontHasGlyph(entry.font, ch)) {
          ok = false;
          break;
        }
      }
      if (ok) return i;
    }
    return -1;
  };

  const tryIndex = (index: number): number | null => {
    if (index < 0) return null;
    state.fontPickCache.set(cacheKey, index);
    return index;
  };

  if (nerdSymbol) {
    const symbolIndex = pickFirstMatch((entry) => isNerdSymbolFont(entry) || isSymbolFont(entry));
    const result = tryIndex(symbolIndex);
    if (result !== null) return result;
  }

  if (presentation === "emoji") {
    const emojiIndex = pickFirstMatch((entry) => isColorEmojiFont(entry));
    const result = tryIndex(emojiIndex);
    if (result !== null) return result;
  } else if (presentation === "text") {
    const textIndex = pickFirstMatch((entry) => !isColorEmojiFont(entry));
    const result = tryIndex(textIndex);
    if (result !== null) return result;
  }

  const firstIndex = pickFirstMatch();
  if (firstIndex >= 0) {
    state.fontPickCache.set(cacheKey, firstIndex);
    return firstIndex;
  }

  state.fontPickCache.set(cacheKey, 0);
  return 0;
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
  const globalAccess = globalThis as GlobalWithLocalFontAccess;
  const nav = (globalAccess.navigator ?? navigator) as NavigatorWithLocalFontAccess;
  const queryLocalFonts =
    typeof globalAccess.queryLocalFonts === "function"
      ? globalAccess.queryLocalFonts.bind(globalAccess)
      : typeof nav.queryLocalFonts === "function"
        ? nav.queryLocalFonts.bind(nav)
        : null;
  if (!queryLocalFonts) return null;
  const normalizedMatchers = matchers.map((matcher) => matcher.toLowerCase()).filter(Boolean);
  if (!normalizedMatchers.length) return null;
  const queryPermission = nav.permissions?.query;
  if (queryPermission) {
    try {
      const status = await queryPermission({ name: "local-fonts" });
      if (status?.state === "denied") return null;
    } catch {
      // Ignore permissions API errors and attempt queryLocalFonts directly.
    }
  }
  try {
    const fonts = await queryLocalFonts();
    const match = fonts.find((font) => {
      const name =
        `${font.family ?? ""} ${font.fullName ?? ""} ${font.postscriptName ?? ""}`.toLowerCase();
      return normalizedMatchers.some((matcher) => name.includes(matcher));
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

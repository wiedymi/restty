import {
  isNerdSymbolCodepoint,
  isSymbolFont,
  isColorEmojiFont,
  isNerdSymbolFont,
  type Font,
  type FontEntry,
  type FontManagerState,
} from "../../fonts";
import {
  isCoverageIgnorableCodepoint,
  resolvePresentationPreference,
} from "../codepoint-utils";
import type {
  GlyphBufferToShapedGlyphsFn,
  ShapeFn,
  UnicodeBufferCtor,
} from "./font-runtime-helpers.types";

type CreateFontRuntimeTextHelpersOptions = {
  fontState: FontManagerState;
  glyphShapeCacheLimit: number;
  fontPickCacheLimit: number;
  UnicodeBuffer: UnicodeBufferCtor;
  shape: ShapeFn;
  glyphBufferToShapedGlyphs: GlyphBufferToShapedGlyphsFn;
};

function setBoundedMap<K, V>(map: Map<K, V>, key: K, value: V, limit: number): void {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  if (map.size <= limit) return;
  const oldest = map.keys().next().value;
  if (oldest !== undefined) {
    map.delete(oldest);
  }
}

export function createFontRuntimeTextHelpers(options: CreateFontRuntimeTextHelpersOptions) {
  const {
    fontState,
    glyphShapeCacheLimit,
    fontPickCacheLimit,
    UnicodeBuffer,
    shape,
    glyphBufferToShapedGlyphs,
  } = options;

  function shapeClusterWithFont(entry: FontEntry, text: string) {
    const cached = entry.glyphCache.get(text);
    if (cached) return cached;
    const buffer = new UnicodeBuffer();
    buffer.addStr(text);
    const glyphBuffer = shape(entry.font, buffer);
    const glyphs = glyphBufferToShapedGlyphs(glyphBuffer);
    const advance = glyphs.reduce((sum, g) => sum + g.xAdvance, 0);
    const shaped = { glyphs, advance };
    setBoundedMap(entry.glyphCache, text, shaped, glyphShapeCacheLimit);
    return shaped;
  }

  function noteColorGlyphText(
    entry: FontEntry,
    text: string,
    shaped: { glyphs: Array<{ glyphId: number }> },
  ): void {
    if (!isColorEmojiFont(entry) || shaped.glyphs.length !== 1) return;
    const glyphId = shaped.glyphs[0]?.glyphId;
    if (!glyphId) return;
    if (!entry.colorGlyphTexts) entry.colorGlyphTexts = new Map();
    entry.colorGlyphTexts.set(glyphId, text);
  }

  function fontHasGlyph(font: Font, ch: string): boolean {
    const glyphId = font.glyphIdForChar(ch);
    return glyphId !== undefined && glyphId !== null && glyphId !== 0;
  }

  function pickFontIndexForText(text: string, expectedSpan = 1, stylePreference = "regular") {
    if (!fontState.fonts.length) return 0;
    const cacheKey = `${expectedSpan}:${stylePreference}:${text}`;
    const cached = fontState.fontPickCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const chars = Array.from(text);
    const requiredChars = chars.filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return !isCoverageIgnorableCodepoint(cp);
    });
    const firstCp = text.codePointAt(0) ?? 0;
    const nerdSymbol = isNerdSymbolCodepoint(firstCp);
    const presentation = resolvePresentationPreference(text, chars);
    const styleHintsEnabled =
      stylePreference !== "regular" && presentation !== "emoji" && !nerdSymbol;

    const hasBoldHint = (entry: FontEntry) => /\bbold\b/i.test(entry.label ?? "");
    const hasItalicHint = (entry: FontEntry) => /\b(italic|oblique)\b/i.test(entry.label ?? "");
    const stylePredicates: Array<(entry: FontEntry) => boolean> =
      stylePreference === "bold_italic"
        ? [
            (entry) => hasBoldHint(entry) && hasItalicHint(entry),
            (entry) => hasBoldHint(entry),
            (entry) => hasItalicHint(entry),
          ]
        : stylePreference === "bold"
          ? [
              (entry) => hasBoldHint(entry) && !hasItalicHint(entry),
              (entry) => hasBoldHint(entry),
            ]
          : stylePreference === "italic"
            ? [
                (entry) => hasItalicHint(entry) && !hasBoldHint(entry),
                (entry) => hasItalicHint(entry),
              ]
            : [];

    const pickFirstMatch = (
      predicate?: (entry: FontEntry) => boolean,
      allowSequenceShapingFallback = false,
    ) => {
      for (let i = 0; i < fontState.fonts.length; i += 1) {
        const entry = fontState.fonts[i];
        if (!entry?.font) continue;
        if (predicate && !predicate(entry)) continue;
        let ok = true;
        for (const ch of requiredChars) {
          if (!fontHasGlyph(entry.font, ch)) {
            ok = false;
            break;
          }
        }
        if (!ok && allowSequenceShapingFallback) {
          const shaped = shapeClusterWithFont(entry, text);
          ok = shaped.glyphs.some((glyph) => (glyph.glyphId ?? 0) !== 0);
        }
        if (ok) return i;
      }
      return -1;
    };

    const pickWithStyle = (
      predicate?: (entry: FontEntry) => boolean,
      allowSequenceShapingFallback = false,
    ) => {
      if (styleHintsEnabled) {
        for (let i = 0; i < stylePredicates.length; i += 1) {
          const stylePredicate = stylePredicates[i];
          const styledIndex = pickFirstMatch((entry) => {
            if (!stylePredicate(entry)) return false;
            return predicate ? !!predicate(entry) : true;
          }, allowSequenceShapingFallback);
          if (styledIndex >= 0) return styledIndex;
        }
      }
      return pickFirstMatch(predicate, allowSequenceShapingFallback);
    };

    const tryIndex = (index: number) => {
      if (index < 0) return null;
      setBoundedMap(fontState.fontPickCache, cacheKey, index, fontPickCacheLimit);
      return index;
    };

    if (nerdSymbol) {
      const symbolIndex = pickWithStyle((entry) => isNerdSymbolFont(entry) || isSymbolFont(entry));
      const result = tryIndex(symbolIndex);
      if (result !== null) return result;
    }

    if (presentation === "emoji") {
      const emojiIndex = pickFirstMatch((entry) => isColorEmojiFont(entry), true);
      const result = tryIndex(emojiIndex);
      if (result !== null) return result;
    } else if (presentation === "text") {
      const textIndex = pickFirstMatch((entry) => !isColorEmojiFont(entry));
      const result = tryIndex(textIndex);
      if (result !== null) return result;
    }

    const firstIndex = pickWithStyle();
    if (firstIndex >= 0) {
      setBoundedMap(fontState.fontPickCache, cacheKey, firstIndex, fontPickCacheLimit);
      return firstIndex;
    }

    setBoundedMap(fontState.fontPickCache, cacheKey, 0, fontPickCacheLimit);
    return 0;
  }

  return {
    shapeClusterWithFont,
    noteColorGlyphText,
    fontHasGlyph,
    pickFontIndexForText,
  };
}

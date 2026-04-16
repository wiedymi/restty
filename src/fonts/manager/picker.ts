import { isNerdSymbolCodepoint } from "../nerd-ranges";
import type { FontEntry, FontManagerState } from "../types";
import { isColorEmojiFont, isNerdSymbolFont, isSymbolFont } from "./classification";
import { fontHasGlyph } from "./entries";

function isLikelyEmojiCodepoint(cp: number): boolean {
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true; // regional indicators
  if (cp >= 0x1f300 && cp <= 0x1faff) return true; // misc symbols & pictographs, emoticons, etc.
  if (cp >= 0x2300 && cp <= 0x23ff) return true; // misc technical (⏱ ⌘ ⏏ etc.)
  if (cp >= 0x2600 && cp <= 0x27bf) return true; // misc symbols + dingbats (✍ ☀ ✂ ⟳ etc.)
  if (cp >= 0x2b50 && cp <= 0x2b55) return true; // stars, circles (⭐ ⭕ etc.)
  return false;
}

function isVariationSelectorCodepoint(cp: number): boolean {
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true;
  if (cp >= 0xe0100 && cp <= 0xe01ef) return true;
  return false;
}

function isCombiningMarkCodepoint(cp: number): boolean {
  if (cp >= 0x0300 && cp <= 0x036f) return true;
  if (cp >= 0x1ab0 && cp <= 0x1aff) return true;
  if (cp >= 0x1dc0 && cp <= 0x1dff) return true;
  if (cp >= 0x20d0 && cp <= 0x20ff) return true;
  if (cp >= 0xfe20 && cp <= 0xfe2f) return true;
  return false;
}

function isCoverageIgnorableCodepoint(cp: number): boolean {
  if (cp === 0x200c || cp === 0x200d) return true;
  if (isVariationSelectorCodepoint(cp)) return true;
  if (isCombiningMarkCodepoint(cp)) return true;
  if (cp >= 0xe0020 && cp <= 0xe007f) return true;
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
): number {
  if (!state.fonts.length) return 0;

  const cacheKey = `${expectedSpan}:${text}`;
  const cached = state.fontPickCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const chars = Array.from(text);
  const requiredChars = chars.filter((ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return !isCoverageIgnorableCodepoint(cp);
  });
  const firstCp = text.codePointAt(0) ?? 0;
  const nerdSymbol = isNerdSymbolCodepoint(firstCp);
  const presentation = resolvePresentationPreference(text, chars);

  const pickFirstMatch = (predicate?: (entry: FontEntry) => boolean): number => {
    for (let i = 0; i < state.fonts.length; i += 1) {
      const entry = state.fonts[i];
      if (!entry?.font) continue;
      if (predicate && !predicate(entry)) continue;
      let ok = true;
      for (const ch of requiredChars) {
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

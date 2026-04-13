import type { FontEntry } from "../../fonts";

export function isLikelyEmojiCodepoint(cp: number): boolean {
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true;
  if (cp >= 0x1f300 && cp <= 0x1faff) return true;
  return false;
}

export function isVariationSelectorCodepoint(cp: number): boolean {
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true;
  if (cp >= 0xe0100 && cp <= 0xe01ef) return true;
  return false;
}

export function isCombiningMarkCodepoint(cp: number): boolean {
  if (cp >= 0x0300 && cp <= 0x036f) return true;
  if (cp >= 0x1ab0 && cp <= 0x1aff) return true;
  if (cp >= 0x1dc0 && cp <= 0x1dff) return true;
  if (cp >= 0x20d0 && cp <= 0x20ff) return true;
  if (cp >= 0xfe20 && cp <= 0xfe2f) return true;
  return false;
}

export function isEmojiModifierCodepoint(cp: number): boolean {
  return cp >= 0x1f3fb && cp <= 0x1f3ff;
}

export function isCoverageIgnorableCodepoint(cp: number): boolean {
  if (cp === 0x200c || cp === 0x200d) return true;
  if (isVariationSelectorCodepoint(cp)) return true;
  if (isCombiningMarkCodepoint(cp)) return true;
  if (cp >= 0xe0020 && cp <= 0xe007f) return true;
  return false;
}

export function shouldMergeTrailingClusterCodepoint(cp: number): boolean {
  if (cp === 0x200c || cp === 0x200d) return true;
  if (isVariationSelectorCodepoint(cp)) return true;
  if (isCombiningMarkCodepoint(cp)) return true;
  if (isEmojiModifierCodepoint(cp)) return true;
  return false;
}

export function resolvePresentationPreference(
  text: string,
  chars: string[],
): "emoji" | "text" | "auto" {
  if (text.includes("\ufe0f")) return "emoji";
  if (text.includes("\ufe0e")) return "text";
  if (text.includes("\u200d")) return "emoji";
  for (let i = 0; i < chars.length; i += 1) {
    const cp = chars[i].codePointAt(0) ?? 0;
    if (isLikelyEmojiCodepoint(cp)) return "emoji";
  }
  return "auto";
}

export function stylePreferenceFromFlags(
  bold: boolean,
  italic: boolean,
): "regular" | "bold" | "italic" | "bold_italic" {
  if (bold && italic) return "bold_italic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "regular";
}

export function isAppleSymbolsFont(entry: FontEntry | undefined | null): boolean {
  return !!entry && /\bapple symbols\b/i.test(entry.label ?? "");
}

export function fontEntryHasBoldStyle(entry: FontEntry | undefined | null): boolean {
  return !!entry && /\bbold\b/i.test(entry.label ?? "");
}

export function fontEntryHasItalicStyle(entry: FontEntry | undefined | null): boolean {
  return !!entry && /\b(italic|oblique)\b/i.test(entry.label ?? "");
}

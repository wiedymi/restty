import type { FontEntry, FontScaleOverride } from "../types";

const SYMBOL_FONT_HINTS = [
  /symbols nerd font/i,
  /symbolsnerd/i,
  /noto sans symbols/i,
  /notosanssymbols/i,
  /apple symbols/i,
  /symbola/i,
];
const NERD_SYMBOL_FONT_HINTS = [
  /symbols nerd font/i,
  /symbolsnerd/i,
  /nerd fonts symbols/i,
  /nerdfontssymbols/i,
];
const COLOR_EMOJI_FONT_HINTS = [
  /apple color emoji/i,
  /noto color emoji/i,
  /notocoloremoji/i,
  /segoe ui emoji/i,
  /twemoji/i,
  /openmoji/i,
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

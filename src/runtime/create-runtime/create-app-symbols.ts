import { getNerdConstraint, type NerdConstraint } from "../../fonts";
import { isSymbolCp } from "../../renderer";
import type { ResttyTouchSelectionMode } from "../types";

const RENDERER_SYMBOL_FALLBACK_RANGES: ReadonlyArray<readonly [number, number]> = [
  // Geometric Shapes: includes boxed/dot indicators often used in prompts.
  [0x25a0, 0x25ff],
  // Misc Symbols and Arrows: additional modern prompt icon block.
  [0x2b00, 0x2bff],
];

export const DEFAULT_SYMBOL_CONSTRAINT: NerdConstraint = {
  // Match Ghostty fallback behavior for non-Nerd symbol-like glyphs:
  // scale down to fit in the available cell width/height.
  size: "fit",
};

export const DEFAULT_APPLE_SYMBOLS_CONSTRAINT: NerdConstraint = {
  // Apple Symbols UI arrows/icons tend to render visually small at native metrics.
  // Use fit_cover1 to keep at least one-cell occupancy and center vertically.
  size: "fit_cover1",
  align_vertical: "center",
};

export const DEFAULT_EMOJI_CONSTRAINT: NerdConstraint = {
  // Match Ghostty's emoji treatment: maximize size, preserve aspect, center.
  size: "cover",
  align_horizontal: "center",
  align_vertical: "center",
  pad_left: 0.025,
  pad_right: 0.025,
};

export function normalizeTouchSelectionMode(
  value: ResttyTouchSelectionMode | undefined,
): ResttyTouchSelectionMode {
  if (value === "drag" || value === "long-press" || value === "off") return value;
  return "long-press";
}

export function clampFiniteNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
  round = false,
): number {
  if (!Number.isFinite(value)) return fallback;
  const numeric = round ? Math.round(value as number) : Number(value);
  return Math.min(max, Math.max(min, numeric));
}

export function isRenderSymbolLike(cp: number): boolean {
  return isSymbolCp(cp) || isRendererSymbolFallbackRange(cp);
}

export function resolveSymbolConstraint(cp: number): NerdConstraint | null {
  return getNerdConstraint(cp);
}

export function isRendererSymbolFallbackRange(cp: number): boolean {
  for (let i = 0; i < RENDERER_SYMBOL_FALLBACK_RANGES.length; i += 1) {
    const [start, end] = RENDERER_SYMBOL_FALLBACK_RANGES[i];
    if (cp >= start && cp <= end) return true;
  }
  return false;
}

export function rendererSymbolFallbackRanges(): ReadonlyArray<readonly [number, number]> {
  return RENDERER_SYMBOL_FALLBACK_RANGES;
}

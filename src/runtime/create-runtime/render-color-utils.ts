import type { Color } from "../../renderer";

export function decodePackedRGBA(color: number): Color {
  return [
    (color & 0xff) / 255,
    ((color >>> 8) & 0xff) / 255,
    ((color >>> 16) & 0xff) / 255,
    ((color >>> 24) & 0xff) / 255,
  ];
}

export function decodeRGBAWithCache(
  bytes: Uint8Array,
  index: number,
  cache: Map<number, Color>,
): Color {
  const offset = index * 4;
  const packed =
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0;
  const cached = cache.get(packed);
  if (cached) return cached;
  const decoded = decodePackedRGBA(packed);
  cache.set(packed, decoded);
  return decoded;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function brighten(color: Color, amount: number): Color {
  return [
    clamp01(color[0] + (1 - color[0]) * amount),
    clamp01(color[1] + (1 - color[1]) * amount),
    clamp01(color[2] + (1 - color[2]) * amount),
    color[3],
  ];
}

export function fade(color: Color, factor: number): Color {
  return [color[0], color[1], color[2], clamp01(color[3] * factor)];
}

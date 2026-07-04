import type { GhosttyTheme } from "../../../../src/index.ts";

type ThemeColor = NonNullable<GhosttyTheme["colors"]["background"]>;

function clampColorChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function themeColorToCss(color: ThemeColor): string {
  const r = clampColorChannel(color.r);
  const g = clampColorChannel(color.g);
  const b = clampColorChannel(color.b);
  const alpha = color.a === undefined ? 1 : clampColorChannel(color.a) / 255;

  if (alpha >= 1) {
    return `rgb(${r} ${g} ${b})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
}

export function themeBackgroundCss(theme: GhosttyTheme): string | null {
  const background = theme.colors.background;
  return background ? themeColorToCss(background) : null;
}

function luminance(color: ThemeColor): number {
  return (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
}

export function themeDividerCss(theme: GhosttyTheme): string | null {
  const background = theme.colors.background;
  if (!background) return null;

  const isLightBackground = luminance(background) > 0.5;
  const factor = isLightBackground ? 0.92 : 0.6;
  return themeColorToCss({
    r: background.r * factor,
    g: background.g * factor,
    b: background.b * factor,
    a: background.a,
  });
}

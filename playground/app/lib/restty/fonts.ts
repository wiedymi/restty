import type { ResttyFontHintTarget, ResttyFontInput } from "../../../../src/index.ts";

export type FontPresetId = "fira-code" | "jetbrains-mono";

export type FontPreset = {
  id: FontPresetId;
  label: string;
  fonts: ResttyFontInput[];
};

export const FONT_PRESETS: FontPreset[] = [
  {
    id: "fira-code",
    label: "Fira Code",
    fonts: [
      {
        family: "Fira Code",
        local: "prefer",
        fallback: { path: "/fonts/FiraCode-Regular.ttf", name: "Fira Code Regular" },
      },
    ],
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    fonts: [
      {
        family: "JetBrains Mono",
        local: "prefer",
        fallback: {
          path: "/fonts/JetBrainsMono-Regular.ttf",
          name: "JetBrains Mono Regular",
        },
      },
    ],
  },
];

export const DEFAULT_FONT_PRESET: FontPresetId = "fira-code";
export const DEFAULT_FONT_SIZE = 18;
export const DEFAULT_LIGATURES = true;
export const DEFAULT_FONT_HINTING = false;
export const DEFAULT_FONT_HINT_TARGET: ResttyFontHintTarget = "auto";

export function getFontPreset(id: FontPresetId): FontPreset {
  return FONT_PRESETS.find((preset) => preset.id === id) ?? FONT_PRESETS[0];
}

export function buildFontsForPreset(
  id: FontPresetId,
  localFamily: string | undefined,
): ResttyFontInput[] {
  const local = localFamily?.trim();
  const presetFonts = getFontPreset(id).fonts;
  if (!local) return presetFonts;
  return [{ family: local, local: "require" }, ...presetFonts];
}

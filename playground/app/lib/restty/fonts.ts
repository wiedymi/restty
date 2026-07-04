import type { ResttyFontHintTarget, ResttyFontInput } from "../../../../src/index.ts";

export type FontPresetId = "fira-code" | "jetbrains-mono";

export type FontPreset = {
  id: FontPresetId;
  label: string;
  fonts: ResttyFontInput[];
};

const FONT_URL_JETBRAINS_MONO =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf";
const FONT_URL_JETBRAINS_MONO_BOLD =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Bold/JetBrainsMonoNLNerdFontMono-Bold.ttf";
const FONT_URL_JETBRAINS_MONO_ITALIC =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Italic/JetBrainsMonoNLNerdFontMono-Italic.ttf";
const FONT_URL_JETBRAINS_MONO_BOLD_ITALIC =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/BoldItalic/JetBrainsMonoNLNerdFontMono-BoldItalic.ttf";
const FONT_URL_NERD_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFont-Regular.ttf";
const FONT_URL_SYMBOLA = "https://cdn.jsdelivr.net/gh/ChiefMikeK/ttf-symbola@master/Symbola.ttf";
const FONT_URL_NOTO_CANADIAN_ABORIGINAL =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/unhinted/ttf/NotoSansCanadianAboriginal/NotoSansCanadianAboriginal-Regular.ttf";
const FONT_URL_NOTO_COLOR_EMOJI =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf";

const JETBRAINS_NERD_FONTS: ResttyFontInput[] = [
  {
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Regular",
    weight: 400,
    style: "normal",
    fallback: { url: FONT_URL_JETBRAINS_MONO, name: "JetBrains Mono Nerd Font Regular" },
  },
  {
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Bold",
    weight: 700,
    style: "normal",
    fallback: {
      url: FONT_URL_JETBRAINS_MONO_BOLD,
      name: "JetBrains Mono Nerd Font Bold",
      weight: 700,
    },
  },
  {
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Italic",
    weight: 400,
    style: "italic",
    fallback: {
      url: FONT_URL_JETBRAINS_MONO_ITALIC,
      name: "JetBrains Mono Nerd Font Italic",
      style: "italic",
    },
  },
  {
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Bold Italic",
    weight: 700,
    style: "italic",
    fallback: {
      url: FONT_URL_JETBRAINS_MONO_BOLD_ITALIC,
      name: "JetBrains Mono Nerd Font Bold Italic",
      weight: 700,
      style: "italic",
    },
  },
  {
    path: "/fonts/JetBrainsMono-Regular.ttf",
    name: "JetBrains Mono Regular",
    weight: 400,
    style: "normal",
  },
];

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
    fonts: JETBRAINS_NERD_FONTS,
  },
];

export const PROMPT_FALLBACK_FONTS: ResttyFontInput[] = [
  {
    family: "Symbols Nerd Font",
    name: "Symbols Nerd Font",
    fallback: {
      path: "/fonts/SymbolsNerdFont-Regular.ttf",
      name: "Symbols Nerd Font",
    },
  },
  {
    url: FONT_URL_NERD_SYMBOLS,
    name: "Symbols Nerd Font",
  },
  {
    family: "Apple Symbols",
    name: "Apple Symbols",
  },
  {
    path: "/fonts/NotoSansSymbols2-Regular.ttf",
    name: "Noto Sans Symbols 2",
  },
  {
    url: FONT_URL_SYMBOLA,
    name: "Symbola",
  },
  {
    url: FONT_URL_NOTO_CANADIAN_ABORIGINAL,
    name: "Noto Sans Canadian Aboriginal",
  },
  {
    family: "Apple Color Emoji",
    name: "Apple Color Emoji",
  },
  {
    url: FONT_URL_NOTO_COLOR_EMOJI,
    name: "Noto Color Emoji",
  },
  {
    path: "/fonts/OpenMoji-black-glyf.ttf",
    name: "OpenMoji",
  },
  {
    path: "/fonts/NotoSansCJK-Regular.ttc",
    name: "Noto Sans CJK",
  },
];

export const SYMBOL_FALLBACK_FONTS = PROMPT_FALLBACK_FONTS;

export const DEFAULT_FONT_PRESET: FontPresetId = "jetbrains-mono";
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
  if (!local) return [...presetFonts, ...PROMPT_FALLBACK_FONTS];
  return [{ family: local, local: "require" }, ...presetFonts, ...PROMPT_FALLBACK_FONTS];
}

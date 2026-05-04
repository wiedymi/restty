import type { ResttyFontInput, ResttyFontStyle } from "../../src/index.ts";

const FONT_URL_FIRA_CODE = "/fonts/FiraCode-Regular.ttf";
const FONT_URL_JETBRAINS_MONO_BUNDLED = "/fonts/JetBrainsMono-Regular.ttf";
const FONT_URL_JETBRAINS_MONO =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf";
const FONT_URL_JETBRAINS_MONO_BOLD =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Bold/JetBrainsMonoNLNerdFontMono-Bold.ttf";
const FONT_URL_JETBRAINS_MONO_ITALIC =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Italic/JetBrainsMonoNLNerdFontMono-Italic.ttf";
const FONT_URL_JETBRAINS_MONO_BOLD_ITALIC =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/BoldItalic/JetBrainsMonoNLNerdFontMono-BoldItalic.ttf";
const FONT_URL_NERD_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf";
const FONT_URL_NOTO_SYMBOLS =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/unhinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf";
const FONT_URL_SYMBOLA = "https://cdn.jsdelivr.net/gh/ChiefMikeK/ttf-symbola@master/Symbola.ttf";
const FONT_URL_NOTO_CANADIAN_ABORIGINAL =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/unhinted/ttf/NotoSansCanadianAboriginal/NotoSansCanadianAboriginal-Regular.ttf";
const FONT_URL_NOTO_COLOR_EMOJI =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf";
const FONT_URL_OPENMOJI =
  "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/font/OpenMoji-black-glyf/OpenMoji-black-glyf.ttf";
const FONT_URL_NOTO_CJK_SC =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf";

export const DEFAULT_FONT_FAMILY = "fira-code";

type FontPresetKey = "fira-code" | "jetbrains";
type LocalFontVariant = {
  name: string;
  weight?: number;
  style?: ResttyFontStyle;
};
type FontPresetConfig = {
  family: string;
  localVariants: LocalFontVariant[];
  bundledFaces?: Array<{ name: string; path: string }>;
};

const FONT_PRESETS: Record<FontPresetKey, FontPresetConfig> = {
  "fira-code": {
    family: "Fira Code",
    localVariants: [
      { name: "Fira Code Regular", weight: 400, style: "normal" },
      { name: "Fira Code Bold", weight: 700, style: "normal" },
      { name: "Fira Code Italic", weight: 400, style: "italic" },
      { name: "Fira Code Bold Italic", weight: 700, style: "italic" },
    ],
    bundledFaces: [{ name: "Fira Code Regular", path: FONT_URL_FIRA_CODE }],
  },
  jetbrains: {
    family: "JetBrains Mono",
    localVariants: [
      { name: "JetBrains Mono Regular", weight: 400, style: "normal" },
      { name: "JetBrains Mono Bold", weight: 700, style: "normal" },
      { name: "JetBrains Mono Italic", weight: 400, style: "italic" },
      { name: "JetBrains Mono Bold Italic", weight: 700, style: "italic" },
    ],
    bundledFaces: [{ name: "JetBrains Mono Regular", path: FONT_URL_JETBRAINS_MONO_BUNDLED }],
  },
};

function createLocalFont(family: string, variant: LocalFontVariant): ResttyFontInput {
  return {
    family,
    name: variant.name,
    weight: variant.weight,
    style: variant.style,
  };
}

export function buildFontsForSelection(value: string, localMatcher: string): ResttyFontInput[] {
  const fonts: ResttyFontInput[] = [];

  if (localMatcher) {
    fonts.push({ family: localMatcher, local: "require" });
  }

  const preset = FONT_PRESETS[value as FontPresetKey];
  if (preset) {
    for (const variant of preset.localVariants) {
      fonts.push(createLocalFont(preset.family, variant));
    }
    for (const face of preset.bundledFaces ?? []) {
      fonts.push({ path: face.path, name: face.name });
    }
  }

  fonts.push({ url: FONT_URL_JETBRAINS_MONO, name: "JetBrains Mono Regular", weight: 400 });
  fonts.push({ url: FONT_URL_JETBRAINS_MONO_BOLD, name: "JetBrains Mono Bold", weight: 700 });
  fonts.push({
    url: FONT_URL_JETBRAINS_MONO_ITALIC,
    name: "JetBrains Mono Italic",
    weight: 400,
    style: "italic",
  });
  fonts.push({
    url: FONT_URL_JETBRAINS_MONO_BOLD_ITALIC,
    name: "JetBrains Mono Bold Italic",
    weight: 700,
    style: "italic",
  });
  fonts.push({ url: FONT_URL_NERD_SYMBOLS, name: "Symbols Nerd Font Mono" });
  fonts.push({ family: "Apple Symbols", local: "require" });
  fonts.push({ url: FONT_URL_NOTO_SYMBOLS, name: "Noto Sans Symbols 2" });
  fonts.push({ url: FONT_URL_SYMBOLA, name: "Symbola" });
  fonts.push({
    family: "Noto Sans Canadian Aboriginal",
    name: "Noto Sans Canadian Aboriginal / Euphemia UCAS",
  });
  fonts.push({
    url: FONT_URL_NOTO_CANADIAN_ABORIGINAL,
    name: "Noto Sans Canadian Aboriginal",
  });
  fonts.push({ family: "Apple Color Emoji", local: "require" });
  fonts.push({ url: FONT_URL_NOTO_COLOR_EMOJI, name: "Noto Color Emoji" });
  fonts.push({ url: FONT_URL_OPENMOJI, name: "OpenMoji" });
  fonts.push({ url: FONT_URL_NOTO_CJK_SC, name: "Noto Sans CJK SC" });

  return fonts;
}

export function buildStartupFontsForSelection(
  value: string,
  localMatcher: string,
): ResttyFontInput[] {
  const fonts: ResttyFontInput[] = [];

  if (localMatcher) {
    fonts.push({ family: localMatcher, local: "require" });
  }

  const preset = FONT_PRESETS[value as FontPresetKey] ?? FONT_PRESETS[DEFAULT_FONT_FAMILY];
  for (const face of preset.bundledFaces ?? []) {
    fonts.push({ path: face.path, name: face.name });
  }

  return fonts;
}

export function getCurrentFonts(
  selectedFontFamily: string,
  selectedLocalFontMatcher: string,
): ResttyFontInput[] {
  return buildFontsForSelection(selectedFontFamily, selectedLocalFontMatcher);
}

export function getStartupFonts(
  selectedFontFamily: string,
  selectedLocalFontMatcher: string,
): ResttyFontInput[] {
  return buildStartupFontsForSelection(selectedFontFamily, selectedLocalFontMatcher);
}

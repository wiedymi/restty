import type { ResttyFontSource } from "../../src/index.ts";

const FONT_URL_FIRA_CODE = "/playground/public/fonts/FiraCode-Regular.ttf";
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
  suffix: string;
  matchers: string[];
};
type FontPresetConfig = {
  localVariants: LocalFontVariant[];
  bundledFaces?: Array<{ label: string; url: string }>;
};

const FONT_PRESETS: Record<FontPresetKey, FontPresetConfig> = {
  "fira-code": {
    localVariants: [
      { suffix: "", matchers: ["fira code", "firacode", "fira code regular"] },
      { suffix: "bold", matchers: ["fira code bold", "firacode bold"] },
      { suffix: "italic", matchers: ["fira code italic", "firacode italic"] },
      {
        suffix: "bold italic",
        matchers: ["fira code bold italic", "firacode bold italic", "fira code retina"],
      },
    ],
    bundledFaces: [{ label: "Fira Code Regular", url: FONT_URL_FIRA_CODE }],
  },
  jetbrains: {
    localVariants: [
      {
        suffix: "",
        matchers: [
          "jetbrains mono nl nerd font mono regular",
          "jetbrains mono nl nerd font mono",
          "jetbrains mono nl",
          "jetbrains mono",
        ],
      },
      {
        suffix: "bold",
        matchers: [
          "jetbrains mono nl nerd font mono bold",
          "jetbrains mono nl bold",
          "jetbrains mono bold",
          "jetbrainsmono nerd font mono bold",
        ],
      },
      {
        suffix: "italic",
        matchers: [
          "jetbrains mono nl nerd font mono italic",
          "jetbrains mono nl italic",
          "jetbrains mono italic",
          "jetbrainsmono nerd font mono italic",
        ],
      },
      {
        suffix: "bold italic",
        matchers: [
          "jetbrains mono nl nerd font mono bold italic",
          "jetbrains mono nl bold italic",
          "jetbrains mono bold italic",
          "jetbrains mono nl italic bold",
          "jetbrains mono italic bold",
          "jetbrainsmono nerd font mono bold italic",
        ],
      },
    ],
  },
};

function createLocalFontSource(baseLabel: string, variant: LocalFontVariant): ResttyFontSource {
  return {
    type: "local",
    label: variant.suffix ? `local:${baseLabel} ${variant.suffix}` : `local:${baseLabel}`,
    matchers: variant.matchers,
  };
}

export function buildFontSourcesForSelection(
  value: string,
  localMatcher: string,
): ResttyFontSource[] {
  const sources: ResttyFontSource[] = [];

  if (localMatcher) {
    sources.push({
      type: "local",
      label: `local:${localMatcher}`,
      matchers: [localMatcher],
      required: true,
    });
  }

  const preset = FONT_PRESETS[value as FontPresetKey];
  if (preset) {
    const baseLabel = value.replace("-", " ");
    for (const variant of preset.localVariants) {
      sources.push(createLocalFontSource(baseLabel, variant));
    }
    for (const face of preset.bundledFaces ?? []) {
      sources.push({
        type: "url",
        label: face.label,
        url: face.url,
      });
    }
  }

  sources.push({
    type: "url",
    label: "JetBrains Mono Regular",
    url: FONT_URL_JETBRAINS_MONO,
  });
  sources.push({
    type: "url",
    label: "JetBrains Mono Bold",
    url: FONT_URL_JETBRAINS_MONO_BOLD,
  });
  sources.push({
    type: "url",
    label: "JetBrains Mono Italic",
    url: FONT_URL_JETBRAINS_MONO_ITALIC,
  });
  sources.push({
    type: "url",
    label: "JetBrains Mono Bold Italic",
    url: FONT_URL_JETBRAINS_MONO_BOLD_ITALIC,
  });
  sources.push({
    type: "url",
    label: "Symbols Nerd Font Mono",
    url: FONT_URL_NERD_SYMBOLS,
  });
  sources.push({
    type: "local",
    label: "Apple Symbols",
    matchers: ["apple symbols", "applesymbols", "apple symbols regular"],
    required: true,
  });
  sources.push({
    type: "url",
    label: "Noto Sans Symbols 2",
    url: FONT_URL_NOTO_SYMBOLS,
  });
  sources.push({
    type: "url",
    label: "Symbola",
    url: FONT_URL_SYMBOLA,
  });
  sources.push({
    type: "local",
    label: "Noto Sans Canadian Aboriginal / Euphemia UCAS",
    matchers: [
      "noto sans canadian aboriginal",
      "notosanscanadianaboriginal",
      "euphemia ucas",
      "euphemiaucas",
    ],
  });
  sources.push({
    type: "url",
    label: "Noto Sans Canadian Aboriginal",
    url: FONT_URL_NOTO_CANADIAN_ABORIGINAL,
  });
  sources.push({
    type: "local",
    label: "Apple Color Emoji",
    matchers: ["apple color emoji", "applecoloremoji"],
    required: true,
  });
  sources.push({
    type: "url",
    label: "Noto Color Emoji",
    url: FONT_URL_NOTO_COLOR_EMOJI,
  });
  sources.push({
    type: "url",
    label: "OpenMoji",
    url: FONT_URL_OPENMOJI,
  });
  sources.push({
    type: "url",
    label: "Noto Sans CJK SC",
    url: FONT_URL_NOTO_CJK_SC,
  });

  return sources;
}

export function getCurrentFontSources(
  selectedFontFamily: string,
  selectedLocalFontMatcher: string,
): ResttyFontSource[] {
  return buildFontSourcesForSelection(selectedFontFamily, selectedLocalFontMatcher);
}

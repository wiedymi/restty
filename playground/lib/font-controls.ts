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
export const FONT_FAMILY_LOCAL_PREFIX = "local:";

export type FontHintTarget = "auto" | "light" | "normal";
type FontPresetKey = "fira-code" | "jetbrains";
type LocalFontVariant = {
  suffix: string;
  matchers: string[];
};
type FontPresetConfig = {
  localVariants: LocalFontVariant[];
  bundledFaces?: Array<{ label: string; url: string }>;
};

type QueryLocalFontsResult = Array<{
  family?: string | null;
}>;

type SyncFontFamilyControlsOptions = {
  fontFamilySelect: HTMLSelectElement | null;
  fontFamilyLocalSelect: HTMLSelectElement | null;
  btnLoadLocalFonts: HTMLButtonElement | null;
  selectedFontFamily: string;
  selectedLocalFontMatcher: string;
  supportsLocalFontPicker: boolean;
};

type SyncHintingControlsOptions = {
  ligaturesSelect: HTMLSelectElement | null;
  fontHintingSelect: HTMLSelectElement | null;
  fontHintTargetSelect: HTMLSelectElement | null;
  selectedLigatures: boolean;
  selectedFontHinting: boolean;
  selectedFontHintTarget: FontHintTarget;
};

type DetectLocalFontsOptions = {
  fontFamilyLocalSelect: HTMLSelectElement | null;
  fontFamilyHintEl: HTMLElement | null;
  queryLocalFonts?: (() => Promise<QueryLocalFontsResult>) | null;
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

export function resolveFontHintTarget(value: string | null | undefined): FontHintTarget {
  if (value === "light" || value === "normal" || value === "auto") return value;
  return "auto";
}

export function supportsLocalFontPicker(browserWindow: unknown = globalThis.window): boolean {
  return (
    typeof browserWindow === "object" &&
    browserWindow !== null &&
    "queryLocalFonts" in browserWindow
  );
}

export function setFontFamilyHint(fontFamilyHintEl: HTMLElement | null, text: string) {
  if (fontFamilyHintEl) fontFamilyHintEl.textContent = text;
}

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

export function syncFontFamilyControls(options: SyncFontFamilyControlsOptions) {
  if (options.fontFamilySelect) {
    options.fontFamilySelect.value = options.selectedFontFamily;
  }
  if (options.fontFamilyLocalSelect) {
    options.fontFamilyLocalSelect.value = options.selectedLocalFontMatcher
      ? `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(options.selectedLocalFontMatcher)}`
      : "";
  }
  if (!options.supportsLocalFontPicker && options.btnLoadLocalFonts) {
    options.btnLoadLocalFonts.disabled = true;
  }
  if (!options.supportsLocalFontPicker && options.fontFamilyLocalSelect) {
    options.fontFamilyLocalSelect.disabled = true;
  }
}

export function syncHintingControls(options: SyncHintingControlsOptions) {
  if (options.ligaturesSelect) {
    options.ligaturesSelect.value = options.selectedLigatures ? "on" : "off";
  }
  if (options.fontHintingSelect) {
    options.fontHintingSelect.value = options.selectedFontHinting ? "on" : "off";
  }
  if (options.fontHintTargetSelect) {
    options.fontHintTargetSelect.value = options.selectedFontHintTarget;
    options.fontHintTargetSelect.disabled = !options.selectedFontHinting;
  }
}

function upsertDetectedLocalFontOption(
  fontFamilyLocalSelect: HTMLSelectElement | null,
  family: string,
) {
  if (!fontFamilyLocalSelect) return;
  const matcher = family.trim().toLowerCase();
  if (!matcher) return;
  const value = `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(matcher)}`;
  for (let i = fontFamilyLocalSelect.options.length - 1; i >= 0; i -= 1) {
    if (fontFamilyLocalSelect.options[i]?.value === value) return;
  }
  const option = document.createElement("option");
  option.value = value;
  option.textContent = `Local Font: ${family}`;
  option.dataset.localDetected = "1";
  fontFamilyLocalSelect.appendChild(option);
}

export async function detectLocalFonts(options: DetectLocalFontsOptions) {
  const queryLocalFonts =
    options.queryLocalFonts ??
    ((supportsLocalFontPicker() ? (globalThis.window as any).queryLocalFonts : null) as
      | (() => Promise<QueryLocalFontsResult>)
      | null);

  if (!queryLocalFonts) {
    setFontFamilyHint(
      options.fontFamilyHintEl,
      "Local font picker is not supported in this browser.",
    );
    return;
  }

  try {
    if (options.fontFamilyLocalSelect) {
      for (let i = options.fontFamilyLocalSelect.options.length - 1; i >= 0; i -= 1) {
        if (options.fontFamilyLocalSelect.options[i]?.dataset.localDetected === "1") {
          options.fontFamilyLocalSelect.remove(i);
        }
      }
    }
    const fonts = await queryLocalFonts();
    const seen = new Set<string>();
    let added = 0;
    for (let i = 0; i < fonts.length; i += 1) {
      const family = String(fonts[i]?.family ?? "").trim();
      if (!family) continue;
      const key = family.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      upsertDetectedLocalFontOption(options.fontFamilyLocalSelect, family);
      added += 1;
    }
    if (options.fontFamilyLocalSelect) {
      options.fontFamilyLocalSelect.disabled = false;
    }
    setFontFamilyHint(options.fontFamilyHintEl, `Detected ${added} local font families.`);
  } catch {
    setFontFamilyHint(options.fontFamilyHintEl, "Local font access denied or unavailable.");
  }
}

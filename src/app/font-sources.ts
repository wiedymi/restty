import type { ResttyFontPreset, ResttyFontSource } from "./types";

/** Local-first default font fallback chain with CDN fallback for JetBrains Mono, Nerd symbols, emoji, and CJK support. */
export const DEFAULT_FONT_SOURCES: ResttyFontSource[] = [
  {
    type: "local",
    matchers: [
      "jetbrainsmono nerd font",
      "jetbrains mono nerd font",
      "jetbrains mono nl nerd font mono",
      "jetbrains mono",
      "jetbrainsmono",
    ],
    label: "JetBrains Mono Nerd Font (Local)",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Regular/JetBrainsMonoNLNerdFontMono-Regular.ttf",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Bold/JetBrainsMonoNLNerdFontMono-Bold.ttf",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/Italic/JetBrainsMonoNLNerdFontMono-Italic.ttf",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/JetBrainsMono/NoLigatures/BoldItalic/JetBrainsMonoNLNerdFontMono-BoldItalic.ttf",
  },
  {
    type: "local",
    matchers: [
      "symbols nerd font mono",
      "symbols nerd font",
      "nerd fonts symbols",
      "nerdfontssymbolsonly",
    ],
    label: "Symbols Nerd Font (Local)",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf",
  },
  // Ghostty parity on macOS: prefer system symbols/emoji when available.
  {
    type: "local",
    matchers: ["apple symbols", "applesymbols", "apple symbols regular"],
    label: "Apple Symbols",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/unhinted/ttf/NotoSansSymbols2/NotoSansSymbols2-Regular.ttf",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ChiefMikeK/ttf-symbola@master/Symbola.ttf",
  },
  {
    type: "local",
    matchers: ["apple color emoji", "applecoloremoji"],
    label: "Apple Color Emoji",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@master/font/OpenMoji-black-glyf/OpenMoji-black-glyf.ttf",
  },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
  },
];

function validateFontSource(source: ResttyFontSource, index: number): ResttyFontSource {
  if (!source || typeof source !== "object" || !("type" in source)) {
    throw new Error(`fontSources[${index}] must be a typed source object`);
  }
  if (source.type === "url") {
    if (typeof source.url !== "string" || !source.url.trim()) {
      throw new Error(`fontSources[${index}] url source requires a non-empty url`);
    }
    return source;
  }
  if (source.type === "buffer") {
    const data = source.data;
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      throw new Error(
        `fontSources[${index}] buffer source requires ArrayBuffer or ArrayBufferView`,
      );
    }
    return source;
  }
  if (source.type === "local") {
    if (!Array.isArray(source.matchers)) {
      throw new Error(`fontSources[${index}] local source requires at least one matcher`);
    }
    let hasMatcher = false;
    for (let i = 0; i < source.matchers.length; i += 1) {
      if (source.matchers[i]) {
        hasMatcher = true;
        break;
      }
    }
    if (!hasMatcher) {
      throw new Error(`fontSources[${index}] local source requires at least one matcher`);
    }
    return source;
  }
  throw new Error(`fontSources[${index}] has unsupported source type`);
}

/** Validates user-provided font sources or returns defaults based on preset (none returns empty array, otherwise default CDN fonts). */
export function normalizeFontSources(
  sources: ResttyFontSource[] | undefined,
  preset: ResttyFontPreset | undefined,
): ResttyFontSource[] {
  if (sources && sources.length) {
    const normalized: ResttyFontSource[] = new Array(sources.length);
    for (let i = 0; i < sources.length; i += 1) {
      normalized[i] = validateFontSource(sources[i], i);
    }
    return normalized;
  }

  if (preset === "none") return [];
  return [...DEFAULT_FONT_SOURCES];
}

import type {
  ResttyFontBufferInput,
  ResttyFontData,
  ResttyFontFallbackInput,
  ResttyFontFamilyInput,
  ResttyFontInput,
  ResttyFontPathInput,
  ResttyFontStyle,
  ResttyFontUrlInput,
  ResttyResolvedFontSource,
} from "../core/models";

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

const LOCAL_FONT_ALIASES: Record<string, string[]> = {
  "apple color emoji": ["apple color emoji", "applecoloremoji"],
  "apple symbols": ["apple symbols", "applesymbols", "apple symbols regular"],
  "fira code": ["fira code", "firacode", "fira code regular"],
  "jetbrains mono": ["jetbrains mono", "jetbrainsmono"],
  "jetbrains mono nerd font": [
    "jetbrainsmono nerd font",
    "jetbrains mono nerd font",
    "jetbrains mono nl nerd font mono",
    "jetbrains mono",
    "jetbrainsmono",
  ],
  "noto sans canadian aboriginal": [
    "noto sans canadian aboriginal",
    "notosanscanadianaboriginal",
    "euphemia ucas",
    "euphemiaucas",
  ],
  "symbols nerd font": ["symbols nerd font", "nerd fonts symbols", "nerdfontssymbolsonly"],
};

/** Default local-first fallback chain for terminal, symbols, emoji, and CJK coverage. */
export const DEFAULT_FONT_INPUTS: readonly ResttyFontInput[] = [
  {
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Regular",
    weight: 400,
    style: "normal",
  },
  {
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Bold",
    weight: 700,
    style: "normal",
  },
  {
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Italic",
    weight: 400,
    style: "italic",
  },
  {
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Bold Italic",
    weight: 700,
    style: "italic",
  },
  { url: FONT_URL_JETBRAINS_MONO, name: "JetBrains Mono Nerd Font Regular", weight: 400 },
  { url: FONT_URL_JETBRAINS_MONO_BOLD, name: "JetBrains Mono Nerd Font Bold", weight: 700 },
  {
    url: FONT_URL_JETBRAINS_MONO_ITALIC,
    name: "JetBrains Mono Nerd Font Italic",
    weight: 400,
    style: "italic",
  },
  {
    url: FONT_URL_JETBRAINS_MONO_BOLD_ITALIC,
    name: "JetBrains Mono Nerd Font Bold Italic",
    weight: 700,
    style: "italic",
  },
  { family: "Symbols Nerd Font", name: "Symbols Nerd Font" },
  { url: FONT_URL_NERD_SYMBOLS, name: "Symbols Nerd Font" },
  { family: "Apple Symbols", name: "Apple Symbols" },
  { url: FONT_URL_NOTO_SYMBOLS, name: "Noto Sans Symbols 2" },
  { url: FONT_URL_SYMBOLA, name: "Symbola" },
  {
    family: "Noto Sans Canadian Aboriginal",
    name: "Noto Sans Canadian Aboriginal / Euphemia UCAS",
  },
  { url: FONT_URL_NOTO_CANADIAN_ABORIGINAL, name: "Noto Sans Canadian Aboriginal" },
  { family: "Apple Color Emoji", name: "Apple Color Emoji" },
  { url: FONT_URL_NOTO_COLOR_EMOJI, name: "Noto Color Emoji" },
  { url: FONT_URL_OPENMOJI, name: "OpenMoji" },
  { url: FONT_URL_NOTO_CJK_SC, name: "Noto Sans CJK SC" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFontData(value: unknown): value is ResttyFontData {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}

function normalizeNonEmptyString(value: unknown, errorPrefix: string): string {
  if (typeof value !== "string") {
    throw new Error(`${errorPrefix} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${errorPrefix} must be a non-empty string`);
  }
  return trimmed;
}

function normalizeWeight(value: unknown, errorPrefix: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${errorPrefix}.weight must be a positive number`);
  }
  return value;
}

function normalizeStyle(value: unknown, errorPrefix: string): ResttyFontStyle | undefined {
  if (value === undefined) return undefined;
  if (value === "normal" || value === "italic" || value === "oblique") return value;
  throw new Error(`${errorPrefix}.style must be "normal", "italic", or "oblique"`);
}

function isUrlLikeString(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^(https?:|data:|blob:|\/|\.\/|\.\.\/)/i.test(trimmed) ||
    /\.(ttf|otf|ttc|woff2?)([?#].*)?$/i.test(trimmed) ||
    trimmed.includes("/")
  );
}

function normalizeMatcher(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sourceLabelFromUrl(url: string, index: number): string {
  try {
    const parsed = new URL(
      url,
      typeof document !== "undefined" && document.baseURI ? document.baseURI : undefined,
    );
    const name = parsed.pathname.split("/").filter(Boolean).pop();
    return name || `font-${index + 1}`;
  } catch {
    const name = url.split(/[/?#]/).filter(Boolean).pop();
    return name || `font-${index + 1}`;
  }
}

function addMatcher(matchers: string[], value: string | undefined): void {
  if (!value) return;
  const normalized = normalizeMatcher(value);
  if (!normalized || matchers.includes(normalized)) return;
  matchers.push(normalized);
  const compact = normalized.replace(/\s+/g, "");
  if (compact && compact !== normalized && !matchers.includes(compact)) {
    matchers.push(compact);
  }
}

function styleWords(weight: number | undefined, style: ResttyFontStyle | undefined): string {
  const words: string[] = [];
  if (weight !== undefined && weight >= 650) words.push("bold");
  if (style === "italic" || style === "oblique") words.push(style);
  if (!words.length && weight !== undefined && weight <= 500 && (!style || style === "normal")) {
    words.push("regular");
  }
  return words.join(" ");
}

function createLocalMatchers(
  family: string,
  name: string | undefined,
  weight: number | undefined,
  style: ResttyFontStyle | undefined,
): string[] {
  const familyKey = normalizeMatcher(family);
  const aliases = LOCAL_FONT_ALIASES[familyKey] ?? [family];
  const matchers: string[] = [];
  const suffix = styleWords(weight, style);

  addMatcher(matchers, name);
  for (const alias of aliases) {
    addMatcher(matchers, alias);
    if (suffix) addMatcher(matchers, `${alias} ${suffix}`);
  }
  return matchers;
}

function resolveUrlFont(
  input: ResttyFontUrlInput | ResttyFontPathInput,
  index: number,
  errorPrefix: string,
): ResttyResolvedFontSource {
  const raw = "url" in input ? input.url : input.path;
  const url = raw instanceof URL ? raw.href : normalizeNonEmptyString(raw, `${errorPrefix}.url`);
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : undefined;
  return {
    kind: "url",
    url,
    label: name ?? sourceLabelFromUrl(url, index),
    weight: normalizeWeight(input.weight, errorPrefix),
    style: normalizeStyle(input.style, errorPrefix),
  };
}

function resolveBufferFont(
  input: ResttyFontBufferInput,
  index: number,
  errorPrefix: string,
): ResttyResolvedFontSource {
  if (!isFontData(input.data)) {
    throw new Error(`${errorPrefix}.data must be ArrayBuffer or ArrayBufferView`);
  }
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : undefined;
  return {
    kind: "buffer",
    data: input.data,
    label: name ?? `font-buffer-${index + 1}`,
    weight: normalizeWeight(input.weight, errorPrefix),
    style: normalizeStyle(input.style, errorPrefix),
  };
}

function resolveFamilyFont(
  input: ResttyFontFamilyInput,
  index: number,
  errorPrefix: string,
): ResttyResolvedFontSource[] {
  const family = normalizeNonEmptyString(input.family, `${errorPrefix}.family`);
  const mode = input.local ?? "prefer";
  if (mode !== "prefer" && mode !== "require") {
    throw new Error(`${errorPrefix}.local must be "prefer" or "require"`);
  }
  if (mode === "require" && input.fallback !== undefined) {
    throw new Error(`${errorPrefix}.fallback cannot be used when local is "require"`);
  }

  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : undefined;
  const weight = normalizeWeight(input.weight, errorPrefix);
  const style = normalizeStyle(input.style, errorPrefix);
  const sources: ResttyResolvedFontSource[] = [
    {
      kind: "local",
      family,
      matchers: createLocalMatchers(family, name, weight, style),
      label: name ?? family,
      required: mode === "require",
      weight,
      style,
    },
  ];

  if (mode === "prefer" && input.fallback !== undefined) {
    sources.push(...resolveFallbackFont(input.fallback, index, `${errorPrefix}.fallback`));
  }
  return sources;
}

function resolveStringFont(
  input: string,
  index: number,
  errorPrefix: string,
  fallback: boolean,
): ResttyResolvedFontSource[] {
  const value = normalizeNonEmptyString(input, errorPrefix);
  if (isUrlLikeString(value)) {
    return [
      {
        kind: "url",
        url: value,
        label: sourceLabelFromUrl(value, index),
      },
    ];
  }
  if (fallback) {
    throw new Error(`${errorPrefix} must be a URL, path, URL object, or font data`);
  }
  return resolveFamilyFont({ family: value }, index, errorPrefix);
}

function resolveFallbackFont(
  input: ResttyFontFallbackInput,
  index: number,
  errorPrefix: string,
): ResttyResolvedFontSource[] {
  if (typeof input === "string") return resolveStringFont(input, index, errorPrefix, true);
  if (input instanceof URL) {
    return [
      {
        kind: "url",
        url: input.href,
        label: sourceLabelFromUrl(input.href, index),
      },
    ];
  }
  if (isFontData(input)) {
    return [
      {
        kind: "buffer",
        data: input,
        label: `font-buffer-${index + 1}`,
      },
    ];
  }
  return resolveFontInput(input, index, errorPrefix, true);
}

function resolveFontInput(
  input: ResttyFontInput,
  index: number,
  errorPrefix: string,
  fallback = false,
): ResttyResolvedFontSource[] {
  if (typeof input === "string") return resolveStringFont(input, index, errorPrefix, fallback);
  if (input instanceof URL) {
    return [
      {
        kind: "url",
        url: input.href,
        label: sourceLabelFromUrl(input.href, index),
      },
    ];
  }
  if (isFontData(input)) {
    return [
      {
        kind: "buffer",
        data: input,
        label: `font-buffer-${index + 1}`,
      },
    ];
  }
  if (!isRecord(input)) {
    throw new Error(`${errorPrefix} must be a font input`);
  }
  if ("type" in input) {
    throw new Error(`${errorPrefix} uses the removed legacy font source shape`);
  }
  if ("family" in input) {
    if (fallback) {
      throw new Error(`${errorPrefix} cannot be a family font`);
    }
    return resolveFamilyFont(input as ResttyFontFamilyInput, index, errorPrefix);
  }
  if ("url" in input || "path" in input) {
    return [resolveUrlFont(input as ResttyFontUrlInput | ResttyFontPathInput, index, errorPrefix)];
  }
  if ("data" in input) {
    return [resolveBufferFont(input as ResttyFontBufferInput, index, errorPrefix)];
  }
  throw new Error(`${errorPrefix} must define family, url, path, or data`);
}

export function resolveFontInputs(
  inputs: readonly ResttyFontInput[] | undefined,
): ResttyResolvedFontSource[] {
  const sourceInputs = inputs === undefined ? DEFAULT_FONT_INPUTS : inputs;
  if (!Array.isArray(sourceInputs)) {
    throw new Error("terminal.fonts must be an array");
  }

  const sources: ResttyResolvedFontSource[] = [];
  for (let i = 0; i < sourceInputs.length; i += 1) {
    sources.push(...resolveFontInput(sourceInputs[i], i, `fonts[${i}]`));
  }
  return sources;
}

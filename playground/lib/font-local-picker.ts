export const FONT_FAMILY_LOCAL_PREFIX = "local:";
export const DEFAULT_LOCAL_FONT_HINT =
  "Select a base font, then pick a local font from the local picker.";
export const UNSUPPORTED_LOCAL_FONT_HINT = "Local font picker is not supported in this browser.";
export const DENIED_LOCAL_FONT_HINT = "Local font access denied or unavailable.";

export type LocalFontOption = {
  value: string;
  label: string;
};

type QueryLocalFontsResult = Array<{
  family?: string | null;
}>;

type DetectLocalFontsOptions = {
  fontFamilyLocalSelect: HTMLSelectElement | null;
  fontFamilyHintEl: HTMLElement | null;
  queryLocalFonts?: (() => Promise<QueryLocalFontsResult>) | null;
};

type DetectLocalFontStateOptions = {
  browserWindow?: unknown;
  queryLocalFonts?: (() => Promise<QueryLocalFontsResult>) | null;
};

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

export function getLocalFontSelectValue(selectedLocalFontMatcher: string) {
  return selectedLocalFontMatcher
    ? `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(selectedLocalFontMatcher)}`
    : "";
}

export function getDefaultLocalFontHintText(isSupported: boolean) {
  return isSupported ? DEFAULT_LOCAL_FONT_HINT : UNSUPPORTED_LOCAL_FONT_HINT;
}

function buildDetectedLocalFontOption(family: string): LocalFontOption | null {
  const matcher = family.trim().toLowerCase();
  if (!matcher) return null;
  return {
    value: `${FONT_FAMILY_LOCAL_PREFIX}${encodeURIComponent(matcher)}`,
    label: `Local Font: ${family}`,
  };
}

export function buildDetectedLocalFontOptions(fonts: QueryLocalFontsResult): LocalFontOption[] {
  const seen = new Set<string>();
  const options: LocalFontOption[] = [];
  for (let i = 0; i < fonts.length; i += 1) {
    const family = String(fonts[i]?.family ?? "").trim();
    if (!family) continue;
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const option = buildDetectedLocalFontOption(family);
    if (option) {
      options.push(option);
    }
  }
  return options;
}

function upsertDetectedLocalFontOption(
  fontFamilyLocalSelect: HTMLSelectElement | null,
  localOption: LocalFontOption,
) {
  if (!fontFamilyLocalSelect) return;
  for (let i = fontFamilyLocalSelect.options.length - 1; i >= 0; i -= 1) {
    if (fontFamilyLocalSelect.options[i]?.value === localOption.value) return;
  }
  const option = document.createElement("option");
  option.value = localOption.value;
  option.textContent = localOption.label;
  option.dataset.localDetected = "1";
  fontFamilyLocalSelect.appendChild(option);
}

export async function detectLocalFontState(options: DetectLocalFontStateOptions = {}) {
  const queryLocalFonts =
    options.queryLocalFonts ??
    ((supportsLocalFontPicker(options.browserWindow ?? globalThis.window)
      ? (globalThis.window as any).queryLocalFonts
      : null) as (() => Promise<QueryLocalFontsResult>) | null);

  if (!queryLocalFonts) {
    return {
      detectedOptions: [] as LocalFontOption[],
      hintText: UNSUPPORTED_LOCAL_FONT_HINT,
    };
  }

  try {
    const fonts = await queryLocalFonts();
    const detectedOptions = buildDetectedLocalFontOptions(fonts);
    return {
      detectedOptions,
      hintText: `Detected ${detectedOptions.length} local font families.`,
    };
  } catch {
    return {
      detectedOptions: [] as LocalFontOption[],
      hintText: DENIED_LOCAL_FONT_HINT,
    };
  }
}

export async function detectLocalFonts(options: DetectLocalFontsOptions) {
  const state = await detectLocalFontState({
    queryLocalFonts: options.queryLocalFonts,
  });
  if (state.hintText === UNSUPPORTED_LOCAL_FONT_HINT) {
    setFontFamilyHint(options.fontFamilyHintEl, state.hintText);
    return;
  }
  if (options.fontFamilyLocalSelect) {
    for (let i = options.fontFamilyLocalSelect.options.length - 1; i >= 0; i -= 1) {
      if (options.fontFamilyLocalSelect.options[i]?.dataset.localDetected === "1") {
        options.fontFamilyLocalSelect.remove(i);
      }
    }
  }
  for (let i = 0; i < state.detectedOptions.length; i += 1) {
    upsertDetectedLocalFontOption(options.fontFamilyLocalSelect, state.detectedOptions[i]!);
  }
  if (options.fontFamilyLocalSelect && state.hintText !== UNSUPPORTED_LOCAL_FONT_HINT) {
    options.fontFamilyLocalSelect.disabled = false;
  }
  setFontFamilyHint(options.fontFamilyHintEl, state.hintText);
}

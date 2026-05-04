import { applyFontsToAllPanes, type FontApplicationHost } from "./font-application.ts";
import {
  FONT_FAMILY_LOCAL_PREFIX,
  detectLocalFontState,
  type LocalFontOption,
} from "./font-local-picker.ts";
import { getCurrentFonts, getStartupFonts } from "./font-catalog.ts";

type FontSelectionControllerShellSync = {
  syncFontFamilyValue: () => void;
  syncLocalFontControls: () => void;
};

type CreatePaneFontSelectionControllerOptions = {
  host: FontApplicationHost;
  shellSync: FontSelectionControllerShellSync;
  initialState: {
    detectedLocalFontOptions: LocalFontOption[];
    fontFamily: string;
    localFontHintText: string;
    localFontMatcher: string;
  };
  detectLocalFontState?: typeof detectLocalFontState;
};

export function createPaneFontSelectionController(
  options: CreatePaneFontSelectionControllerOptions,
) {
  const detectLocalFontStateImpl = options.detectLocalFontState ?? detectLocalFontState;
  const defaultFontFamily = options.initialState.fontFamily;

  let detectedLocalFontOptions = options.initialState.detectedLocalFontOptions;
  let selectedFontFamily = options.initialState.fontFamily;
  let localFontHintText = options.initialState.localFontHintText;
  let selectedLocalFontMatcher = options.initialState.localFontMatcher;

  async function applyFonts() {
    await applyFontsToAllPanes({
      host: options.host,
      selectedFontFamily,
      selectedLocalFontMatcher,
      onError: (error) => {
        console.error("font apply failed", error);
      },
    });
  }

  async function applyFontFamilySelection(value: string | null | undefined) {
    selectedFontFamily = value || defaultFontFamily;
    options.shellSync.syncFontFamilyValue();
    options.shellSync.syncLocalFontControls();
    await applyFonts();
  }

  async function applyLocalFontSelection(value: string | null | undefined) {
    if (!value) {
      selectedLocalFontMatcher = "";
    } else if (value.startsWith(FONT_FAMILY_LOCAL_PREFIX)) {
      const encoded = value.slice(FONT_FAMILY_LOCAL_PREFIX.length);
      selectedLocalFontMatcher = decodeURIComponent(encoded).trim().toLowerCase();
    } else {
      selectedLocalFontMatcher = "";
    }
    options.shellSync.syncLocalFontControls();
    await applyFonts();
  }

  async function loadLocalFonts() {
    const state = await detectLocalFontStateImpl();
    detectedLocalFontOptions = state.detectedOptions;
    localFontHintText = state.hintText;
    options.shellSync.syncLocalFontControls();
  }

  return {
    applyFontFamilySelection,
    applyLocalFontSelection,
    getDetectedLocalFontOptions: () => detectedLocalFontOptions,
    getFontFamily: () => selectedFontFamily,
    getFonts: () => getCurrentFonts(selectedFontFamily, selectedLocalFontMatcher),
    getStartupFonts: () => getStartupFonts(selectedFontFamily, selectedLocalFontMatcher),
    getLocalFontHintText: () => localFontHintText,
    getLocalFontMatcher: () => selectedLocalFontMatcher,
    loadLocalFonts,
  };
}

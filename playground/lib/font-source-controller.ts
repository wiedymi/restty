import { applyFontSourcesToAllPanes, type FontApplicationHost } from "./font-application.ts";
import {
  FONT_FAMILY_LOCAL_PREFIX,
  detectLocalFontState,
  type LocalFontOption,
} from "./font-local-picker.ts";
import { getCurrentFontSources, getStartupFontSources } from "./font-source-catalog.ts";

type FontSourceControllerShellSync = {
  syncFontFamilyValue: () => void;
  syncLocalFontControls: () => void;
};

type CreatePaneFontSourceControllerOptions = {
  host: FontApplicationHost;
  shellSync: FontSourceControllerShellSync;
  initialState: {
    detectedLocalFontOptions: LocalFontOption[];
    fontFamily: string;
    localFontHintText: string;
    localFontMatcher: string;
  };
  detectLocalFontState?: typeof detectLocalFontState;
};

export function createPaneFontSourceController(options: CreatePaneFontSourceControllerOptions) {
  const detectLocalFontStateImpl = options.detectLocalFontState ?? detectLocalFontState;
  const defaultFontFamily = options.initialState.fontFamily;

  let detectedLocalFontOptions = options.initialState.detectedLocalFontOptions;
  let selectedFontFamily = options.initialState.fontFamily;
  let localFontHintText = options.initialState.localFontHintText;
  let selectedLocalFontMatcher = options.initialState.localFontMatcher;

  async function applyFontSources() {
    await applyFontSourcesToAllPanes({
      host: options.host,
      selectedFontFamily,
      selectedLocalFontMatcher,
      onError: (error) => {
        console.error("font source apply failed", error);
      },
    });
  }

  async function applyFontFamilySelection(value: string | null | undefined) {
    selectedFontFamily = value || defaultFontFamily;
    options.shellSync.syncFontFamilyValue();
    options.shellSync.syncLocalFontControls();
    await applyFontSources();
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
    await applyFontSources();
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
    getFontSources: () => getCurrentFontSources(selectedFontFamily, selectedLocalFontMatcher),
    getStartupFontSources: () =>
      getStartupFontSources(selectedFontFamily, selectedLocalFontMatcher),
    getLocalFontHintText: () => localFontHintText,
    getLocalFontMatcher: () => selectedLocalFontMatcher,
    loadLocalFonts,
  };
}

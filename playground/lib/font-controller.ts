import {
  applyFontRenderingOptionsToAllPanes,
  applyFontSourcesToAllPanes,
  type FontApplicationHost,
} from "./font-application.ts";
import {
  getCurrentFontSources,
  resolveFontHintTarget,
  type FontHintTarget,
} from "./font-controls.ts";
import {
  FONT_FAMILY_LOCAL_PREFIX,
  detectLocalFontState,
  type LocalFontOption,
} from "./font-local-picker.ts";
import type { PaneState } from "./pane-state.ts";

export type FontControllerPane = {
  runtime: {
    terminal: {
      setFontSize: (value: number) => void;
    };
  };
};

type FontControllerShellSync = {
  syncFontFamilyValue: () => void;
  syncFontRenderingControls: () => void;
  syncLocalFontControls: () => void;
};

type CreatePaneFontControllerOptions = {
  host: FontApplicationHost;
  getActivePane: () => FontControllerPane | null;
  getActivePaneState: () => PaneState | null;
  shellSync: FontControllerShellSync;
  initialState: {
    detectedLocalFontOptions: LocalFontOption[];
    fontFamily: string;
    fontHintTarget: FontHintTarget;
    fontHinting: boolean;
    fontSizeDefault: number;
    ligatures: boolean;
    localFontHintText: string;
    localFontMatcher: string;
  };
  detectLocalFontState?: typeof detectLocalFontState;
};

export function createPaneFontController(options: CreatePaneFontControllerOptions) {
  const detectLocalFontStateImpl = options.detectLocalFontState ?? detectLocalFontState;
  const defaultFontFamily = options.initialState.fontFamily;

  let detectedLocalFontOptions = options.initialState.detectedLocalFontOptions;
  let selectedFontFamily = options.initialState.fontFamily;
  let selectedFontHintTarget = options.initialState.fontHintTarget;
  let selectedFontHinting = options.initialState.fontHinting;
  let selectedFontSizeDefault = options.initialState.fontSizeDefault;
  let selectedLigatures = options.initialState.ligatures;
  let localFontHintText = options.initialState.localFontHintText;
  let selectedLocalFontMatcher = options.initialState.localFontMatcher;

  function getActiveContext() {
    const pane = options.getActivePane();
    const state = options.getActivePaneState();
    if (!pane || !state) return null;
    return { pane, state };
  }

  function syncFontSizeDefaultFromState(state: PaneState) {
    selectedFontSizeDefault = state.fontSize;
  }

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

  function applyFontRenderingSelections() {
    options.shellSync.syncFontRenderingControls();
    applyFontRenderingOptionsToAllPanes({
      host: options.host,
      selectedLigatures,
      selectedFontHinting,
      selectedFontHintTarget,
    });
  }

  function applyFontSizeValue(value: string | null | undefined) {
    const active = getActiveContext();
    if (!active) return;
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    selectedFontSizeDefault = nextValue;
    active.state.fontSize = nextValue;
    active.pane.runtime.terminal.setFontSize(nextValue);
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

  function applyFontHintingChange(value: string | null | undefined) {
    selectedFontHinting = value === "on";
    applyFontRenderingSelections();
  }

  function applyLigaturesChange(value: string | null | undefined) {
    selectedLigatures = value === "on";
    applyFontRenderingSelections();
  }

  function applyFontHintTargetChange(value: string | null | undefined) {
    selectedFontHintTarget = resolveFontHintTarget(value);
    applyFontRenderingSelections();
  }

  return {
    applyFontFamilySelection,
    applyFontHintTargetChange,
    applyFontHintingChange,
    applyFontRenderingSelections,
    applyFontSizeValue,
    applyLigaturesChange,
    applyLocalFontSelection,
    getDetectedLocalFontOptions: () => detectedLocalFontOptions,
    getFontFamily: () => selectedFontFamily,
    getFontHintTarget: () => selectedFontHintTarget,
    getFontHinting: () => selectedFontHinting,
    getFontSizeDefault: () => selectedFontSizeDefault,
    getFontSources: () => getCurrentFontSources(selectedFontFamily, selectedLocalFontMatcher),
    getLigatures: () => selectedLigatures,
    getLocalFontHintText: () => localFontHintText,
    getLocalFontMatcher: () => selectedLocalFontMatcher,
    loadLocalFonts,
    syncFontSizeDefaultFromState,
  };
}

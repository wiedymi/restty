import {
  applyFontRenderingOptionsToAllPanes,
  type FontApplicationHost,
} from "./font-application.ts";
import { resolveFontHintTarget, type FontHintTarget } from "./font-controls.ts";
import type { PaneState } from "./pane-state.ts";

export type FontRenderingControllerPane = {
  runtime: {
    terminal: {
      setFontSize: (value: number) => void;
    };
  };
};

type FontRenderingControllerShellSync = {
  syncFontRenderingControls: () => void;
};

type CreatePaneFontRenderingControllerOptions = {
  host: FontApplicationHost;
  getActivePane: () => FontRenderingControllerPane | null;
  getActivePaneState: () => PaneState | null;
  shellSync: FontRenderingControllerShellSync;
  initialState: {
    fontHintTarget: FontHintTarget;
    fontHinting: boolean;
    fontSizeDefault: number;
    ligatures: boolean;
  };
};

export function createPaneFontRenderingController(
  options: CreatePaneFontRenderingControllerOptions,
) {
  let selectedFontHintTarget = options.initialState.fontHintTarget;
  let selectedFontHinting = options.initialState.fontHinting;
  let selectedFontSizeDefault = options.initialState.fontSizeDefault;
  let selectedLigatures = options.initialState.ligatures;

  function getActiveContext() {
    const pane = options.getActivePane();
    const state = options.getActivePaneState();
    if (!pane || !state) return null;
    return { pane, state };
  }

  function syncFontSizeDefaultFromState(state: PaneState) {
    selectedFontSizeDefault = state.fontSize;
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
    applyFontHintTargetChange,
    applyFontHintingChange,
    applyFontRenderingSelections,
    applyFontSizeValue,
    applyLigaturesChange,
    getFontHintTarget: () => selectedFontHintTarget,
    getFontHinting: () => selectedFontHinting,
    getFontSizeDefault: () => selectedFontSizeDefault,
    getLigatures: () => selectedLigatures,
    syncFontSizeDefaultFromState,
  };
}

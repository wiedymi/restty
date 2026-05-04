import { type FontApplicationHost } from "./font-application.ts";
import type { FontHintTarget } from "./font-controls.ts";
import type { LocalFontOption } from "./font-local-picker.ts";
import {
  createPaneFontRenderingController,
  type FontRenderingControllerPane,
} from "./font-rendering-controller.ts";
import { createPaneFontSourceController } from "./font-source-controller.ts";
import type { PaneState } from "./pane-state.ts";

export type FontControllerPane = FontRenderingControllerPane;

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
  const sourceController = createPaneFontSourceController({
    host: options.host,
    shellSync: {
      syncFontFamilyValue: options.shellSync.syncFontFamilyValue,
      syncLocalFontControls: options.shellSync.syncLocalFontControls,
    },
    initialState: {
      detectedLocalFontOptions: options.initialState.detectedLocalFontOptions,
      fontFamily: options.initialState.fontFamily,
      localFontHintText: options.initialState.localFontHintText,
      localFontMatcher: options.initialState.localFontMatcher,
    },
    detectLocalFontState: options.detectLocalFontState,
  });
  const renderingController = createPaneFontRenderingController({
    host: options.host,
    getActivePane: options.getActivePane,
    getActivePaneState: options.getActivePaneState,
    shellSync: {
      syncFontRenderingControls: options.shellSync.syncFontRenderingControls,
    },
    initialState: {
      fontHintTarget: options.initialState.fontHintTarget,
      fontHinting: options.initialState.fontHinting,
      fontSizeDefault: options.initialState.fontSizeDefault,
      ligatures: options.initialState.ligatures,
    },
  });

  return {
    applyFontFamilySelection: sourceController.applyFontFamilySelection,
    applyFontHintTargetChange: renderingController.applyFontHintTargetChange,
    applyFontHintingChange: renderingController.applyFontHintingChange,
    applyFontRenderingSelections: renderingController.applyFontRenderingSelections,
    applyFontSizeValue: renderingController.applyFontSizeValue,
    applyLigaturesChange: renderingController.applyLigaturesChange,
    applyLocalFontSelection: sourceController.applyLocalFontSelection,
    getDetectedLocalFontOptions: sourceController.getDetectedLocalFontOptions,
    getFontFamily: sourceController.getFontFamily,
    getFontHintTarget: renderingController.getFontHintTarget,
    getFontHinting: renderingController.getFontHinting,
    getFontSizeDefault: renderingController.getFontSizeDefault,
    getFontSources: sourceController.getFontSources,
    getStartupFontSources: sourceController.getStartupFontSources,
    getLigatures: renderingController.getLigatures,
    getLocalFontHintText: sourceController.getLocalFontHintText,
    getLocalFontMatcher: sourceController.getLocalFontMatcher,
    loadLocalFonts: sourceController.loadLocalFonts,
    syncFontSizeDefaultFromState: renderingController.syncFontSizeDefaultFromState,
  };
}

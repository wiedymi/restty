import { type FontApplicationHost } from "./font-application.ts";
import type { FontHintTarget } from "./font-controls.ts";
import type { LocalFontOption } from "./font-local-picker.ts";
import { createPaneFontController, type FontControllerPane } from "./font-controller.ts";
import type { PaneState, RendererChoice } from "./pane-state.ts";
import { type PaneThemeTarget } from "./pane-theme.ts";
import { type ShaderPreset } from "./shader-presets.ts";
import {
  createPaneTerminalController,
  type TerminalControllerPane,
} from "./terminal-controller.ts";
import { createPaneThemeController } from "./theme-controller.ts";

export type AppearanceControllerPane = PaneThemeTarget & {
  runtime: PaneThemeTarget["runtime"] & {
    terminal: FontControllerPane["runtime"]["terminal"] &
      PaneThemeTarget["runtime"]["terminal"] &
      TerminalControllerPane["runtime"]["terminal"];
    interaction: TerminalControllerPane["runtime"]["interaction"];
  };
};

type PaneAppearanceShellSync = {
  syncFontFamilyValue: () => void;
  syncFontRenderingControls: () => void;
  syncLocalFontControls: () => void;
  syncMouseModeValue: (value: string) => void;
  syncShaderPresetValue: (value: ShaderPreset) => void;
  syncThemeSelectValue: (value: string) => void;
};

type CreatePaneAppearanceControllerOptions = {
  host: FontApplicationHost & Parameters<typeof createPaneThemeController>[0]["host"];
  getActivePane: () => AppearanceControllerPane | null;
  getActivePaneState: () => PaneState | null;
  getActivePaneId: () => number | null;
  setPaneState: (id: number, state: PaneState) => void;
  shellSync: PaneAppearanceShellSync;
  onThemeFileReset: () => void;
  initialState: {
    detectedLocalFontOptions: LocalFontOption[];
    fontFamily: string;
    fontHintTarget: FontHintTarget;
    fontHinting: boolean;
    fontSizeDefault: number;
    ligatures: boolean;
    localFontHintText: string;
    localFontMatcher: string;
    mouseModeDefault: string;
    rendererDefault: RendererChoice;
    shaderPreset: ShaderPreset;
  };
  detectLocalFontState?: Parameters<typeof createPaneFontController>[0]["detectLocalFontState"];
};

export function createPaneAppearanceController(options: CreatePaneAppearanceControllerOptions) {
  const fontController = createPaneFontController({
    host: options.host,
    getActivePane: options.getActivePane,
    getActivePaneState: options.getActivePaneState,
    shellSync: {
      syncFontFamilyValue: options.shellSync.syncFontFamilyValue,
      syncFontRenderingControls: options.shellSync.syncFontRenderingControls,
      syncLocalFontControls: options.shellSync.syncLocalFontControls,
    },
    initialState: {
      detectedLocalFontOptions: options.initialState.detectedLocalFontOptions,
      fontFamily: options.initialState.fontFamily,
      fontHintTarget: options.initialState.fontHintTarget,
      fontHinting: options.initialState.fontHinting,
      fontSizeDefault: options.initialState.fontSizeDefault,
      ligatures: options.initialState.ligatures,
      localFontHintText: options.initialState.localFontHintText,
      localFontMatcher: options.initialState.localFontMatcher,
    },
    detectLocalFontState: options.detectLocalFontState,
  });
  const terminalController = createPaneTerminalController({
    getActivePane: options.getActivePane,
    getActivePaneState: options.getActivePaneState,
    getActivePaneId: options.getActivePaneId,
    shellSync: {
      syncMouseModeValue: options.shellSync.syncMouseModeValue,
    },
    initialState: {
      mouseModeDefault: options.initialState.mouseModeDefault,
      rendererDefault: options.initialState.rendererDefault,
    },
  });
  const themeController = createPaneThemeController({
    host: options.host,
    getActivePane: options.getActivePane,
    getActivePaneState: options.getActivePaneState,
    getActivePaneId: options.getActivePaneId,
    setPaneState: options.setPaneState,
    shellSync: {
      syncShaderPresetValue: options.shellSync.syncShaderPresetValue,
      syncThemeSelectValue: options.shellSync.syncThemeSelectValue,
    },
    onThemeFileReset: options.onThemeFileReset,
    initialShaderPreset: options.initialState.shaderPreset,
  });

  function syncTerminalDefaultsFromState(state: PaneState) {
    terminalController.syncTerminalDefaultsFromState(state);
    fontController.syncFontSizeDefaultFromState(state);
  }

  return {
    applyCurrentShaderPreset: themeController.applyCurrentShaderPreset,
    applyFontFamilySelection: fontController.applyFontFamilySelection,
    applyFontHintTargetChange: fontController.applyFontHintTargetChange,
    applyFontHintingChange: fontController.applyFontHintingChange,
    applyFontRenderingSelections: fontController.applyFontRenderingSelections,
    applyFontSizeValue: fontController.applyFontSizeValue,
    applyLigaturesChange: fontController.applyLigaturesChange,
    applyLocalFontSelection: fontController.applyLocalFontSelection,
    applyMouseMode: terminalController.applyMouseMode,
    applyRendererChoice: terminalController.applyRendererChoice,
    applySelectedShaderPreset: themeController.applySelectedShaderPreset,
    applyThemeSelection: themeController.applyThemeSelection,
    applyUploadedThemeFile: themeController.applyUploadedThemeFile,
    getDetectedLocalFontOptions: fontController.getDetectedLocalFontOptions,
    getFontFamily: fontController.getFontFamily,
    getFontHintTarget: fontController.getFontHintTarget,
    getFontHinting: fontController.getFontHinting,
    getFontSizeDefault: fontController.getFontSizeDefault,
    getFontSources: fontController.getFontSources,
    getLigatures: fontController.getLigatures,
    getLocalFontHintText: fontController.getLocalFontHintText,
    getLocalFontMatcher: fontController.getLocalFontMatcher,
    getMouseModeDefault: terminalController.getMouseModeDefault,
    getRendererDefault: terminalController.getRendererDefault,
    getShaderPreset: themeController.getShaderPreset,
    loadLocalFonts: fontController.loadLocalFonts,
    syncTerminalDefaultsFromState,
  };
}

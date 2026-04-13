import { type FontApplicationHost } from "./font-application.ts";
import { type FontHintTarget, type LocalFontOption } from "./font-controls.ts";
import { createPaneFontController, type FontControllerPane } from "./font-controller.ts";
import type { PaneState, RendererChoice } from "./pane-state.ts";
import { type PaneThemeTarget } from "./pane-theme.ts";
import { type ShaderPreset } from "./shader-presets.ts";
import { createPaneThemeController } from "./theme-controller.ts";

export type AppearanceControllerPane = PaneThemeTarget & {
  runtime: PaneThemeTarget["runtime"] & {
    terminal: FontControllerPane["runtime"]["terminal"] &
      PaneThemeTarget["runtime"]["terminal"] & {
        setRenderer: (value: RendererChoice) => void;
      };
    interaction: {
      getMouseStatus: () => {
        mode: string;
      };
      setMouseMode: (value: string) => void;
    };
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
  let selectedMouseModeDefault = options.initialState.mouseModeDefault;
  let selectedRendererDefault = options.initialState.rendererDefault;
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

  function getActiveContext() {
    const pane = options.getActivePane();
    const state = options.getActivePaneState();
    if (!pane || !state) return null;
    return { pane, state };
  }

  function syncTerminalDefaultsFromState(state: PaneState) {
    selectedRendererDefault = state.renderer;
    fontController.syncFontSizeDefaultFromState(state);
    selectedMouseModeDefault = state.mouseMode;
  }

  function applyRendererChoice(value: string | null | undefined) {
    const active = getActiveContext();
    if (!active) return;
    if (value !== "auto" && value !== "webgpu" && value !== "webgl2") return;
    selectedRendererDefault = value;
    active.state.renderer = value;
    active.pane.runtime.terminal.setRenderer(value);
  }

  function applyMouseMode(value: string | null | undefined) {
    const active = getActiveContext();
    if (!active) return;
    selectedMouseModeDefault = value ?? "auto";
    active.pane.runtime.interaction.setMouseMode(selectedMouseModeDefault);
    active.state.mouseMode = active.pane.runtime.interaction.getMouseStatus().mode;
    if (active.pane.id === options.getActivePaneId()) {
      options.shellSync.syncMouseModeValue(active.state.mouseMode);
    }
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
    applyMouseMode,
    applyRendererChoice,
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
    getMouseModeDefault: () => selectedMouseModeDefault,
    getRendererDefault: () => selectedRendererDefault,
    getShaderPreset: themeController.getShaderPreset,
    loadLocalFonts: fontController.loadLocalFonts,
    syncTerminalDefaultsFromState,
  };
}

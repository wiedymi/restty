import { parseGhosttyTheme, type GhosttyTheme } from "../../src/index.ts";
import {
  applyFontRenderingOptionsToAllPanes,
  applyFontSourcesToAllPanes,
  type FontApplicationHost,
} from "./font-application.ts";
import {
  FONT_FAMILY_LOCAL_PREFIX,
  detectLocalFontState,
  getCurrentFontSources,
  resolveFontHintTarget,
  type FontHintTarget,
  type LocalFontOption,
} from "./font-controls.ts";
import type { PaneState, RendererChoice } from "./pane-state.ts";
import {
  applyBuiltinThemeToPane,
  applyThemeToPane,
  resetThemeForPane,
  type PaneThemeTarget,
} from "./pane-theme.ts";
import { shaderStagesForPreset, type ShaderPreset } from "./shader-presets.ts";

export type AppearanceControllerPane = PaneThemeTarget & {
  runtime: PaneThemeTarget["runtime"] & {
    terminal: PaneThemeTarget["runtime"]["terminal"] & {
      setFontSize: (value: number) => void;
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
  syncThemeSelectValue: (value: string) => void;
};

type CreatePaneAppearanceControllerOptions = {
  host: FontApplicationHost & {
    setShaderStages: (stages: ReturnType<typeof shaderStagesForPreset>) => void;
  };
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
  detectLocalFontState?: typeof detectLocalFontState;
  parseTheme?: (text: string) => GhosttyTheme;
};

export function createPaneAppearanceController(options: CreatePaneAppearanceControllerOptions) {
  const detectLocalFontStateImpl = options.detectLocalFontState ?? detectLocalFontState;
  const parseTheme = options.parseTheme ?? parseGhosttyTheme;
  const defaultFontFamily = options.initialState.fontFamily;

  let detectedLocalFontOptions = options.initialState.detectedLocalFontOptions;
  let selectedFontFamily = options.initialState.fontFamily;
  let selectedFontHintTarget = options.initialState.fontHintTarget;
  let selectedFontHinting = options.initialState.fontHinting;
  let selectedFontSizeDefault = options.initialState.fontSizeDefault;
  let selectedLigatures = options.initialState.ligatures;
  let localFontHintText = options.initialState.localFontHintText;
  let selectedLocalFontMatcher = options.initialState.localFontMatcher;
  let selectedMouseModeDefault = options.initialState.mouseModeDefault;
  let selectedRendererDefault = options.initialState.rendererDefault;
  let selectedShaderPreset = options.initialState.shaderPreset;

  function getActiveContext() {
    const pane = options.getActivePane();
    const state = options.getActivePaneState();
    if (!pane || !state) return null;
    return { pane, state };
  }

  function applyCurrentShaderPreset() {
    options.host.setShaderStages(shaderStagesForPreset(selectedShaderPreset));
  }

  function syncTerminalDefaultsFromState(state: PaneState) {
    selectedRendererDefault = state.renderer;
    selectedFontSizeDefault = state.fontSize;
    selectedMouseModeDefault = state.mouseMode;
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

  function applyRendererChoice(value: string | null | undefined) {
    const active = getActiveContext();
    if (!active) return;
    if (value !== "auto" && value !== "webgpu" && value !== "webgl2") return;
    selectedRendererDefault = value;
    active.state.renderer = value;
    active.pane.runtime.terminal.setRenderer(value);
  }

  async function applyUploadedThemeFile(file: File | null | undefined) {
    const active = getActiveContext();
    if (!active || !file) return;
    try {
      const text = await file.text();
      const theme = parseTheme(text);
      const nextState = applyThemeToPane({
        pane: active.pane,
        state: active.state,
        theme,
        sourceLabel: file.name || "theme file",
      });
      if (nextState) {
        options.setPaneState(active.pane.id, nextState);
        if (active.pane.id === options.getActivePaneId()) {
          options.shellSync.syncThemeSelectValue(nextState.theme.selectValue);
        }
      }
    } catch (err) {
      console.error("theme load failed", err);
    } finally {
      options.onThemeFileReset();
    }
  }

  function applyThemeSelection(name: string | null | undefined) {
    const active = getActiveContext();
    if (!active) return;
    if (!name) {
      const nextState = resetThemeForPane({
        pane: active.pane,
        state: active.state,
      });
      options.setPaneState(active.pane.id, nextState);
      if (active.pane.id === options.getActivePaneId()) {
        options.shellSync.syncThemeSelectValue("");
      }
      return;
    }
    const nextState = applyBuiltinThemeToPane({
      pane: active.pane,
      state: active.state,
      name,
    });
    if (!nextState) return;
    options.setPaneState(active.pane.id, nextState);
    if (active.pane.id === options.getActivePaneId()) {
      options.shellSync.syncThemeSelectValue(nextState.theme.selectValue);
    }
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

  function applySelectedShaderPreset(value: ShaderPreset | string | null | undefined) {
    if (
      value !== "none" &&
      value !== "scanline" &&
      value !== "aurora" &&
      value !== "crt-lite" &&
      value !== "mono-green"
    ) {
      selectedShaderPreset = "none";
    } else {
      selectedShaderPreset = value;
    }
    applyCurrentShaderPreset();
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
    applyCurrentShaderPreset,
    applyFontFamilySelection,
    applyFontHintTargetChange,
    applyFontHintingChange,
    applyFontRenderingSelections,
    applyFontSizeValue,
    applyLigaturesChange,
    applyLocalFontSelection,
    applyMouseMode,
    applyRendererChoice,
    applySelectedShaderPreset,
    applyThemeSelection,
    applyUploadedThemeFile,
    getDetectedLocalFontOptions: () => detectedLocalFontOptions,
    getFontFamily: () => selectedFontFamily,
    getFontHintTarget: () => selectedFontHintTarget,
    getFontHinting: () => selectedFontHinting,
    getFontSizeDefault: () => selectedFontSizeDefault,
    getFontSources: () => getCurrentFontSources(selectedFontFamily, selectedLocalFontMatcher),
    getLigatures: () => selectedLigatures,
    getLocalFontHintText: () => localFontHintText,
    getLocalFontMatcher: () => selectedLocalFontMatcher,
    getMouseModeDefault: () => selectedMouseModeDefault,
    getRendererDefault: () => selectedRendererDefault,
    loadLocalFonts,
    syncTerminalDefaultsFromState,
  };
}

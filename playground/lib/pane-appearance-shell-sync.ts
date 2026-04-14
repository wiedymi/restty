import {
  supportsLocalFontPicker,
  type FontHintTarget,
  type LocalFontOption,
} from "./font-controls.ts";
import { syncFontFamilyControls, syncHintingControls } from "./font-control-sync.ts";
import type { PaneShellSyncElements } from "./pane-shell-sync.types.ts";
import type { ShaderPreset } from "./shader-presets.ts";

type CreatePaneAppearanceShellSyncOptions = {
  elements: Pick<
    PaneShellSyncElements,
    | "themeSelect"
    | "fontFamilySelect"
    | "fontFamilyLocalSelect"
    | "btnLoadLocalFonts"
    | "fontFamilyHintEl"
    | "ligaturesSelect"
    | "fontHintingSelect"
    | "fontHintTargetSelect"
    | "mouseModeEl"
    | "shaderPresetEl"
  >;
  getSelectedFontFamily: () => string;
  getSelectedLocalFontMatcher: () => string;
  getDetectedLocalFontOptions: () => LocalFontOption[];
  getLocalFontHintText: () => string;
  getSelectedLigatures: () => boolean;
  getSelectedFontHinting: () => boolean;
  getSelectedFontHintTarget: () => FontHintTarget;
  getSelectedShaderPreset: () => ShaderPreset;
};

export function createPaneAppearanceShellSync(options: CreatePaneAppearanceShellSyncOptions) {
  function syncThemeSelectValue(value: string) {
    if (options.elements.themeSelect) {
      options.elements.themeSelect.value = value;
    }
  }

  function syncShaderPresetValue(value = options.getSelectedShaderPreset()) {
    if (options.elements.shaderPresetEl) {
      options.elements.shaderPresetEl.value = value;
    }
  }

  function syncMouseModeValue(value: string) {
    if (!options.elements.mouseModeEl) return;
    const hasOption = Array.from(options.elements.mouseModeEl.options).some(
      (option) => option.value === value,
    );
    options.elements.mouseModeEl.value = hasOption ? value : "auto";
  }

  function syncFontFamilyValue() {
    if (options.elements.fontFamilySelect) {
      options.elements.fontFamilySelect.value = options.getSelectedFontFamily();
    }
  }

  function syncLocalFontControls() {
    syncFontFamilyControls({
      fontFamilySelect: options.elements.fontFamilySelect,
      fontFamilyLocalSelect: options.elements.fontFamilyLocalSelect,
      btnLoadLocalFonts: options.elements.btnLoadLocalFonts,
      selectedFontFamily: options.getSelectedFontFamily(),
      selectedLocalFontMatcher: options.getSelectedLocalFontMatcher(),
      supportsLocalFontPicker: supportsLocalFontPicker(),
    });
    if (options.elements.fontFamilyHintEl) {
      options.elements.fontFamilyHintEl.textContent = options.getLocalFontHintText();
    }
  }

  function syncFontRenderingControls() {
    syncHintingControls({
      ligaturesSelect: options.elements.ligaturesSelect,
      fontHintingSelect: options.elements.fontHintingSelect,
      fontHintTargetSelect: options.elements.fontHintTargetSelect,
      selectedLigatures: options.getSelectedLigatures(),
      selectedFontHinting: options.getSelectedFontHinting(),
      selectedFontHintTarget: options.getSelectedFontHintTarget(),
    });
  }

  return {
    syncFontFamilyValue,
    syncFontRenderingControls,
    syncLocalFontControls,
    syncMouseModeValue,
    syncShaderPresetValue,
    syncThemeSelectValue,
  };
}

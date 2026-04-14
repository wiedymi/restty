import {
  getLocalFontSelectValue,
  supportsLocalFontPicker,
  type FontHintTarget,
  type LocalFontOption,
} from "./font-controls.ts";
import { syncFontFamilyControls, syncHintingControls } from "./font-control-sync.ts";
import type { PaneState } from "./pane-state.ts";
import type { PaneShellSyncElements } from "./pane-shell-sync.types.ts";
import { type ActivePaneStateDetail, type LocalFontStateDetail } from "./shell-events.ts";
import type { ShaderPreset } from "./shader-presets.ts";
import { dispatchActivePaneState } from "./shell-bridge.ts";

type AppearanceStateDetail = NonNullable<ActivePaneStateDetail["appearance"]>;

type CreatePaneAppearanceShellSyncOptions = {
  usesSvelteShell: boolean;
  target?: EventTarget;
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
  function buildLocalFontState(): LocalFontStateDetail {
    const supportsPicker = supportsLocalFontPicker();
    return {
      value: getLocalFontSelectValue(options.getSelectedLocalFontMatcher()),
      hintText: options.getLocalFontHintText(),
      loadDisabled: !supportsPicker,
      selectDisabled: !supportsPicker,
      options: [{ value: "", label: "Local Font: None" }, ...options.getDetectedLocalFontOptions()],
    };
  }

  function buildFontRenderingState() {
    return {
      ligatures: options.getSelectedLigatures() ? "on" : "off",
      fontHinting: options.getSelectedFontHinting() ? "on" : "off",
      fontHintTarget: options.getSelectedFontHintTarget(),
    } as const;
  }

  function buildAppearanceState(state: PaneState): AppearanceStateDetail {
    return {
      fontFamily: options.getSelectedFontFamily(),
      localFont: buildLocalFontState(),
      fontRendering: buildFontRenderingState(),
      mouseMode: state.mouseMode,
      shaderPreset: options.getSelectedShaderPreset(),
      themeSelectValue: state.theme.selectValue,
    };
  }

  function syncThemeSelectValue(value: string) {
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          appearance: {
            themeSelectValue: value,
          },
        },
        options.target,
      );
      return;
    }
    if (options.elements.themeSelect) {
      options.elements.themeSelect.value = value;
    }
  }

  function syncShaderPresetValue(value = options.getSelectedShaderPreset()) {
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          appearance: {
            shaderPreset: value,
          },
        },
        options.target,
      );
      return;
    }
    if (options.elements.shaderPresetEl) {
      options.elements.shaderPresetEl.value = value;
    }
  }

  function syncMouseModeValue(value: string) {
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          appearance: {
            mouseMode: value,
          },
        },
        options.target,
      );
      return;
    }
    if (!options.elements.mouseModeEl) return;
    const hasOption = Array.from(options.elements.mouseModeEl.options).some(
      (option) => option.value === value,
    );
    options.elements.mouseModeEl.value = hasOption ? value : "auto";
  }

  function syncFontFamilyValue() {
    const value = options.getSelectedFontFamily();
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          appearance: {
            fontFamily: value,
          },
        },
        options.target,
      );
      return;
    }
    if (options.elements.fontFamilySelect) {
      options.elements.fontFamilySelect.value = value;
    }
  }

  function syncFontFamilyControlState() {
    syncFontFamilyControls({
      fontFamilySelect: options.usesSvelteShell ? null : options.elements.fontFamilySelect,
      fontFamilyLocalSelect: options.usesSvelteShell
        ? null
        : options.elements.fontFamilyLocalSelect,
      btnLoadLocalFonts: options.usesSvelteShell ? null : options.elements.btnLoadLocalFonts,
      selectedFontFamily: options.getSelectedFontFamily(),
      selectedLocalFontMatcher: options.getSelectedLocalFontMatcher(),
      supportsLocalFontPicker: supportsLocalFontPicker(),
    });
  }

  function syncLocalFontControls() {
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          appearance: {
            localFont: buildLocalFontState(),
          },
        },
        options.target,
      );
      return;
    }
    syncFontFamilyControlState();
    if (options.elements.fontFamilyHintEl) {
      options.elements.fontFamilyHintEl.textContent = options.getLocalFontHintText();
    }
  }

  function syncFontRenderingControls() {
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          appearance: {
            fontRendering: buildFontRenderingState(),
          },
        },
        options.target,
      );
      return;
    }
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
    buildAppearanceState,
    syncFontFamilyValue,
    syncFontRenderingControls,
    syncLocalFontControls,
    syncMouseModeValue,
    syncShaderPresetValue,
    syncThemeSelectValue,
  };
}

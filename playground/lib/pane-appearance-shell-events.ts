import {
  getLocalFontSelectValue,
  supportsLocalFontPicker,
  type FontHintTarget,
  type LocalFontOption,
} from "./font-controls.ts";
import type { PaneState } from "./pane-state.ts";
import { dispatchActivePaneState } from "./shell-bridge.ts";
import { type ActivePaneStateDetail, type LocalFontStateDetail } from "./shell-events.ts";
import type { ShaderPreset } from "./shader-presets.ts";

type AppearanceStateDetail = NonNullable<ActivePaneStateDetail["appearance"]>;

type CreatePaneAppearanceShellEventsOptions = {
  target: EventTarget;
  getSelectedFontFamily: () => string;
  getSelectedLocalFontMatcher: () => string;
  getDetectedLocalFontOptions: () => LocalFontOption[];
  getLocalFontHintText: () => string;
  getSelectedLigatures: () => boolean;
  getSelectedFontHinting: () => boolean;
  getSelectedFontHintTarget: () => FontHintTarget;
  getSelectedShaderPreset: () => ShaderPreset;
};

export function createPaneAppearanceShellEvents(options: CreatePaneAppearanceShellEventsOptions) {
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
    dispatchActivePaneState(
      {
        appearance: {
          themeSelectValue: value,
        },
      },
      options.target,
    );
  }

  function syncShaderPresetValue(value = options.getSelectedShaderPreset()) {
    dispatchActivePaneState(
      {
        appearance: {
          shaderPreset: value,
        },
      },
      options.target,
    );
  }

  function syncMouseModeValue(value: string) {
    dispatchActivePaneState(
      {
        appearance: {
          mouseMode: value,
        },
      },
      options.target,
    );
  }

  function syncFontFamilyValue() {
    dispatchActivePaneState(
      {
        appearance: {
          fontFamily: options.getSelectedFontFamily(),
        },
      },
      options.target,
    );
  }

  function syncLocalFontControls() {
    dispatchActivePaneState(
      {
        appearance: {
          localFont: buildLocalFontState(),
        },
      },
      options.target,
    );
  }

  function syncFontRenderingControls() {
    dispatchActivePaneState(
      {
        appearance: {
          fontRendering: buildFontRenderingState(),
        },
      },
      options.target,
    );
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

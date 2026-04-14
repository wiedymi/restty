import type { FontHintTarget } from "./font-controls.ts";
import { getDefaultLocalFontHintText, type LocalFontOption } from "./font-local-picker.ts";
import { DEFAULT_FONT_FAMILY } from "./font-source-catalog.ts";
import {
  DEFAULT_FONT_HINT_TARGET,
  DEFAULT_FONT_HINTING,
  DEFAULT_LIGATURES,
  DEFAULT_MOUSE_MODE,
  DEFAULT_PTY_URL,
  DEFAULT_SHADER_PRESET,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_RENDERER,
  DEFAULT_THEME_NAME,
  DEFAULT_WEB_CONTAINER_COMMAND,
  DEFAULT_WEB_CONTAINER_CWD,
} from "./shell-defaults.ts";

export type PlaygroundAppearanceInitialState = {
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

export type PlaygroundStartupDefaults = {
  initialPtyUrl: string;
  initialWebContainerCommand: string;
  initialWebContainerCwd: string;
  initialFontSize: number;
  defaultThemeName: string;
  appearanceInitialState: PlaygroundAppearanceInitialState;
};

type ResolvePlaygroundStartupDefaultsOptions = {
  locationSearch?: string | null | undefined;
  localFontPickerSupported: boolean;
  builtinThemeNames: string[];
  preferredThemeName?: string;
};

function isTruthyQueryParam(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function isFalsyQueryParam(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "off";
}

function resolveFontHintTarget(value: string | null | undefined): FontHintTarget {
  return value === "light" || value === "normal" ? value : DEFAULT_FONT_HINT_TARGET;
}

export function resolvePlaygroundStartupDefaults({
  locationSearch,
  localFontPickerSupported,
  builtinThemeNames,
  preferredThemeName = DEFAULT_THEME_NAME,
}: ResolvePlaygroundStartupDefaultsOptions): PlaygroundStartupDefaults {
  const searchParams = locationSearch ? new URLSearchParams(locationSearch) : null;
  const initialShaderPreset = DEFAULT_SHADER_PRESET;
  const initialRendererDefault = DEFAULT_TERMINAL_RENDERER;
  const initialFontSizeDefault = DEFAULT_TERMINAL_FONT_SIZE;
  const initialMouseModeDefault = DEFAULT_MOUSE_MODE;
  const initialFontSize = DEFAULT_TERMINAL_FONT_SIZE;
  const initialFontFamily = DEFAULT_FONT_FAMILY;
  const initialLocalFontMatcher = "";
  const initialDetectedLocalFontOptions: LocalFontOption[] = [];
  const initialLocalFontHintText = getDefaultLocalFontHintText(localFontPickerSupported);
  const initialLigatures = isFalsyQueryParam(searchParams?.get("ligatures"))
    ? false
    : DEFAULT_LIGATURES;
  const initialFontHinting = isTruthyQueryParam(searchParams?.get("hinting"))
    ? true
    : DEFAULT_FONT_HINTING;
  const initialFontHintTarget = resolveFontHintTarget(searchParams?.get("hintTarget"));

  return {
    initialPtyUrl: DEFAULT_PTY_URL,
    initialWebContainerCommand: DEFAULT_WEB_CONTAINER_COMMAND,
    initialWebContainerCwd: DEFAULT_WEB_CONTAINER_CWD,
    initialFontSize,
    defaultThemeName: builtinThemeNames.includes(preferredThemeName) ? preferredThemeName : "",
    appearanceInitialState: {
      detectedLocalFontOptions: initialDetectedLocalFontOptions,
      fontFamily: initialFontFamily,
      fontHintTarget: initialFontHintTarget,
      fontHinting: initialFontHinting,
      fontSizeDefault: initialFontSizeDefault,
      ligatures: initialLigatures,
      localFontHintText: initialLocalFontHintText,
      localFontMatcher: initialLocalFontMatcher,
      mouseModeDefault: initialMouseModeDefault,
      rendererDefault: initialRendererDefault,
      shaderPreset: initialShaderPreset,
    },
  };
}

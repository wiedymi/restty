import { DEFAULT_FONT_FAMILY, type FontHintTarget } from "./font-controls.ts";
import { getDefaultLocalFontHintText, type LocalFontOption } from "./font-local-picker.ts";
import type { RendererChoice } from "./pane-state.ts";
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
import type { ShaderPreset } from "./shader-presets.ts";

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
  shaderPresetValue: string | null | undefined;
  ptyUrlValue: string | null | undefined;
  webContainerCommandValue: string | null | undefined;
  webContainerCwdValue: string | null | undefined;
  rendererValue: string | null | undefined;
  fontSizeValue: string | null | undefined;
  mouseModeValue: string | null | undefined;
  fontFamilyValue: string | null | undefined;
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

function isRendererChoice(value: string | null | undefined): value is RendererChoice {
  return value === "auto" || value === "webgpu" || value === "webgl2";
}

function isShaderPreset(value: string | null | undefined): value is ShaderPreset {
  return (
    value === "none" ||
    value === "scanline" ||
    value === "aurora" ||
    value === "crt-lite" ||
    value === "mono-green"
  );
}

function parseFontSize(value: string | null | undefined, fallback = DEFAULT_TERMINAL_FONT_SIZE) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveFontHintTarget(value: string | null | undefined): FontHintTarget {
  return value === "light" || value === "normal" ? value : DEFAULT_FONT_HINT_TARGET;
}

export function resolvePlaygroundStartupDefaults({
  shaderPresetValue,
  ptyUrlValue,
  webContainerCommandValue,
  webContainerCwdValue,
  rendererValue,
  fontSizeValue,
  mouseModeValue,
  fontFamilyValue,
  locationSearch,
  localFontPickerSupported,
  builtinThemeNames,
  preferredThemeName = DEFAULT_THEME_NAME,
}: ResolvePlaygroundStartupDefaultsOptions): PlaygroundStartupDefaults {
  const searchParams = locationSearch ? new URLSearchParams(locationSearch) : null;
  const initialShaderPreset = isShaderPreset(shaderPresetValue)
    ? shaderPresetValue
    : DEFAULT_SHADER_PRESET;
  const initialRendererDefault = isRendererChoice(rendererValue)
    ? rendererValue
    : DEFAULT_TERMINAL_RENDERER;
  const initialFontSizeDefault = parseFontSize(fontSizeValue, DEFAULT_TERMINAL_FONT_SIZE);
  const initialMouseModeDefault = mouseModeValue || DEFAULT_MOUSE_MODE;
  const initialFontSize = fontSizeValue ? Number(fontSizeValue) : DEFAULT_TERMINAL_FONT_SIZE;
  const initialFontFamily = fontFamilyValue ?? DEFAULT_FONT_FAMILY;
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
    initialPtyUrl: ptyUrlValue ?? DEFAULT_PTY_URL,
    initialWebContainerCommand: webContainerCommandValue?.trim() || DEFAULT_WEB_CONTAINER_COMMAND,
    initialWebContainerCwd: webContainerCwdValue?.trim() || DEFAULT_WEB_CONTAINER_CWD,
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

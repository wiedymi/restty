import {
  DEFAULT_FONT_FAMILY,
  getDefaultLocalFontHintText,
  type FontHintTarget,
  type LocalFontOption,
} from "./font-controls.ts";
import type { RendererChoice } from "./pane-state.ts";
import type { ShaderPreset } from "./shader-presets.ts";

const DEFAULT_FONT_SIZE = 18;
const DEFAULT_PTY_URL = "ws://localhost:8787/pty";
const DEFAULT_WEB_CONTAINER_COMMAND = "jsh";
const DEFAULT_WEB_CONTAINER_CWD = "/";

export type PlaygroundStartupDefaults = {
  initialShaderPreset: ShaderPreset;
  initialPtyUrl: string;
  initialWebContainerCommand: string;
  initialWebContainerCwd: string;
  initialRendererDefault: RendererChoice;
  initialFontSizeDefault: number;
  initialMouseModeDefault: string;
  initialFontSize: number;
  initialFontFamily: string;
  initialLocalFontMatcher: string;
  initialDetectedLocalFontOptions: LocalFontOption[];
  initialLocalFontHintText: string;
  initialLigatures: boolean;
  initialFontHinting: boolean;
  initialFontHintTarget: FontHintTarget;
};

type ResolvePlaygroundStartupDefaultsOptions = {
  usesSvelteShell: boolean;
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

function parseFontSize(value: string | null | undefined, fallback = DEFAULT_FONT_SIZE) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveFontHintTarget(value: string | null | undefined): FontHintTarget {
  return value === "light" || value === "normal" ? value : "auto";
}

export function resolvePlaygroundStartupDefaults({
  usesSvelteShell,
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
}: ResolvePlaygroundStartupDefaultsOptions): PlaygroundStartupDefaults {
  const searchParams = locationSearch ? new URLSearchParams(locationSearch) : null;
  const initialFontSize = fontSizeValue ? Number(fontSizeValue) : DEFAULT_FONT_SIZE;

  return {
    initialShaderPreset:
      usesSvelteShell || !isShaderPreset(shaderPresetValue) ? "none" : shaderPresetValue,
    initialPtyUrl: ptyUrlValue ?? DEFAULT_PTY_URL,
    initialWebContainerCommand: webContainerCommandValue?.trim() || DEFAULT_WEB_CONTAINER_COMMAND,
    initialWebContainerCwd: webContainerCwdValue?.trim() || DEFAULT_WEB_CONTAINER_CWD,
    initialRendererDefault: isRendererChoice(rendererValue) ? rendererValue : "auto",
    initialFontSizeDefault: parseFontSize(fontSizeValue),
    initialMouseModeDefault: mouseModeValue || "auto",
    initialFontSize,
    initialFontFamily: fontFamilyValue ?? DEFAULT_FONT_FAMILY,
    initialLocalFontMatcher: "",
    initialDetectedLocalFontOptions: [],
    initialLocalFontHintText: getDefaultLocalFontHintText(localFontPickerSupported),
    initialLigatures: !isFalsyQueryParam(searchParams?.get("ligatures")),
    initialFontHinting: isTruthyQueryParam(searchParams?.get("hinting")),
    initialFontHintTarget: resolveFontHintTarget(searchParams?.get("hintTarget")),
  };
}

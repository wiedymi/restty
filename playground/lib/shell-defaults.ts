import { DEFAULT_FONT_FAMILY } from "./font-source-catalog.ts";
import { getDefaultLocalFontHintText, supportsLocalFontPicker } from "./font-local-picker.ts";
import type { PlaygroundDemoKind } from "./demos.ts";
import type { RendererChoice } from "./pane-state.ts";
import type { ConnectionBackend } from "./connection-state.ts";
import type { ShaderPreset } from "./shader-presets.ts";

export const DEFAULT_TERMINAL_RENDERER: RendererChoice = "auto";
export const DEFAULT_TERMINAL_FONT_SIZE = 18;

export const DEFAULT_CONNECTION_BACKEND: ConnectionBackend = "just-bash";
export const DEFAULT_PTY_URL = "ws://localhost:8787/pty";
export const DEFAULT_JUST_BASH_COMMAND = "jsh";
export const DEFAULT_WEB_CONTAINER_COMMAND = "jsh";
export const DEFAULT_WEB_CONTAINER_CWD = "/";

export const DEFAULT_MOUSE_MODE = "auto";
export const DEFAULT_SHADER_PRESET: ShaderPreset = "none";
export const DEFAULT_THEME_NAME = "Aizen Dark";
export const DEFAULT_LIGATURES = true;
export const DEFAULT_FONT_HINTING = false;
export const DEFAULT_FONT_HINT_TARGET = "auto";

export const DEFAULT_DEMO_KIND: PlaygroundDemoKind = "basic";

export function createInitialConnectionShellValues() {
  return {
    backend: DEFAULT_CONNECTION_BACKEND,
    ptyUrl: DEFAULT_PTY_URL,
    webContainerCommand: DEFAULT_WEB_CONTAINER_COMMAND,
    webContainerCwd: DEFAULT_WEB_CONTAINER_CWD,
  };
}

export function createInitialAppearanceShellValues(
  localFontPickerSupported = supportsLocalFontPicker(),
) {
  return {
    mouseMode: DEFAULT_MOUSE_MODE,
    fontFamily: DEFAULT_FONT_FAMILY,
    localFontHintText: getDefaultLocalFontHintText(localFontPickerSupported),
    localFontOptions: [{ value: "", label: "Local Font: None" }],
    localFontSelectDisabled: false,
    localFontValue: "",
    loadLocalFontsDisabled: false,
    ligatures: DEFAULT_LIGATURES ? "on" : "off",
    fontHinting: DEFAULT_FONT_HINTING ? "on" : "off",
    fontHintTarget: DEFAULT_FONT_HINT_TARGET,
    shaderPreset: DEFAULT_SHADER_PRESET,
    themeSelectValue: "",
  };
}

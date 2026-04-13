import type { PlaygroundDemoKind } from "./demos.ts";
import type { RendererChoice } from "./pane-state.ts";
import type { ShaderPreset } from "./shader-presets.ts";

export const SETTINGS_OPEN_EVENT = "restty:playground-settings-open";
export const SETTINGS_CLOSE_EVENT = "restty:playground-settings-close";
export const RUN_DEMO_EVENT = "restty:playground-demo-run";
export const FONT_FAMILY_LOCAL_CHANGE_EVENT = "restty:playground-font-family-local-change";
export const FONT_FAMILY_CHANGE_EVENT = "restty:playground-font-family-change";
export const FONT_FAMILY_STATE_EVENT = "restty:playground-font-family-state";
export const FONT_LIGATURES_CHANGE_EVENT = "restty:playground-font-ligatures-change";
export const FONT_HINTING_CHANGE_EVENT = "restty:playground-font-hinting-change";
export const FONT_HINT_TARGET_CHANGE_EVENT = "restty:playground-font-hint-target-change";
export const FONT_RENDERING_STATE_EVENT = "restty:playground-font-rendering-state";
export const LOAD_LOCAL_FONTS_EVENT = "restty:playground-load-local-fonts";
export const THEME_FILE_CHANGE_EVENT = "restty:playground-theme-file-change";
export const MOUSE_MODE_CHANGE_EVENT = "restty:playground-mouse-mode-change";
export const MOUSE_MODE_STATE_EVENT = "restty:playground-mouse-mode-state";
export const THEME_SELECT_CHANGE_EVENT = "restty:playground-theme-select-change";
export const THEME_SELECT_STATE_EVENT = "restty:playground-theme-select-state";
export const SHADER_PRESET_CHANGE_EVENT = "restty:playground-shader-preset-change";
export const TERMINAL_INIT_EVENT = "restty:playground-terminal-init";
export const TERMINAL_PAUSE_EVENT = "restty:playground-terminal-pause";
export const TERMINAL_CLEAR_EVENT = "restty:playground-terminal-clear";
export const TERMINAL_FONT_SIZE_EVENT = "restty:playground-terminal-font-size-change";
export const TERMINAL_RENDERER_EVENT = "restty:playground-terminal-renderer-change";
export const TERMINAL_STATE_EVENT = "restty:playground-terminal-state";
export const PTY_BUTTON_EVENT = "restty:playground-pty-button";
export const PTY_BUTTON_STATE_EVENT = "restty:playground-pty-button-state";

export type ShellStringValueDetail = {
  value?: string;
};

export type DemoRunDetail = {
  kind?: PlaygroundDemoKind | string;
};

export type FontRenderingStateDetail = {
  ligatures?: string;
  fontHinting?: string;
  fontHintTarget?: string;
};

export type PtyButtonStateDetail = {
  label?: string;
};

export type RendererChangeDetail = {
  value?: RendererChoice | string;
};

export type ShaderPresetChangeDetail = {
  value?: ShaderPreset | string;
};

export type TerminalStateDetail = {
  pauseLabel?: string;
  renderer?: string;
  fontSize?: number | string;
};

export type ThemeFileChangeDetail = {
  file?: File | null;
};

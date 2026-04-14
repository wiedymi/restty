import type { PlaygroundDemoKind } from "./demos.ts";
import type { LocalFontOption } from "./font-controls.ts";
import type { RendererChoice } from "./pane-state.ts";
import type { ConnectionBackend } from "./pty-connection.ts";
import type { ShaderPreset } from "./shader-presets.ts";

export const SETTINGS_OPEN_EVENT = "restty:playground-settings-open";
export const SETTINGS_CLOSE_EVENT = "restty:playground-settings-close";
export const CONNECTION_BACKEND_CHANGE_EVENT = "restty:playground-connection-backend-change";
export const CONNECTION_STATE_EVENT = "restty:playground-connection-state";
export const ACTIVE_PANE_STATE_EVENT = "restty:playground-active-pane-state";
export const RUN_DEMO_EVENT = "restty:playground-demo-run";
export const FONT_FAMILY_LOCAL_CHANGE_EVENT = "restty:playground-font-family-local-change";
export const FONT_FAMILY_CHANGE_EVENT = "restty:playground-font-family-change";
export const FONT_LIGATURES_CHANGE_EVENT = "restty:playground-font-ligatures-change";
export const FONT_HINTING_CHANGE_EVENT = "restty:playground-font-hinting-change";
export const FONT_HINT_TARGET_CHANGE_EVENT = "restty:playground-font-hint-target-change";
export const LOAD_LOCAL_FONTS_EVENT = "restty:playground-load-local-fonts";
export const PTY_URL_CHANGE_EVENT = "restty:playground-pty-url-change";
export const THEME_FILE_CHANGE_EVENT = "restty:playground-theme-file-change";
export const THEME_FILE_RESET_EVENT = "restty:playground-theme-file-reset";
export const MOUSE_MODE_CHANGE_EVENT = "restty:playground-mouse-mode-change";
export const THEME_SELECT_CHANGE_EVENT = "restty:playground-theme-select-change";
export const WC_COMMAND_CHANGE_EVENT = "restty:playground-webcontainer-command-change";
export const WC_CWD_CHANGE_EVENT = "restty:playground-webcontainer-cwd-change";
export const SHADER_PRESET_CHANGE_EVENT = "restty:playground-shader-preset-change";
export const TERMINAL_ACTION_EVENT = "restty:playground-terminal-action";
export const PTY_BUTTON_EVENT = "restty:playground-pty-button";

export type ShellStringValueDetail = {
  value?: string;
};

export type DemoRunDetail = {
  kind?: PlaygroundDemoKind | string;
};

export type ConnectionStateDetail = {
  backend?: ConnectionBackend | string;
  ptyUrl?: string;
  ptyButtonLabel?: string;
  webContainerCommand?: string;
  webContainerCwd?: string;
};

export type ActivePaneAppearanceStateDetail = {
  fontFamily?: string;
  localFont?: LocalFontStateDetail;
  fontRendering?: FontRenderingStateDetail;
  mouseMode?: string;
  shaderPreset?: string;
  themeSelectValue?: string;
};

export type ActivePaneStateDetail = {
  terminal?: TerminalStateDetail;
  appearance?: ActivePaneAppearanceStateDetail;
};

export type FontRenderingStateDetail = {
  ligatures?: string;
  fontHinting?: string;
  fontHintTarget?: string;
};

export type LocalFontStateDetail = {
  value?: string;
  hintText?: string;
  selectDisabled?: boolean;
  loadDisabled?: boolean;
  options?: LocalFontOption[];
};

export type RendererChangeDetail = {
  value?: RendererChoice | string;
};

export type TerminalActionDetail = {
  command?: "init" | "pause" | "clear";
  renderer?: RendererChoice | string;
  fontSize?: number | string;
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

import type { PlaygroundDemoKind } from "./demos.ts";
import type { LocalFontOption } from "./font-local-picker.ts";
import type { RendererChoice } from "./pane-state.ts";
import type { ConnectionBackend } from "./pty-connection.ts";
import type { ShaderPreset } from "./shader-presets.ts";

export const CONNECTION_INPUT_EVENT = "restty:playground-connection-input";
export const CONNECTION_STATE_EVENT = "restty:playground-connection-state";
export const ACTIVE_PANE_STATE_EVENT = "restty:playground-active-pane-state";
export const APPEARANCE_INPUT_EVENT = "restty:playground-appearance-input";
export const THEME_FILE_RESET_EVENT = "restty:playground-theme-file-reset";
export const TERMINAL_ACTION_EVENT = "restty:playground-terminal-action";
export const SHELL_COMMAND_EVENT = "restty:playground-shell-command";

export type DemoRunDetail = {
  kind?: PlaygroundDemoKind | string;
};

export type ShellCommandDetail = {
  command?: "settings-open" | "settings-close" | "pty-button" | "run-demo";
  demoKind?: PlaygroundDemoKind | string;
};

export type ConnectionInputDetail = {
  backend?: ConnectionBackend | string;
  ptyUrl?: string;
  webContainerCommand?: string;
  webContainerCwd?: string;
};

export type AppearanceInputDetail = {
  action?: "load-local-fonts";
  fontFamily?: string;
  localFontValue?: string;
  ligatures?: string;
  fontHinting?: string;
  fontHintTarget?: string;
  mouseMode?: string;
  shaderPreset?: ShaderPreset | string;
  themeSelectValue?: string;
  themeFile?: File | null;
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

export type TerminalActionDetail = {
  command?: "init" | "pause" | "clear";
  renderer?: RendererChoice | string;
  fontSize?: number | string;
};

export type TerminalStateDetail = {
  pauseLabel?: string;
  renderer?: string;
  fontSize?: number | string;
};

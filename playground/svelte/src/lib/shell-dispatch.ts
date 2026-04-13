import type { PlaygroundDemoKind } from "../../../lib/demos.ts";
import type { ShaderPreset } from "../../../lib/shader-presets.ts";
import {
  CONNECTION_BACKEND_CHANGE_EVENT,
  FONT_FAMILY_LOCAL_CHANGE_EVENT,
  FONT_FAMILY_CHANGE_EVENT,
  FONT_HINT_TARGET_CHANGE_EVENT,
  FONT_HINTING_CHANGE_EVENT,
  FONT_LIGATURES_CHANGE_EVENT,
  LOAD_LOCAL_FONTS_EVENT,
  MOUSE_MODE_CHANGE_EVENT,
  PTY_BUTTON_EVENT,
  PTY_URL_CHANGE_EVENT,
  RUN_DEMO_EVENT,
  SETTINGS_CLOSE_EVENT,
  SETTINGS_OPEN_EVENT,
  SHADER_PRESET_CHANGE_EVENT,
  TERMINAL_CLEAR_EVENT,
  TERMINAL_FONT_SIZE_EVENT,
  TERMINAL_INIT_EVENT,
  TERMINAL_PAUSE_EVENT,
  TERMINAL_RENDERER_EVENT,
  THEME_FILE_CHANGE_EVENT,
  THEME_SELECT_CHANGE_EVENT,
  WC_COMMAND_CHANGE_EVENT,
  WC_CWD_CHANGE_EVENT,
} from "../../../lib/shell-events.ts";

function dispatchShellEvent<T>(type: string, detail?: T, target: EventTarget = window) {
  target.dispatchEvent(
    detail === undefined ? new CustomEvent(type) : new CustomEvent(type, { detail }),
  );
}

export function dispatchSettingsOpen(target: EventTarget = window) {
  dispatchShellEvent(SETTINGS_OPEN_EVENT, undefined, target);
}

export function dispatchSettingsClose(target: EventTarget = window) {
  dispatchShellEvent(SETTINGS_CLOSE_EVENT, undefined, target);
}

export function dispatchDemoRun(kind: PlaygroundDemoKind | string, target: EventTarget = window) {
  dispatchShellEvent(RUN_DEMO_EVENT, { kind }, target);
}

export function dispatchConnectionBackendChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(CONNECTION_BACKEND_CHANGE_EVENT, { value }, target);
}

export function dispatchTerminalInit(target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_INIT_EVENT, undefined, target);
}

export function dispatchTerminalPause(target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_PAUSE_EVENT, undefined, target);
}

export function dispatchTerminalClear(target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_CLEAR_EVENT, undefined, target);
}

export function dispatchTerminalFontSizeChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_FONT_SIZE_EVENT, { value }, target);
}

export function dispatchTerminalRendererChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_RENDERER_EVENT, { value }, target);
}

export function dispatchPtyButton(target: EventTarget = window) {
  dispatchShellEvent(PTY_BUTTON_EVENT, undefined, target);
}

export function dispatchPtyUrlChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(PTY_URL_CHANGE_EVENT, { value }, target);
}

export function dispatchFontFamilyChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(FONT_FAMILY_CHANGE_EVENT, { value }, target);
}

export function dispatchLocalFontFamilyChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(FONT_FAMILY_LOCAL_CHANGE_EVENT, { value }, target);
}

export function dispatchLigaturesChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(FONT_LIGATURES_CHANGE_EVENT, { value }, target);
}

export function dispatchHintingChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(FONT_HINTING_CHANGE_EVENT, { value }, target);
}

export function dispatchHintTargetChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(FONT_HINT_TARGET_CHANGE_EVENT, { value }, target);
}

export function dispatchLoadLocalFonts(target: EventTarget = window) {
  dispatchShellEvent(LOAD_LOCAL_FONTS_EVENT, undefined, target);
}

export function dispatchMouseModeChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(MOUSE_MODE_CHANGE_EVENT, { value }, target);
}

export function dispatchThemeSelectChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(THEME_SELECT_CHANGE_EVENT, { value }, target);
}

export function dispatchThemeFileChange(file: File | null, target: EventTarget = window) {
  dispatchShellEvent(THEME_FILE_CHANGE_EVENT, { file }, target);
}

export function dispatchWebContainerCommandChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(WC_COMMAND_CHANGE_EVENT, { value }, target);
}

export function dispatchWebContainerCwdChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(WC_CWD_CHANGE_EVENT, { value }, target);
}

export function dispatchShaderPresetChange(
  value: ShaderPreset | string,
  target: EventTarget = window,
) {
  dispatchShellEvent(SHADER_PRESET_CHANGE_EVENT, { value }, target);
}

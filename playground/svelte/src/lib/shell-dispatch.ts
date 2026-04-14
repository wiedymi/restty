import type { PlaygroundDemoKind } from "../../../lib/demos.ts";
import { dispatchShellEvent } from "../../../lib/shell-bridge.ts";
import type { ShaderPreset } from "../../../lib/shader-presets.ts";
import {
  APPEARANCE_INPUT_EVENT,
  CONNECTION_INPUT_EVENT,
  PTY_BUTTON_EVENT,
  RUN_DEMO_EVENT,
  SETTINGS_CLOSE_EVENT,
  SETTINGS_OPEN_EVENT,
  TERMINAL_ACTION_EVENT,
} from "../../../lib/shell-events.ts";

export function dispatchSettingsOpen(target: EventTarget = window) {
  dispatchShellEvent(SETTINGS_OPEN_EVENT, undefined, target);
}

export function dispatchSettingsClose(target: EventTarget = window) {
  dispatchShellEvent(SETTINGS_CLOSE_EVENT, undefined, target);
}

export function dispatchDemoRun(kind: PlaygroundDemoKind | string, target: EventTarget = window) {
  dispatchShellEvent(RUN_DEMO_EVENT, { kind }, target);
}

export function dispatchConnectionInput(
  detail: {
    backend?: string;
    ptyUrl?: string;
    webContainerCommand?: string;
    webContainerCwd?: string;
  },
  target: EventTarget = window,
) {
  dispatchShellEvent(CONNECTION_INPUT_EVENT, detail, target);
}

export function dispatchConnectionBackendChange(value: string, target: EventTarget = window) {
  dispatchConnectionInput({ backend: value }, target);
}

export function dispatchAppearanceInput(
  detail: {
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
  },
  target: EventTarget = window,
) {
  dispatchShellEvent(APPEARANCE_INPUT_EVENT, detail, target);
}

export function dispatchTerminalInit(target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_ACTION_EVENT, { command: "init" }, target);
}

export function dispatchTerminalPause(target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_ACTION_EVENT, { command: "pause" }, target);
}

export function dispatchTerminalClear(target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_ACTION_EVENT, { command: "clear" }, target);
}

export function dispatchTerminalFontSizeChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_ACTION_EVENT, { fontSize: value }, target);
}

export function dispatchTerminalRendererChange(value: string, target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_ACTION_EVENT, { renderer: value }, target);
}

export function dispatchPtyButton(target: EventTarget = window) {
  dispatchShellEvent(PTY_BUTTON_EVENT, undefined, target);
}

export function dispatchPtyUrlChange(value: string, target: EventTarget = window) {
  dispatchConnectionInput({ ptyUrl: value }, target);
}

export function dispatchFontFamilyChange(value: string, target: EventTarget = window) {
  dispatchAppearanceInput({ fontFamily: value }, target);
}

export function dispatchLocalFontFamilyChange(value: string, target: EventTarget = window) {
  dispatchAppearanceInput({ localFontValue: value }, target);
}

export function dispatchLigaturesChange(value: string, target: EventTarget = window) {
  dispatchAppearanceInput({ ligatures: value }, target);
}

export function dispatchHintingChange(value: string, target: EventTarget = window) {
  dispatchAppearanceInput({ fontHinting: value }, target);
}

export function dispatchHintTargetChange(value: string, target: EventTarget = window) {
  dispatchAppearanceInput({ fontHintTarget: value }, target);
}

export function dispatchLoadLocalFonts(target: EventTarget = window) {
  dispatchAppearanceInput({ action: "load-local-fonts" }, target);
}

export function dispatchMouseModeChange(value: string, target: EventTarget = window) {
  dispatchAppearanceInput({ mouseMode: value }, target);
}

export function dispatchThemeSelectChange(value: string, target: EventTarget = window) {
  dispatchAppearanceInput({ themeSelectValue: value }, target);
}

export function dispatchThemeFileChange(file: File | null, target: EventTarget = window) {
  dispatchAppearanceInput({ themeFile: file }, target);
}

export function dispatchWebContainerCommandChange(value: string, target: EventTarget = window) {
  dispatchConnectionInput({ webContainerCommand: value }, target);
}

export function dispatchWebContainerCwdChange(value: string, target: EventTarget = window) {
  dispatchConnectionInput({ webContainerCwd: value }, target);
}

export function dispatchShaderPresetChange(
  value: ShaderPreset | string,
  target: EventTarget = window,
) {
  dispatchAppearanceInput({ shaderPreset: value }, target);
}

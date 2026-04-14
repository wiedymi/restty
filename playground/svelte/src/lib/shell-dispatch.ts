import type { PlaygroundDemoKind } from "../../../lib/demos.ts";
import {
  dispatchAppearanceInput as emitAppearanceInput,
  dispatchConnectionInput as emitConnectionInput,
  dispatchShellCommand as emitShellCommand,
  dispatchTerminalAction as emitTerminalAction,
} from "../../../lib/shell-bridge.ts";
import type { ShaderPreset } from "../../../lib/shader-presets.ts";

export function dispatchShellCommand(
  detail: {
    command?: "settings-open" | "settings-close" | "pty-button" | "run-demo";
    demoKind?: PlaygroundDemoKind | string;
  },
  target: EventTarget = window,
) {
  emitShellCommand(detail, target);
}

export function dispatchSettingsOpen(target: EventTarget = window) {
  dispatchShellCommand({ command: "settings-open" }, target);
}

export function dispatchSettingsClose(target: EventTarget = window) {
  dispatchShellCommand({ command: "settings-close" }, target);
}

export function dispatchDemoRun(kind: PlaygroundDemoKind | string, target: EventTarget = window) {
  dispatchShellCommand({ command: "run-demo", demoKind: kind }, target);
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
  emitConnectionInput(detail, target);
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
  emitAppearanceInput(detail, target);
}

export function dispatchTerminalInit(target: EventTarget = window) {
  emitTerminalAction({ command: "init" }, target);
}

export function dispatchTerminalPause(target: EventTarget = window) {
  emitTerminalAction({ command: "pause" }, target);
}

export function dispatchTerminalClear(target: EventTarget = window) {
  emitTerminalAction({ command: "clear" }, target);
}

export function dispatchTerminalFontSizeChange(value: string, target: EventTarget = window) {
  emitTerminalAction({ fontSize: value }, target);
}

export function dispatchTerminalRendererChange(value: string, target: EventTarget = window) {
  emitTerminalAction({ renderer: value }, target);
}

export function dispatchPtyButton(target: EventTarget = window) {
  dispatchShellCommand({ command: "pty-button" }, target);
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

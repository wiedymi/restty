import { expect, test } from "bun:test";
import {
  bindAppearanceShellEffects,
  bindConnectionShellEffects,
  bindTerminalShellEffects,
} from "../playground/lib/control-shell-effects.ts";
import {
  dispatchAppearanceInput as emitAppearanceInput,
  dispatchConnectionInput as emitConnectionInput,
  dispatchShellCommand as emitShellCommand,
  dispatchTerminalAction as emitTerminalAction,
} from "../playground/lib/shell-bridge.ts";
import { bindSettingsShellEffects } from "../playground/lib/settings-shell-effects.ts";

test("control bindings forward svelte shell events", () => {
  const target = new EventTarget();
  const calls: Array<[string, unknown]> = [];

  bindConnectionShellEffects({
    target,
    onBackendChange: (value) => calls.push(["backend", value]),
    onPtyUrlChange: (value) => calls.push(["pty-url", value]),
    onWebContainerCommandChange: (value) => calls.push(["wc-command", value]),
    onWebContainerCwdChange: (value) => calls.push(["wc-cwd", value]),
  });

  bindTerminalShellEffects({
    target,
    onClear: () => calls.push(["clear", null]),
    onDemoRun: (kind) => calls.push(["demo", kind]),
    onFontSizeChange: (value) => calls.push(["font-size", value]),
    onInit: () => calls.push(["init", null]),
    onPauseToggle: () => calls.push(["pause", null]),
    onPtyButton: () => calls.push(["pty-button", null]),
    onRendererChange: (value) => calls.push(["renderer", value]),
  });

  bindAppearanceShellEffects({
    target,
    onFontFamilyChange: (value) => calls.push(["font-family", value]),
    onFontFamilyLocalChange: (value) => calls.push(["font-family-local", value]),
    onFontHintTargetChange: (value) => calls.push(["font-hint-target", value]),
    onFontHintingChange: (value) => calls.push(["font-hinting", value]),
    onLigaturesChange: (value) => calls.push(["ligatures", value]),
    onLoadLocalFonts: () => calls.push(["load-local-fonts", null]),
    onMouseModeChange: (value) => calls.push(["mouse-mode", value]),
    onShaderPresetChange: (value) => calls.push(["shader", value]),
    onThemeFileChange: () => calls.push(["theme-file", null]),
    onThemeSelectChange: (value) => calls.push(["theme-select", value]),
  });

  emitConnectionInput({ backend: "webcontainer" }, target);
  emitConnectionInput({ ptyUrl: "ws://x" }, target);
  emitConnectionInput({ webContainerCommand: "bash" }, target);
  emitConnectionInput({ webContainerCwd: "/tmp" }, target);
  emitTerminalAction({ command: "init" }, target);
  emitTerminalAction({ command: "pause" }, target);
  emitTerminalAction({ command: "clear" }, target);
  emitShellCommand({ command: "run-demo", demoKind: "unicode" }, target);
  emitTerminalAction({ renderer: "webgpu" }, target);
  emitTerminalAction({ fontSize: "24" }, target);
  emitAppearanceInput({ themeSelectValue: "Aizen Dark" }, target);
  emitAppearanceInput({ fontFamily: "jetbrains" }, target);
  emitAppearanceInput({ fontHinting: "on" }, target);

  expect(calls).toEqual([
    ["backend", "webcontainer"],
    ["pty-url", "ws://x"],
    ["wc-command", "bash"],
    ["wc-cwd", "/tmp"],
    ["init", null],
    ["pause", null],
    ["clear", null],
    ["demo", "unicode"],
    ["renderer", "webgpu"],
    ["font-size", "24"],
    ["theme-select", "Aizen Dark"],
    ["font-family", "jetbrains"],
    ["font-hinting", "on"],
  ]);
});

test("settings shell effects forward shell commands", () => {
  const svelteCalls: string[] = [];
  const svelteTarget = new EventTarget();

  bindSettingsShellEffects({
    target: svelteTarget as Window & EventTarget,
    onOpen: () => svelteCalls.push("open"),
    onClose: () => svelteCalls.push("close"),
  });

  emitShellCommand({ command: "settings-open" }, svelteTarget);
  emitShellCommand({ command: "settings-close" }, svelteTarget);

  expect(svelteCalls).toEqual(["open", "close"]);
});

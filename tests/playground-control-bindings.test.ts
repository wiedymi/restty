import { expect, test } from "bun:test";
import {
  bindAppearanceControls,
  bindConnectionControls,
  bindTerminalControls,
} from "../playground/lib/control-bindings.ts";
import { bindSettingsControls } from "../playground/lib/settings-bindings.ts";
import {
  APPEARANCE_INPUT_EVENT,
  CONNECTION_INPUT_EVENT,
  SHELL_COMMAND_EVENT,
  TERMINAL_ACTION_EVENT,
} from "../playground/lib/shell-events.ts";

function createMutableTarget<T extends object>(initial: T): EventTarget & T {
  return Object.assign(new EventTarget(), initial);
}

test("control bindings forward svelte shell events", () => {
  const target = new EventTarget();
  const calls: Array<[string, unknown]> = [];

  bindConnectionControls({
    usesSvelteShell: true,
    target,
    connectionBackendEl: null,
    ptyUrlInput: null,
    wcCommandInput: null,
    wcCwdInput: null,
    onBackendChange: (value) => calls.push(["backend", value]),
    onPtyUrlChange: (value) => calls.push(["pty-url", value]),
    onWebContainerCommandChange: (value) => calls.push(["wc-command", value]),
    onWebContainerCwdChange: (value) => calls.push(["wc-cwd", value]),
  });

  bindTerminalControls({
    usesSvelteShell: true,
    target,
    btnClear: null,
    btnInit: null,
    btnPause: null,
    btnPty: null,
    btnRunDemo: null,
    demoSelect: null,
    fontSizeInput: null,
    rendererSelect: null,
    onClear: () => calls.push(["clear", null]),
    onDemoRun: (kind) => calls.push(["demo", kind]),
    onFontSizeChange: (value) => calls.push(["font-size", value]),
    onInit: () => calls.push(["init", null]),
    onPauseToggle: () => calls.push(["pause", null]),
    onPtyButton: () => calls.push(["pty-button", null]),
    onRendererChange: (value) => calls.push(["renderer", value]),
  });

  bindAppearanceControls({
    usesSvelteShell: true,
    target,
    btnLoadLocalFonts: null,
    fontFamilyLocalSelect: null,
    fontFamilySelect: null,
    fontHintTargetSelect: null,
    fontHintingSelect: null,
    ligaturesSelect: null,
    mouseModeEl: null,
    shaderPresetEl: null,
    themeFileInput: null,
    themeSelect: null,
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

  target.dispatchEvent(
    new CustomEvent(CONNECTION_INPUT_EVENT, { detail: { backend: "webcontainer" } }),
  );
  target.dispatchEvent(new CustomEvent(CONNECTION_INPUT_EVENT, { detail: { ptyUrl: "ws://x" } }));
  target.dispatchEvent(
    new CustomEvent(CONNECTION_INPUT_EVENT, { detail: { webContainerCommand: "bash" } }),
  );
  target.dispatchEvent(
    new CustomEvent(CONNECTION_INPUT_EVENT, { detail: { webContainerCwd: "/tmp" } }),
  );
  target.dispatchEvent(new CustomEvent(TERMINAL_ACTION_EVENT, { detail: { command: "init" } }));
  target.dispatchEvent(new CustomEvent(TERMINAL_ACTION_EVENT, { detail: { command: "pause" } }));
  target.dispatchEvent(new CustomEvent(TERMINAL_ACTION_EVENT, { detail: { command: "clear" } }));
  target.dispatchEvent(
    new CustomEvent(SHELL_COMMAND_EVENT, { detail: { command: "run-demo", demoKind: "unicode" } }),
  );
  target.dispatchEvent(new CustomEvent(TERMINAL_ACTION_EVENT, { detail: { renderer: "webgpu" } }));
  target.dispatchEvent(new CustomEvent(TERMINAL_ACTION_EVENT, { detail: { fontSize: "24" } }));
  target.dispatchEvent(
    new CustomEvent(APPEARANCE_INPUT_EVENT, { detail: { themeSelectValue: "Aizen Dark" } }),
  );
  target.dispatchEvent(
    new CustomEvent(APPEARANCE_INPUT_EVENT, { detail: { fontFamily: "jetbrains" } }),
  );
  target.dispatchEvent(new CustomEvent(APPEARANCE_INPUT_EVENT, { detail: { fontHinting: "on" } }));

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

test("control bindings read legacy control values", () => {
  const calls: Array<[string, unknown]> = [];
  const connectionBackendEl = createMutableTarget({ value: "webcontainer" });
  const ptyUrlInput = createMutableTarget({ value: "ws://legacy" });
  const wcCommandInput = createMutableTarget({ value: "bash" });
  const wcCwdInput = createMutableTarget({ value: "/tmp" });
  const rendererSelect = createMutableTarget({ value: "webgl2" });
  const fontSizeInput = createMutableTarget({ value: "22" });
  const demoSelect = createMutableTarget({ value: "unicode" });
  const btnRunDemo = createMutableTarget({});
  const themeSelect = createMutableTarget({ value: "Aizen Dark" });
  const fontFamilySelect = createMutableTarget({ value: "jetbrains" });
  const fontHintingSelect = createMutableTarget({ value: "on" });

  bindConnectionControls({
    usesSvelteShell: false,
    target: new EventTarget(),
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
    onBackendChange: (value) => calls.push(["backend", value]),
    onPtyUrlChange: (value) => calls.push(["pty-url", value]),
    onWebContainerCommandChange: (value) => calls.push(["wc-command", value]),
    onWebContainerCwdChange: (value) => calls.push(["wc-cwd", value]),
  });

  bindTerminalControls({
    usesSvelteShell: false,
    target: new EventTarget(),
    btnClear: createMutableTarget({}),
    btnInit: createMutableTarget({}),
    btnPause: createMutableTarget({}),
    btnPty: createMutableTarget({}),
    btnRunDemo,
    demoSelect,
    fontSizeInput,
    rendererSelect,
    onClear: () => {},
    onDemoRun: (kind) => calls.push(["demo", kind]),
    onFontSizeChange: (value) => calls.push(["font-size", value]),
    onInit: () => {},
    onPauseToggle: () => {},
    onPtyButton: () => {},
    onRendererChange: (value) => calls.push(["renderer", value]),
  });

  bindAppearanceControls({
    usesSvelteShell: false,
    target: new EventTarget(),
    btnLoadLocalFonts: createMutableTarget({}),
    fontFamilyLocalSelect: createMutableTarget({ value: "local:fira%20code" }),
    fontFamilySelect,
    fontHintTargetSelect: createMutableTarget({ value: "light" }),
    fontHintingSelect,
    ligaturesSelect: createMutableTarget({ value: "off" }),
    mouseModeEl: createMutableTarget({ value: "drag" }),
    shaderPresetEl: createMutableTarget({ value: "aurora" }),
    themeFileInput: createMutableTarget({ files: [{ name: "theme.conf" }] }),
    themeSelect,
    onFontFamilyChange: (value) => calls.push(["font-family", value]),
    onFontFamilyLocalChange: (value) => calls.push(["font-family-local", value]),
    onFontHintTargetChange: (value) => calls.push(["font-hint-target", value]),
    onFontHintingChange: (value) => calls.push(["font-hinting", value]),
    onLigaturesChange: (value) => calls.push(["ligatures", value]),
    onLoadLocalFonts: () => calls.push(["load-local-fonts", null]),
    onMouseModeChange: (value) => calls.push(["mouse-mode", value]),
    onShaderPresetChange: (value) => calls.push(["shader", value]),
    onThemeFileChange: (file) => calls.push(["theme-file", (file as File | undefined)?.name]),
    onThemeSelectChange: (value) => calls.push(["theme-select", value]),
  });

  connectionBackendEl.dispatchEvent(new Event("change"));
  rendererSelect.dispatchEvent(new Event("change"));
  fontSizeInput.dispatchEvent(new Event("input"));
  btnRunDemo.dispatchEvent(new Event("click"));
  themeSelect.dispatchEvent(new Event("change"));
  fontFamilySelect.dispatchEvent(new Event("change"));
  fontHintingSelect.dispatchEvent(new Event("change"));

  expect(calls).toEqual([
    ["pty-url", "ws://legacy"],
    ["wc-command", "bash"],
    ["wc-cwd", "/tmp"],
    ["backend", "webcontainer"],
    ["renderer", "webgl2"],
    ["font-size", "22"],
    ["demo", "unicode"],
    ["theme-select", "Aizen Dark"],
    ["font-family", "jetbrains"],
    ["font-hinting", "on"],
  ]);
});

test("settings bindings wire svelte and legacy controls", () => {
  const svelteCalls: string[] = [];
  const svelteTarget = new EventTarget();

  bindSettingsControls({
    usesSvelteShell: true,
    target: svelteTarget as Window & EventTarget,
    settingsDialog: null,
    settingsFab: null,
    settingsClose: null,
    onOpen: () => svelteCalls.push("open"),
    onClose: () => svelteCalls.push("close"),
  });

  svelteTarget.dispatchEvent(
    new CustomEvent(SHELL_COMMAND_EVENT, { detail: { command: "settings-open" } }),
  );
  svelteTarget.dispatchEvent(
    new CustomEvent(SHELL_COMMAND_EVENT, { detail: { command: "settings-close" } }),
  );

  expect(svelteCalls).toEqual(["open", "close"]);

  const legacyCalls: string[] = [];
  const legacyTarget = new EventTarget();
  const settingsFab = createMutableTarget({});
  const settingsClose = createMutableTarget({});
  const settingsDialog = createMutableTarget({ open: true }) as HTMLDialogElement & EventTarget;

  bindSettingsControls({
    usesSvelteShell: false,
    target: legacyTarget as Window & EventTarget,
    settingsDialog,
    settingsFab,
    settingsClose,
    onOpen: () => legacyCalls.push("open"),
    onClose: () => legacyCalls.push("close"),
  });

  settingsFab.dispatchEvent(new Event("click"));
  settingsClose.dispatchEvent(new Event("click"));
  settingsDialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  legacyTarget.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));

  expect(legacyCalls).toEqual(["open", "close", "close", "close"]);
});

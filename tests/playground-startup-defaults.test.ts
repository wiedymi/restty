import { expect, test } from "bun:test";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_LOCAL_FONT_HINT,
  UNSUPPORTED_LOCAL_FONT_HINT,
} from "../playground/lib/font-controls.ts";
import { resolvePlaygroundStartupDefaults } from "../playground/lib/startup-defaults.ts";

test("resolvePlaygroundStartupDefaults honors shell defaults and query params", () => {
  const startup = resolvePlaygroundStartupDefaults({
    usesSvelteShell: true,
    shaderPresetValue: "crt-lite",
    ptyUrlValue: undefined,
    webContainerCommandValue: "  jsh  ",
    webContainerCwdValue: "/workspace",
    rendererValue: "webgpu",
    fontSizeValue: "20",
    mouseModeValue: "sgr",
    fontFamilyValue: undefined,
    locationSearch: "?ligatures=off&hinting=on&hintTarget=normal",
    localFontPickerSupported: false,
  });

  expect(startup).toMatchObject({
    initialShaderPreset: "none",
    initialPtyUrl: "ws://localhost:8787/pty",
    initialWebContainerCommand: "jsh",
    initialWebContainerCwd: "/workspace",
    initialRendererDefault: "webgpu",
    initialFontSizeDefault: 20,
    initialMouseModeDefault: "sgr",
    initialFontSize: 20,
    initialFontFamily: DEFAULT_FONT_FAMILY,
    initialLocalFontMatcher: "",
    initialLocalFontHintText: UNSUPPORTED_LOCAL_FONT_HINT,
    initialLigatures: false,
    initialFontHinting: true,
    initialFontHintTarget: "normal",
  });
  expect(startup.initialDetectedLocalFontOptions).toEqual([]);
});

test("resolvePlaygroundStartupDefaults falls back for invalid control values", () => {
  const startup = resolvePlaygroundStartupDefaults({
    usesSvelteShell: false,
    shaderPresetValue: "weird",
    ptyUrlValue: null,
    webContainerCommandValue: "   ",
    webContainerCwdValue: "   ",
    rendererValue: "canvas",
    fontSizeValue: "abc",
    mouseModeValue: "",
    fontFamilyValue: "jetbrains",
    locationSearch: "?hinting=0&hintTarget=weird",
    localFontPickerSupported: true,
  });

  expect(startup).toMatchObject({
    initialShaderPreset: "none",
    initialPtyUrl: "ws://localhost:8787/pty",
    initialWebContainerCommand: "jsh",
    initialWebContainerCwd: "/",
    initialRendererDefault: "auto",
    initialFontSizeDefault: 18,
    initialMouseModeDefault: "auto",
    initialFontFamily: "jetbrains",
    initialLocalFontHintText: DEFAULT_LOCAL_FONT_HINT,
    initialLigatures: true,
    initialFontHinting: false,
    initialFontHintTarget: "auto",
  });
  expect(Number.isNaN(startup.initialFontSize)).toBe(true);
});

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
    builtinThemeNames: ["Aizen Dark", "GitHub Dark"],
  });

  expect(startup).toMatchObject({
    initialPtyUrl: "ws://localhost:8787/pty",
    initialWebContainerCommand: "jsh",
    initialWebContainerCwd: "/workspace",
    initialFontSize: 20,
    defaultThemeName: "Aizen Dark",
    appearanceInitialState: {
      shaderPreset: "none",
      rendererDefault: "webgpu",
      fontSizeDefault: 20,
      mouseModeDefault: "sgr",
      fontFamily: DEFAULT_FONT_FAMILY,
      localFontMatcher: "",
      localFontHintText: UNSUPPORTED_LOCAL_FONT_HINT,
      ligatures: false,
      fontHinting: true,
      fontHintTarget: "normal",
    },
  });
  expect(startup.appearanceInitialState.detectedLocalFontOptions).toEqual([]);
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
    builtinThemeNames: ["GitHub Dark"],
  });

  expect(startup).toMatchObject({
    initialPtyUrl: "ws://localhost:8787/pty",
    initialWebContainerCommand: "jsh",
    initialWebContainerCwd: "/",
    defaultThemeName: "",
    appearanceInitialState: {
      shaderPreset: "none",
      rendererDefault: "auto",
      fontSizeDefault: 18,
      mouseModeDefault: "auto",
      fontFamily: "jetbrains",
      localFontHintText: DEFAULT_LOCAL_FONT_HINT,
      ligatures: true,
      fontHinting: false,
      fontHintTarget: "auto",
    },
  });
  expect(Number.isNaN(startup.initialFontSize)).toBe(true);
});

import { expect, test } from "bun:test";
import { DEFAULT_FONT_FAMILY } from "../playground/lib/font-catalog.ts";
import {
  DEFAULT_LOCAL_FONT_HINT,
  UNSUPPORTED_LOCAL_FONT_HINT,
} from "../playground/lib/font-local-picker.ts";
import {
  DEFAULT_PTY_URL,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_THEME_NAME,
  DEFAULT_WEB_CONTAINER_COMMAND,
} from "../playground/lib/shell-defaults.ts";
import { resolvePlaygroundStartupDefaults } from "../playground/lib/startup-defaults.ts";

test("resolvePlaygroundStartupDefaults honors shell defaults and query params", () => {
  const startup = resolvePlaygroundStartupDefaults({
    locationSearch: "?ligatures=off&hinting=on&hintTarget=normal",
    localFontPickerSupported: false,
    builtinThemeNames: ["Aizen Dark", "GitHub Dark"],
  });

  expect(startup).toMatchObject({
    initialPtyUrl: DEFAULT_PTY_URL,
    initialWebContainerCommand: DEFAULT_WEB_CONTAINER_COMMAND,
    initialWebContainerCwd: "/",
    initialFontSize: DEFAULT_TERMINAL_FONT_SIZE,
    defaultThemeName: DEFAULT_THEME_NAME,
    appearanceInitialState: {
      shaderPreset: "none",
      rendererDefault: "auto",
      fontSizeDefault: DEFAULT_TERMINAL_FONT_SIZE,
      mouseModeDefault: "auto",
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

test("resolvePlaygroundStartupDefaults falls back when the preferred theme is unavailable", () => {
  const startup = resolvePlaygroundStartupDefaults({
    locationSearch: "?hinting=0&hintTarget=weird",
    localFontPickerSupported: true,
    builtinThemeNames: ["GitHub Dark"],
  });

  expect(startup).toMatchObject({
    initialPtyUrl: DEFAULT_PTY_URL,
    initialWebContainerCommand: DEFAULT_WEB_CONTAINER_COMMAND,
    initialWebContainerCwd: "/",
    defaultThemeName: "",
    appearanceInitialState: {
      shaderPreset: "none",
      rendererDefault: "auto",
      fontSizeDefault: DEFAULT_TERMINAL_FONT_SIZE,
      mouseModeDefault: "auto",
      fontFamily: DEFAULT_FONT_FAMILY,
      localFontHintText: DEFAULT_LOCAL_FONT_HINT,
      ligatures: true,
      fontHinting: false,
      fontHintTarget: "auto",
    },
  });
  expect(startup.initialFontSize).toBe(DEFAULT_TERMINAL_FONT_SIZE);
});

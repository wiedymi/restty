import { expect, test } from "bun:test";
import {
  buildFontsForPreset,
  DEFAULT_FONT_PRESET,
  FONT_PRESETS,
  SYMBOL_FALLBACK_FONTS,
} from "../playground/app/lib/restty/fonts.ts";
import {
  createBasicDemoPayload,
  createPaletteDemoPayload,
  createUnicodeDemoPayload,
} from "../playground/app/lib/restty/demos.ts";
import { shaderStagesForPreset } from "../playground/app/lib/restty/shader-presets.ts";

test("playground fonts use simple bundled paths with optional local family first", () => {
  expect(FONT_PRESETS.map((preset) => preset.id)).toEqual(["fira-code", "jetbrains-mono"]);
  expect(DEFAULT_FONT_PRESET).toBe("jetbrains-mono");

  const defaultFonts = buildFontsForPreset(DEFAULT_FONT_PRESET, "");
  expect(defaultFonts[0]).toMatchObject({
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Regular",
    fallback: {
      url: expect.stringContaining("JetBrainsMonoNLNerdFontMono-Regular.ttf"),
    },
  });
  expect(
    defaultFonts.some(
      (font) =>
        typeof font === "object" &&
        font !== null &&
        "path" in font &&
        font.path === "/fonts/OpenMoji-black-glyf.ttf",
    ),
  ).toBe(true);
  expect(
    defaultFonts.some(
      (font) =>
        typeof font === "object" &&
        font !== null &&
        "url" in font &&
        String(font.url).includes("ttf-symbola"),
    ),
  ).toBe(true);

  const customFonts = buildFontsForPreset("jetbrains-mono", "Berkeley Mono");
  expect(customFonts[0]).toEqual({ family: "Berkeley Mono", local: "require" });
  expect(customFonts[1]).toMatchObject({
    family: "JetBrains Mono Nerd Font",
    name: "JetBrains Mono Nerd Font Regular",
  });

  const fallbackLabels = SYMBOL_FALLBACK_FONTS.map((font) =>
    typeof font === "object" && font !== null && "name" in font ? font.name : "",
  );
  expect(fallbackLabels).toEqual([
    "Symbols Nerd Font Mono",
    "Symbols Nerd Font Mono",
    "Apple Symbols",
    "Noto Sans Symbols 2",
    "Symbola",
    "Noto Sans Canadian Aboriginal",
    "Apple Color Emoji",
    "Noto Color Emoji",
    "OpenMoji",
    "Noto Sans CJK",
  ]);
});

test("playground shader presets expose named restty stages", () => {
  expect(shaderStagesForPreset("none")).toEqual([]);
  expect(shaderStagesForPreset("scanline")[0]?.id).toBe("playground/scanline");
  expect(shaderStagesForPreset("aurora")[0]?.id).toBe("playground/aurora");
  expect(shaderStagesForPreset("crt-lite")[0]?.id).toBe("playground/crt-lite");
  expect(shaderStagesForPreset("mono-green")[0]?.id).toBe("playground/mono-green");
});

test("playground demo payloads remain static terminal input", () => {
  expect(createBasicDemoPayload()).toContain("restty demo: basics");
  expect(createPaletteDemoPayload()).toContain("Base 16:");
  expect(createUnicodeDemoPayload()).toContain("Braille:");
});

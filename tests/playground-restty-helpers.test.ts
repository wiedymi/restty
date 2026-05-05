import { expect, test } from "bun:test";
import {
  buildFontsForPreset,
  DEFAULT_FONT_PRESET,
  FONT_PRESETS,
} from "../playground/app/lib/restty/fonts.ts";
import {
  createBasicDemoPayload,
  createPaletteDemoPayload,
  createUnicodeDemoPayload,
} from "../playground/app/lib/restty/demos.ts";
import { shaderStagesForPreset } from "../playground/app/lib/restty/shader-presets.ts";

test("playground fonts use simple bundled paths with optional local family first", () => {
  expect(FONT_PRESETS.map((preset) => preset.id)).toEqual(["fira-code", "jetbrains-mono"]);
  expect(buildFontsForPreset(DEFAULT_FONT_PRESET, "")).toEqual([
    {
      family: "Fira Code",
      local: "prefer",
      fallback: { path: "/fonts/FiraCode-Regular.ttf", name: "Fira Code Regular" },
    },
  ]);
  expect(buildFontsForPreset("jetbrains-mono", "Berkeley Mono")).toEqual([
    { family: "Berkeley Mono", local: "require" },
    {
      family: "JetBrains Mono",
      local: "prefer",
      fallback: {
        path: "/fonts/JetBrainsMono-Regular.ttf",
        name: "JetBrains Mono Regular",
      },
    },
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

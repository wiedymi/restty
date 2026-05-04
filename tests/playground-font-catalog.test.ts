import { expect, test } from "bun:test";
import {
  buildFontsForSelection,
  buildStartupFontsForSelection,
} from "../playground/lib/font-catalog.ts";

test("buildFontsForSelection keeps explicit local font first and preset fonts ahead of fallbacks", () => {
  const fonts = buildFontsForSelection("fira-code", "fira code retina");

  expect(fonts[0]).toEqual({
    family: "fira code retina",
    local: "require",
  });
  expect(fonts[1]).toMatchObject({
    family: "Fira Code",
    name: "Fira Code Regular",
    weight: 400,
  });
  expect(fonts[4]).toMatchObject({
    family: "Fira Code",
    name: "Fira Code Bold Italic",
    weight: 700,
    style: "italic",
  });
  expect(fonts[5]).toMatchObject({
    path: "/fonts/FiraCode-Regular.ttf",
    name: "Fira Code Regular",
  });
  expect(
    fonts.some(
      (font) =>
        typeof font === "object" &&
        font !== null &&
        "name" in font &&
        font.name === "JetBrains Mono Regular",
    ),
  ).toBe(true);
  expect(fonts.at(-1)).toMatchObject({
    url: expect.stringContaining("NotoSansCJKsc-Regular.otf"),
    name: "Noto Sans CJK SC",
  });
});

test("buildStartupFontsForSelection keeps startup font loading local and bundled", () => {
  const fonts = buildStartupFontsForSelection("fira-code", "");

  expect(fonts).toEqual([
    {
      path: "/fonts/FiraCode-Regular.ttf",
      name: "Fira Code Regular",
    },
  ]);
});

test("buildStartupFontsForSelection preserves explicit local selection before bundled face", () => {
  const fonts = buildStartupFontsForSelection("jetbrains", "jetbrains mono");

  expect(fonts).toEqual([
    {
      family: "jetbrains mono",
      local: "require",
    },
    {
      path: "/fonts/JetBrainsMono-Regular.ttf",
      name: "JetBrains Mono Regular",
    },
  ]);
});

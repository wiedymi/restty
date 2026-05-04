import { expect, test } from "bun:test";
import {
  applyFontRenderingOptionsToAllPanes,
  applyFontsToAllPanes,
  type FontApplicationHost,
} from "../playground/lib/font-application.ts";

test("applyFontsToAllPanes sends computed fonts once", async () => {
  const calls: unknown[] = [];
  const host: FontApplicationHost = {
    setFonts: async (fonts) => {
      calls.push(fonts);
    },
    forEachPane: () => {},
  };

  await applyFontsToAllPanes({
    host,
    selectedFontFamily: "fira-code",
    selectedLocalFontMatcher: "my font",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        family: "my font",
        local: "require",
      }),
      expect.objectContaining({
        path: "/fonts/FiraCode-Regular.ttf",
        name: "Fira Code Regular",
      }),
    ]),
  );
});

test("applyFontsToAllPanes reports failures through onError", async () => {
  const error = new Error("boom");
  const seen: unknown[] = [];
  const host: FontApplicationHost = {
    setFonts: async () => {
      throw error;
    },
    forEachPane: () => {},
  };

  await applyFontsToAllPanes({
    host,
    selectedFontFamily: "fira-code",
    selectedLocalFontMatcher: "",
    onError: (value) => {
      seen.push(value);
    },
  });

  expect(seen).toEqual([error]);
});

test("applyFontRenderingOptionsToAllPanes applies ligatures and hinting to each pane", () => {
  const paneCalls: string[] = [];
  const createPane = (label: string) => ({
    setLigatures: (value: boolean) => {
      paneCalls.push(`${label}:ligatures:${value}`);
    },
    setFontHintTarget: (value: "auto" | "light" | "normal") => {
      paneCalls.push(`${label}:target:${value}`);
    },
    setFontHinting: (value: boolean) => {
      paneCalls.push(`${label}:hinting:${value}`);
    },
  });
  const panes = [createPane("a"), createPane("b")];

  const host: FontApplicationHost = {
    setFonts: async () => {},
    forEachPane: (visitor) => {
      for (const pane of panes) visitor(pane);
    },
  };

  applyFontRenderingOptionsToAllPanes({
    host,
    selectedLigatures: true,
    selectedFontHinting: false,
    selectedFontHintTarget: "normal",
  });

  expect(paneCalls).toEqual([
    "a:ligatures:true",
    "a:target:normal",
    "a:hinting:false",
    "b:ligatures:true",
    "b:target:normal",
    "b:hinting:false",
  ]);
});

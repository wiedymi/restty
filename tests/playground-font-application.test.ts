import { expect, test } from "bun:test";
import {
  applyFontRenderingOptionsToAllPanes,
  applyFontSourcesToAllPanes,
  type FontApplicationHost,
} from "../playground/lib/font-application.ts";

test("applyFontSourcesToAllPanes sends computed sources once", async () => {
  const calls: unknown[] = [];
  const host: FontApplicationHost = {
    setFontSources: async (sources) => {
      calls.push(sources);
    },
    getPanes: () => [],
  };

  await applyFontSourcesToAllPanes({
    host,
    selectedFontFamily: "fira-code",
    selectedLocalFontMatcher: "my font",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "local",
        label: "local:my font",
      }),
      expect.objectContaining({
        type: "url",
        label: "Fira Code Regular",
      }),
    ]),
  );
});

test("applyFontSourcesToAllPanes reports failures through onError", async () => {
  const error = new Error("boom");
  const seen: unknown[] = [];
  const host: FontApplicationHost = {
    setFontSources: async () => {
      throw error;
    },
    getPanes: () => [],
  };

  await applyFontSourcesToAllPanes({
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
    runtime: {
      terminal: {
        setLigatures: (value: boolean) => {
          paneCalls.push(`${label}:ligatures:${value}`);
        },
        setFontHintTarget: (value: "auto" | "light" | "normal") => {
          paneCalls.push(`${label}:target:${value}`);
        },
        setFontHinting: (value: boolean) => {
          paneCalls.push(`${label}:hinting:${value}`);
        },
      },
    },
  });

  const host: FontApplicationHost = {
    setFontSources: async () => {},
    getPanes: () => [createPane("a"), createPane("b")],
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

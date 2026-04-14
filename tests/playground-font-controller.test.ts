import { expect, test } from "bun:test";
import { createPaneFontController } from "../playground/lib/font-controller.ts";
import type { PaneState } from "../playground/lib/pane-state.ts";

function createState(overrides: Partial<PaneState> = {}): PaneState {
  return {
    id: overrides.id ?? 1,
    renderer: overrides.renderer ?? "auto",
    fontSize: overrides.fontSize ?? 18,
    mouseMode: overrides.mouseMode ?? "auto",
    paused: overrides.paused ?? false,
    theme: overrides.theme ?? {
      selectValue: "",
      sourceLabel: "",
      theme: null,
    },
    demos: overrides.demos ?? null,
  };
}

function createPane(id = 1) {
  const calls: string[] = [];
  const pane = {
    id,
    setFontSize: (value: number) => {
      calls.push(`font-size:${value}`);
    },
    setFontHintTarget: (value: string) => {
      calls.push(`hint-target:${value}`);
    },
    setFontHinting: (value: boolean) => {
      calls.push(`hinting:${value}`);
    },
    setLigatures: (value: boolean) => {
      calls.push(`ligatures:${value}`);
    },
  };
  return { pane, calls };
}

function createShellSyncCalls() {
  const calls: string[] = [];
  return {
    calls,
    shellSync: {
      syncFontFamilyValue: () => {
        calls.push("sync-font-family");
      },
      syncFontRenderingControls: () => {
        calls.push("sync-font-rendering");
      },
      syncLocalFontControls: () => {
        calls.push("sync-local-fonts");
      },
    },
  };
}

test("font controller updates font size, font sources, and local font state", async () => {
  const { pane, calls: paneCalls } = createPane(9);
  const paneStates = new Map<number, PaneState>([[9, createState({ id: 9 })]]);
  const { calls: syncCalls, shellSync } = createShellSyncCalls();
  const fontSourceLabels: string[][] = [];

  const controller = createPaneFontController({
    host: {
      forEachPane: (visitor) => {
        visitor(pane);
      },
      setFontSources: async (sources) => {
        fontSourceLabels.push(sources.map((source) => source.label));
      },
    },
    getActivePane: () => pane,
    getActivePaneState: () => paneStates.get(9) ?? null,
    shellSync,
    initialState: {
      detectedLocalFontOptions: [],
      fontFamily: "fira-code",
      fontHintTarget: "auto",
      fontHinting: false,
      fontSizeDefault: 18,
      ligatures: true,
      localFontHintText: "hint",
      localFontMatcher: "",
    },
    detectLocalFontState: async () => ({
      detectedOptions: [{ value: "local:fira%20code", label: "Local Font: Fira Code" }],
      hintText: "Detected 1 local font families.",
    }),
  });

  controller.applyFontSizeValue("24");
  await controller.applyFontFamilySelection("jetbrains");
  await controller.applyLocalFontSelection("local:fira%20code");
  await controller.loadLocalFonts();

  expect(controller.getFontSizeDefault()).toBe(24);
  expect(controller.getFontFamily()).toBe("jetbrains");
  expect(controller.getLocalFontMatcher()).toBe("fira code");
  expect(controller.getLocalFontHintText()).toBe("Detected 1 local font families.");
  expect(controller.getDetectedLocalFontOptions()).toEqual([
    { value: "local:fira%20code", label: "Local Font: Fira Code" },
  ]);
  expect(fontSourceLabels.length).toBe(2);
  expect(syncCalls).toEqual([
    "sync-font-family",
    "sync-local-fonts",
    "sync-local-fonts",
    "sync-local-fonts",
  ]);
  expect(paneStates.get(9)?.fontSize).toBe(24);
  expect(paneCalls).toEqual(["font-size:24"]);
});

test("font controller updates rendering toggles", () => {
  const { pane, calls: paneCalls } = createPane(5);
  const paneStates = new Map<number, PaneState>([[5, createState({ id: 5 })]]);
  const { calls: syncCalls, shellSync } = createShellSyncCalls();

  const controller = createPaneFontController({
    host: {
      forEachPane: (visitor) => {
        visitor(pane);
      },
      setFontSources: async () => {},
    },
    getActivePane: () => pane,
    getActivePaneState: () => paneStates.get(5) ?? null,
    shellSync,
    initialState: {
      detectedLocalFontOptions: [],
      fontFamily: "fira-code",
      fontHintTarget: "auto",
      fontHinting: false,
      fontSizeDefault: 18,
      ligatures: true,
      localFontHintText: "hint",
      localFontMatcher: "",
    },
  });

  controller.applyFontHintingChange("on");
  controller.applyLigaturesChange("off");
  controller.applyFontHintTargetChange("light");

  expect(controller.getLigatures()).toBe(false);
  expect(controller.getFontHinting()).toBe(true);
  expect(controller.getFontHintTarget()).toBe("light");
  expect(syncCalls).toEqual(["sync-font-rendering", "sync-font-rendering", "sync-font-rendering"]);
  expect(paneCalls).toEqual([
    "ligatures:true",
    "hint-target:auto",
    "hinting:true",
    "ligatures:false",
    "hint-target:auto",
    "hinting:true",
    "ligatures:false",
    "hint-target:light",
    "hinting:true",
  ]);
});

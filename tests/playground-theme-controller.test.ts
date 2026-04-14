import { expect, test } from "bun:test";
import { createPaneThemeController } from "../playground/lib/theme-controller.ts";
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
    applyTheme: (_theme: unknown, sourceLabel?: string) => {
      calls.push(`theme:${sourceLabel ?? ""}`);
    },
    resetTheme: () => {
      calls.push("reset-theme");
    },
  };
  return { pane, calls };
}

function createShellSyncCalls() {
  const calls: string[] = [];
  return {
    calls,
    shellSync: {
      syncShaderPresetValue: (value: string) => {
        calls.push(`sync-shader:${value}`);
      },
      syncThemeSelectValue: (value: string) => {
        calls.push(`sync-theme:${value}`);
      },
    },
  };
}

test("theme controller applies theme selection and uploaded theme files", async () => {
  const { pane, calls: paneCalls } = createPane(4);
  const paneStates = new Map<number, PaneState>([[4, createState({ id: 4 })]]);
  const { calls: syncCalls, shellSync } = createShellSyncCalls();
  const shaderStages: string[] = [];
  let themeFileResets = 0;

  const controller = createPaneThemeController({
    host: {
      setShaderStages: () => {
        shaderStages.push("set");
      },
    },
    getActivePane: () => pane,
    getActivePaneState: () => paneStates.get(4) ?? null,
    getActivePaneId: () => 4,
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    shellSync,
    onThemeFileReset: () => {
      themeFileResets += 1;
    },
    initialShaderPreset: "none",
    parseTheme: (text) => ({
      name: text,
      colors: { palette: [] },
      raw: {},
    }),
  });

  controller.applyThemeSelection("Aizen Dark");
  await controller.applyUploadedThemeFile(new File(["Uploaded Theme"], "uploaded.conf"));
  controller.applyThemeSelection("");

  expect(paneStates.get(4)?.theme.selectValue).toBe("");
  expect(syncCalls).toEqual(["sync-theme:Aizen Dark", "sync-theme:", "sync-theme:"]);
  expect(themeFileResets).toBe(1);
  expect(shaderStages).toEqual([]);
  expect(paneCalls).toEqual(["theme:Aizen Dark", "theme:uploaded.conf", "reset-theme"]);
});

test("theme controller updates shader preset state", () => {
  const { calls: syncCalls, shellSync } = createShellSyncCalls();
  const shaderStages: string[] = [];

  const controller = createPaneThemeController({
    host: {
      setShaderStages: () => {
        shaderStages.push("set");
      },
    },
    getActivePane: () => null,
    getActivePaneState: () => null,
    getActivePaneId: () => null,
    setPaneState: () => {},
    shellSync,
    onThemeFileReset: () => {},
    initialShaderPreset: "none",
  });

  controller.applySelectedShaderPreset("aurora");
  controller.applySelectedShaderPreset("invalid");

  expect(controller.getShaderPreset()).toBe("none");
  expect(syncCalls).toEqual(["sync-shader:aurora", "sync-shader:none"]);
  expect(shaderStages).toEqual(["set", "set"]);
});

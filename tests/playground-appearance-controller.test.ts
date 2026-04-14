import { expect, test } from "bun:test";
import { createPaneAppearanceController } from "../playground/lib/appearance-controller.ts";
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
    setRenderer: (value: string) => {
      calls.push(`renderer:${value}`);
    },
    getMouseStatus: () => ({ mode: "drag" }),
    setMouseMode: (value: string) => {
      calls.push(`mouse:${value}`);
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
      syncMouseModeValue: (value: string) => {
        calls.push(`sync-mouse:${value}`);
      },
      syncThemeSelectValue: (value: string) => {
        calls.push(`sync-theme:${value}`);
      },
      syncShaderPresetValue: (value: string) => {
        calls.push(`sync-shader:${value}`);
      },
    },
  };
}

test("appearance controller composes theme, font, and terminal controllers", async () => {
  const { pane, calls: paneCalls } = createPane(9);
  const paneStates = new Map<number, PaneState>([[9, createState({ id: 9 })]]);
  const { calls: syncCalls, shellSync } = createShellSyncCalls();
  const shaderStages: string[] = [];

  const controller = createPaneAppearanceController({
    host: {
      forEachPane: (visitor) => {
        visitor(pane);
      },
      setFontSources: async () => {},
      setShaderStages: () => {
        shaderStages.push("set");
      },
    },
    getActivePane: () => pane,
    getActivePaneState: () => paneStates.get(9) ?? null,
    getActivePaneId: () => 9,
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    shellSync,
    onThemeFileReset: () => {},
    initialState: {
      detectedLocalFontOptions: [],
      fontFamily: "fira-code",
      fontHintTarget: "auto",
      fontHinting: false,
      fontSizeDefault: 18,
      ligatures: true,
      localFontHintText: "hint",
      localFontMatcher: "",
      mouseModeDefault: "auto",
      rendererDefault: "auto",
      shaderPreset: "none",
    },
    detectLocalFontState: async () => ({
      detectedOptions: [],
      hintText: "hint",
    }),
  });

  controller.applyRendererChoice("webgpu");
  controller.applyMouseMode("drag");
  controller.applySelectedShaderPreset("aurora");
  await controller.applyFontFamilySelection("jetbrains");

  expect(controller.getRendererDefault()).toBe("webgpu");
  expect(controller.getMouseModeDefault()).toBe("drag");
  expect(controller.getShaderPreset()).toBe("aurora");
  expect(controller.getFontFamily()).toBe("jetbrains");
  expect(shaderStages).toEqual(["set"]);
  expect(syncCalls).toEqual([
    "sync-mouse:drag",
    "sync-shader:aurora",
    "sync-font-family",
    "sync-local-fonts",
  ]);
  expect(paneStates.get(9)).toMatchObject({
    renderer: "webgpu",
    mouseMode: "drag",
  });
  expect(paneCalls).toEqual(["renderer:webgpu", "mouse:drag"]);
});

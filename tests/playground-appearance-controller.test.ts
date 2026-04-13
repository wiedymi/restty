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
    runtime: {
      terminal: {
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
      },
      interaction: {
        getMouseStatus: () => ({ mode: "drag" }),
        setMouseMode: (value: string) => {
          calls.push(`mouse:${value}`);
        },
      },
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

test("appearance controller updates renderer, font, mouse, shader, and local font state", async () => {
  const { pane, calls: paneCalls } = createPane(9);
  const paneStates = new Map<number, PaneState>([[9, createState({ id: 9 })]]);
  const { calls: syncCalls, shellSync } = createShellSyncCalls();
  const shaderStages: string[] = [];
  const fontSourceLabels: string[][] = [];

  const controller = createPaneAppearanceController({
    host: {
      getPanes: () => [pane],
      setFontSources: async (sources) => {
        fontSourceLabels.push(sources.map((source) => source.label));
      },
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
      detectedOptions: [{ value: "local:fira%20code", label: "Local Font: Fira Code" }],
      hintText: "Detected 1 local font families.",
    }),
  });

  controller.applyRendererChoice("webgpu");
  controller.applyFontSizeValue("24");
  controller.applyMouseMode("drag");
  controller.applyFontHintingChange("on");
  controller.applyLigaturesChange("off");
  controller.applyFontHintTargetChange("light");
  await controller.applyFontFamilySelection("jetbrains");
  await controller.applyLocalFontSelection("local:fira%20code");
  await controller.loadLocalFonts();

  expect(controller.getRendererDefault()).toBe("webgpu");
  expect(controller.getFontSizeDefault()).toBe(24);
  expect(controller.getMouseModeDefault()).toBe("drag");
  expect(controller.getFontFamily()).toBe("jetbrains");
  expect(controller.getLocalFontMatcher()).toBe("fira code");
  expect(controller.getLigatures()).toBe(false);
  expect(controller.getFontHinting()).toBe(true);
  expect(controller.getFontHintTarget()).toBe("light");
  expect(controller.getShaderPreset()).toBe("none");
  expect(controller.getLocalFontHintText()).toBe("Detected 1 local font families.");
  expect(controller.getDetectedLocalFontOptions()).toEqual([
    { value: "local:fira%20code", label: "Local Font: Fira Code" },
  ]);
  expect(shaderStages).toEqual([]);
  expect(fontSourceLabels.length).toBe(2);
  expect(syncCalls).toEqual([
    "sync-mouse:drag",
    "sync-font-rendering",
    "sync-font-rendering",
    "sync-font-rendering",
    "sync-font-family",
    "sync-local-fonts",
    "sync-local-fonts",
    "sync-local-fonts",
  ]);
  expect(paneStates.get(9)).toMatchObject({
    renderer: "webgpu",
    fontSize: 24,
    mouseMode: "drag",
  });
  expect(paneCalls).toEqual([
    "renderer:webgpu",
    "font-size:24",
    "mouse:drag",
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

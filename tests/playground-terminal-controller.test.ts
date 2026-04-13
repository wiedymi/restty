import { expect, test } from "bun:test";
import { createPaneTerminalController } from "../playground/lib/terminal-controller.ts";
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

test("terminal controller updates renderer and mouse defaults", () => {
  const { pane, calls } = createPane(9);
  const paneStates = new Map<number, PaneState>([[9, createState({ id: 9 })]]);
  const syncCalls: string[] = [];

  const controller = createPaneTerminalController({
    getActivePane: () => pane,
    getActivePaneState: () => paneStates.get(9) ?? null,
    getActivePaneId: () => 9,
    shellSync: {
      syncMouseModeValue: (value) => {
        syncCalls.push(`sync-mouse:${value}`);
      },
    },
    initialState: {
      mouseModeDefault: "auto",
      rendererDefault: "auto",
    },
  });

  controller.applyRendererChoice("webgpu");
  controller.applyMouseMode("drag");

  expect(controller.getRendererDefault()).toBe("webgpu");
  expect(controller.getMouseModeDefault()).toBe("drag");
  expect(paneStates.get(9)).toMatchObject({
    renderer: "webgpu",
    mouseMode: "drag",
  });
  expect(syncCalls).toEqual(["sync-mouse:drag"]);
  expect(calls).toEqual(["renderer:webgpu", "mouse:drag"]);
});

test("terminal controller syncs defaults from pane state", () => {
  const controller = createPaneTerminalController({
    getActivePane: () => null,
    getActivePaneState: () => null,
    getActivePaneId: () => null,
    shellSync: {
      syncMouseModeValue: () => {},
    },
    initialState: {
      mouseModeDefault: "auto",
      rendererDefault: "auto",
    },
  });

  controller.syncTerminalDefaultsFromState(
    createState({
      renderer: "webgl2",
      mouseMode: "on",
    }),
  );

  expect(controller.getRendererDefault()).toBe("webgl2");
  expect(controller.getMouseModeDefault()).toBe("on");
});

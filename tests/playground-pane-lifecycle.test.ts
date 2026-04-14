import { expect, test } from "bun:test";
import { createPaneLifecycleController } from "../playground/lib/pane-lifecycle.ts";
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
  let connected = false;

  const pane = {
    id,
    paused: false,
    canvas: {
      focus: () => {
        calls.push("focus");
      },
    },
    runtime: {
      lifecycle: {
        init: async () => {
          calls.push("init");
        },
      },
    },
  };
  const handle = {
    id,
    applyTheme: () => {},
    clearScreen: () => {
      calls.push("clear");
    },
    connectPty: (url: string) => {
      calls.push(`connect:${url}`);
      connected = true;
    },
    disconnectPty: () => {
      calls.push("disconnect");
      connected = false;
    },
    isPtyConnected: () => connected,
    resetTheme: () => {},
    setPaused: (value: boolean) => {
      calls.push(`pause:${value}`);
    },
  };

  return { pane, handle, calls };
}

test("pane lifecycle init restores size and auto-connects webcontainer panes", async () => {
  const { pane, handle, calls } = createPane(7);
  const paneStates = new Map<number, PaneState>([[7, createState({ id: 7, paused: true })]]);
  const syncedPty: number[] = [];
  const resizeCalls: string[] = [];

  const lifecycle = createPaneLifecycleController({
    getPaneById: (id) => (id === pane.id ? pane : null),
    getPaneHandleById: (id) => (id === pane.id ? handle : null),
    getActivePane: () => pane,
    getActivePaneHandle: () => handle,
    getPaneState: (id) => paneStates.get(id),
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    getActivePaneId: () => pane.id,
    getSelectedConnectionBackend: () => "webcontainer",
    getSelectedPtyUrl: () => "ws://localhost:8787/pty",
    updatePaneSize: (id, force) => {
      resizeCalls.push(`${id}:${force === true ? "forced" : "normal"}`);
    },
    syncPauseButton: () => {},
    syncPtyButton: (nextPane) => {
      syncedPty.push(nextPane.id);
    },
    waitForAnimationFrame: async () => {},
    requestAnimationFrame: (callback) => {
      callback(0);
      return 1;
    },
  });

  await lifecycle.initPane(pane, paneStates.get(7)!);

  expect(calls).toEqual(["init", "connect:", "focus"]);
  expect(resizeCalls).toEqual(["7:forced", "7:forced", "7:forced"]);
  expect(syncedPty).toEqual([7]);
});

test("pane lifecycle toggles pause and pty state for the active pane", () => {
  const { pane, handle, calls } = createPane(3);
  const paneStates = new Map<number, PaneState>([
    [
      3,
      createState({
        id: 3,
        paused: true,
        demos: {
          run: () => {},
          stop: () => {
            calls.push("stop-demo");
          },
        },
      }),
    ],
  ]);
  const pauseStates: boolean[] = [];
  let activePaneId: number | null = 3;

  const lifecycle = createPaneLifecycleController({
    getPaneById: (id) => (id === pane.id ? pane : null),
    getPaneHandleById: (id) => (id === pane.id ? handle : null),
    getActivePane: () => (activePaneId === pane.id ? pane : null),
    getActivePaneHandle: () => (activePaneId === pane.id ? handle : null),
    getPaneState: (id) => paneStates.get(id),
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    getActivePaneId: () => activePaneId,
    getSelectedConnectionBackend: () => "ws",
    getSelectedPtyUrl: () => "ws://localhost:8787/pty",
    updatePaneSize: () => {},
    syncPauseButton: (state) => {
      pauseStates.push(state.paused);
    },
    syncPtyButton: () => {
      calls.push("sync-pty");
    },
  });

  lifecycle.handleTerminalPauseToggle();
  lifecycle.handlePtyButtonClick();
  lifecycle.handlePtyButtonClick();
  lifecycle.handleTerminalClear();

  expect(paneStates.get(3)?.paused).toBe(false);
  expect(pauseStates).toEqual([false]);
  expect(calls).toEqual([
    "pause:false",
    "connect:ws://localhost:8787/pty",
    "sync-pty",
    "disconnect",
    "sync-pty",
    "stop-demo",
    "clear",
  ]);

  activePaneId = null;
  lifecycle.handleTerminalPauseToggle();
  expect(pauseStates).toEqual([false]);
});

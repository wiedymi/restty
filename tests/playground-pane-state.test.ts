import { expect, test } from "bun:test";
import type { GhosttyTheme } from "../src/index.ts";
import {
  createPaneState,
  getActivePaneState,
  type PaneState,
  withPanePaused,
} from "../playground/lib/pane-state.ts";

function createTheme(name: string): GhosttyTheme {
  return {
    name,
    colors: {
      palette: [],
    },
    raw: {},
  };
}

function createState(overrides: Partial<PaneState> = {}): PaneState {
  return {
    id: overrides.id ?? 1,
    renderer: overrides.renderer ?? "auto",
    fontSize: overrides.fontSize ?? 18,
    mouseMode: overrides.mouseMode ?? "auto",
    paused: overrides.paused ?? false,
    theme: overrides.theme ?? {
      selectValue: "Aizen Dark",
      sourceLabel: "default theme",
      theme: createTheme("Aizen Dark"),
    },
    demos: overrides.demos ?? null,
  };
}

test("createPaneState uses explicit defaults when there is no source state", () => {
  const state = createPaneState({
    id: 7,
    sourceState: null,
    renderer: "webgpu",
    fontSize: 20,
    mouseMode: "sgr",
    defaultThemeName: "Aizen Dark",
  });

  expect(state).toEqual({
    id: 7,
    renderer: "webgpu",
    fontSize: 20,
    mouseMode: "sgr",
    paused: false,
    theme: {
      selectValue: "Aizen Dark",
      sourceLabel: "default theme",
      theme: null,
    },
    demos: null,
  });
});

test("createPaneState inherits source state without aliasing theme state", () => {
  const sourceState = createState({
    id: 3,
    renderer: "webgl2",
    fontSize: 22,
    mouseMode: "drag",
    paused: true,
    theme: {
      selectValue: "custom",
      sourceLabel: "theme file",
      theme: createTheme("custom"),
    },
  });

  const nextState = createPaneState({
    id: 9,
    sourceState,
    renderer: "auto",
    fontSize: 14,
    mouseMode: "auto",
    defaultThemeName: "Aizen Dark",
  });

  expect(nextState.id).toBe(9);
  expect(nextState.renderer).toBe("webgl2");
  expect(nextState.fontSize).toBe(22);
  expect(nextState.mouseMode).toBe("drag");
  expect(nextState.paused).toBe(true);
  expect(nextState.theme).toEqual(sourceState.theme);
  expect(nextState.theme).not.toBe(sourceState.theme);
  expect(nextState.demos).toBeNull();
});

test("getActivePaneState returns the mapped active pane state", () => {
  const activeState = createState({ id: 5 });
  const otherState = createState({ id: 8 });
  const paneStates = new Map<number, PaneState>([
    [activeState.id, activeState],
    [otherState.id, otherState],
  ]);

  expect(getActivePaneState(paneStates, 5)).toBe(activeState);
  expect(getActivePaneState(paneStates, null)).toBeNull();
  expect(getActivePaneState(paneStates, 99)).toBeNull();
});

test("withPanePaused returns a new state with updated paused flag", () => {
  const state = createState({ paused: false });

  const pausedState = withPanePaused(state, true);

  expect(pausedState).not.toBe(state);
  expect(pausedState.paused).toBe(true);
  expect(state.paused).toBe(false);
  expect(pausedState.theme).toBe(state.theme);
});

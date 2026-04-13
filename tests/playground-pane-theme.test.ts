import { expect, test } from "bun:test";
import { listBuiltinThemeNames, getBuiltinTheme, type GhosttyTheme } from "../src/index.ts";
import {
  applyBuiltinThemeToPane,
  applySavedThemeForPane,
  applyThemeToPane,
  resetThemeForPane,
  type PaneThemeTarget,
} from "../playground/lib/pane-theme.ts";
import type { PaneState } from "../playground/lib/pane-state.ts";

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
      selectValue: "",
      sourceLabel: "",
      theme: null,
    },
    demos: overrides.demos ?? null,
  };
}

function createPane(id = 1) {
  const events: Array<{ type: string; theme?: GhosttyTheme; sourceLabel?: string }> = [];
  const pane: PaneThemeTarget = {
    id,
    runtime: {
      terminal: {
        applyTheme: (theme, sourceLabel) => {
          events.push({ type: "apply", theme, sourceLabel });
        },
        resetTheme: () => {
          events.push({ type: "reset" });
        },
      },
    },
  };
  return { pane, events };
}

test("applyThemeToPane updates state without mutating shell select state", () => {
  const theme = createTheme("custom");
  const state = createState();
  const { pane, events } = createPane(7);

  const nextState = applyThemeToPane({
    pane,
    state,
    theme,
    sourceLabel: "theme file",
    selectValue: "custom-file",
  });

  expect(nextState).not.toBeNull();
  expect(nextState?.theme).toEqual({
    selectValue: "custom-file",
    sourceLabel: "theme file",
    theme,
  });
  expect(events).toEqual([{ type: "apply", theme, sourceLabel: "theme file" }]);
});

test("applyBuiltinThemeToPane resolves a builtin theme and stores the selected name", () => {
  const builtinName = listBuiltinThemeNames()[0];
  expect(builtinName).toBeTruthy();

  const builtinTheme = getBuiltinTheme(builtinName!);
  expect(builtinTheme).toBeTruthy();

  const state = createState();
  const { pane, events } = createPane(3);

  const nextState = applyBuiltinThemeToPane({
    pane,
    state,
    name: builtinName!,
  });

  expect(nextState?.theme.selectValue).toBe(builtinName);
  expect(nextState?.theme.sourceLabel).toBe(builtinName);
  expect(nextState?.theme.theme).toBe(builtinTheme);
  expect(events).toEqual([{ type: "apply", theme: builtinTheme, sourceLabel: builtinName }]);
});

test("resetThemeForPane clears stored theme without mutating shell select state", () => {
  const state = createState({
    theme: {
      selectValue: "custom",
      sourceLabel: "theme file",
      theme: createTheme("custom"),
    },
  });
  const { pane, events } = createPane(5);

  const nextState = resetThemeForPane({
    pane,
    state,
  });

  expect(nextState.theme).toEqual({
    selectValue: "",
    sourceLabel: "",
    theme: null,
  });
  expect(events).toEqual([{ type: "reset" }]);
});

test("applySavedThemeForPane restores saved builtin and custom themes", () => {
  const builtinName = listBuiltinThemeNames()[0]!;
  const builtinState = createState({
    theme: {
      selectValue: builtinName,
      sourceLabel: "default theme",
      theme: null,
    },
  });
  const customTheme = createTheme("custom");
  const customState = createState({
    theme: {
      selectValue: "",
      sourceLabel: "theme file",
      theme: customTheme,
    },
  });

  const builtinPane = createPane(1);
  const customPane = createPane(2);

  const restoredBuiltinState = applySavedThemeForPane({
    pane: builtinPane.pane,
    state: builtinState,
  });
  const restoredCustomState = applySavedThemeForPane({
    pane: customPane.pane,
    state: customState,
  });

  expect(restoredBuiltinState.theme.selectValue).toBe(builtinName);
  expect(builtinPane.events[0]?.type).toBe("apply");
  expect(restoredCustomState.theme.theme).toBe(customTheme);
  expect(customPane.events).toEqual([
    { type: "apply", theme: customTheme, sourceLabel: "theme file" },
  ]);
});

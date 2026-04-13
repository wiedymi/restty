import { getBuiltinTheme, type GhosttyTheme } from "../../src/index.ts";
import type { PaneState } from "./pane-state.ts";

type ThemeSelectElement = {
  value: string;
} | null;

export type PaneThemeTarget = {
  id: number;
  runtime: {
    terminal: {
      applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
      resetTheme: () => void;
    };
  };
};

type PaneThemeOptions = {
  pane: PaneThemeTarget;
  state: PaneState;
  activePaneId: number | null;
  themeSelect: ThemeSelectElement;
};

function syncThemeSelect(
  paneId: number,
  activePaneId: number | null,
  themeSelect: ThemeSelectElement,
  value: string,
) {
  if (paneId === activePaneId && themeSelect) {
    themeSelect.value = value;
  }
}

function withPaneTheme(
  state: PaneState,
  theme: GhosttyTheme,
  sourceLabel: string,
  selectValue = "",
): PaneState {
  return {
    ...state,
    theme: {
      selectValue,
      sourceLabel,
      theme,
    },
  };
}

function withoutPaneTheme(state: PaneState): PaneState {
  return {
    ...state,
    theme: {
      selectValue: "",
      sourceLabel: "",
      theme: null,
    },
  };
}

export function applyThemeToPane(
  options: PaneThemeOptions & {
    theme: GhosttyTheme;
    sourceLabel: string;
    selectValue?: string;
  },
): PaneState | null {
  try {
    options.pane.runtime.terminal.applyTheme(options.theme, options.sourceLabel);
    const nextState = withPaneTheme(
      options.state,
      options.theme,
      options.sourceLabel,
      options.selectValue ?? "",
    );
    syncThemeSelect(
      options.pane.id,
      options.activePaneId,
      options.themeSelect,
      nextState.theme.selectValue,
    );
    return nextState;
  } catch (err) {
    console.error("theme apply failed", err);
    return null;
  }
}

export function applyBuiltinThemeToPane(
  options: PaneThemeOptions & {
    name: string;
    sourceLabel?: string;
  },
): PaneState | null {
  const theme = getBuiltinTheme(options.name);
  if (!theme) return null;
  return applyThemeToPane({
    ...options,
    theme,
    sourceLabel: options.sourceLabel ?? options.name,
    selectValue: options.name,
  });
}

export function resetThemeForPane(options: PaneThemeOptions): PaneState {
  options.pane.runtime.terminal.resetTheme();
  const nextState = withoutPaneTheme(options.state);
  syncThemeSelect(options.pane.id, options.activePaneId, options.themeSelect, "");
  return nextState;
}

export function applySavedThemeForPane(options: PaneThemeOptions): PaneState {
  if (options.state.theme.selectValue) {
    return (
      applyBuiltinThemeToPane({
        ...options,
        name: options.state.theme.selectValue,
        sourceLabel: options.state.theme.sourceLabel,
      }) ?? options.state
    );
  }
  if (!options.state.theme.theme) return options.state;
  return (
    applyThemeToPane({
      ...options,
      theme: options.state.theme.theme,
      sourceLabel: options.state.theme.sourceLabel || "pane theme",
      selectValue: options.state.theme.selectValue,
    }) ?? options.state
  );
}

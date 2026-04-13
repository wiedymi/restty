import type { GhosttyTheme } from "../../src/index.ts";

export type RendererChoice = "auto" | "webgpu" | "webgl2";

export type PaneThemeState = {
  selectValue: string;
  sourceLabel: string;
  theme: GhosttyTheme | null;
};

export type PaneDemoController = {
  run: (kind: string) => void;
  stop: () => void;
};

export type PaneState = {
  id: number;
  renderer: RendererChoice;
  fontSize: number;
  mouseMode: string;
  paused: boolean;
  theme: PaneThemeState;
  demos: PaneDemoController | null;
};

type CreatePaneStateOptions = {
  id: number;
  sourceState?: PaneState | null;
  renderer: RendererChoice;
  fontSize: number;
  mouseMode: string;
  defaultThemeName: string;
};

function clonePaneThemeState(themeState: PaneThemeState): PaneThemeState {
  return {
    selectValue: themeState.selectValue,
    sourceLabel: themeState.sourceLabel,
    theme: themeState.theme,
  };
}

export function createPaneState(options: CreatePaneStateOptions): PaneState {
  return {
    id: options.id,
    renderer: options.sourceState?.renderer ?? options.renderer,
    fontSize: options.sourceState?.fontSize ?? options.fontSize,
    mouseMode: options.sourceState?.mouseMode ?? options.mouseMode,
    paused: options.sourceState?.paused ?? false,
    theme: options.sourceState
      ? clonePaneThemeState(options.sourceState.theme)
      : {
          selectValue: options.defaultThemeName,
          sourceLabel: options.defaultThemeName ? "default theme" : "",
          theme: null,
        },
    demos: null,
  };
}

export function getActivePaneState(
  paneStates: Map<number, PaneState>,
  activePaneId: number | null,
): PaneState | null {
  if (activePaneId === null) return null;
  return paneStates.get(activePaneId) ?? null;
}

export function withPanePaused(state: PaneState, value: boolean): PaneState {
  return {
    ...state,
    paused: Boolean(value),
  };
}

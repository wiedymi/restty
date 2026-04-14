import type { ResttyPaneApi } from "../../src/index.ts";
import type { PaneState, RendererChoice } from "./pane-state.ts";

export type TerminalControllerPane = Pick<
  ResttyPaneApi,
  "getMouseStatus" | "setMouseMode" | "setRenderer"
> & {
  id: number;
};

type TerminalControllerShellSync = {
  syncMouseModeValue: (value: string) => void;
};

type CreatePaneTerminalControllerOptions = {
  getActivePane: () => TerminalControllerPane | null;
  getActivePaneState: () => PaneState | null;
  getActivePaneId: () => number | null;
  shellSync: TerminalControllerShellSync;
  initialState: {
    mouseModeDefault: string;
    rendererDefault: RendererChoice;
  };
};

export function createPaneTerminalController(options: CreatePaneTerminalControllerOptions) {
  let selectedMouseModeDefault = options.initialState.mouseModeDefault;
  let selectedRendererDefault = options.initialState.rendererDefault;

  function getActiveContext() {
    const pane = options.getActivePane();
    const state = options.getActivePaneState();
    if (!pane || !state) return null;
    return { pane, state };
  }

  function syncTerminalDefaultsFromState(state: PaneState) {
    selectedRendererDefault = state.renderer;
    selectedMouseModeDefault = state.mouseMode;
  }

  function applyRendererChoice(value: string | null | undefined) {
    const active = getActiveContext();
    if (!active) return;
    if (value !== "auto" && value !== "webgpu" && value !== "webgl2") return;
    selectedRendererDefault = value;
    active.state.renderer = value;
    active.pane.setRenderer(value);
  }

  function applyMouseMode(value: string | null | undefined) {
    const active = getActiveContext();
    if (!active) return;
    selectedMouseModeDefault = value ?? "auto";
    active.pane.setMouseMode(selectedMouseModeDefault);
    active.state.mouseMode = active.pane.getMouseStatus().mode;
    if (active.pane.id === options.getActivePaneId()) {
      options.shellSync.syncMouseModeValue(active.state.mouseMode);
    }
  }

  return {
    applyMouseMode,
    applyRendererChoice,
    getMouseModeDefault: () => selectedMouseModeDefault,
    getRendererDefault: () => selectedRendererDefault,
    syncTerminalDefaultsFromState,
  };
}

import type { PaneState } from "./pane-state.ts";

export type PlaygroundSessionState = {
  paneStates: Map<number, PaneState>;
  getActivePaneId: () => number | null;
  setActivePaneId: (id: number | null) => void;
};

export function createPlaygroundSessionState(): PlaygroundSessionState {
  const paneStates = new Map<number, PaneState>();
  let activePaneId: number | null = null;

  return {
    paneStates,
    getActivePaneId: () => activePaneId,
    setActivePaneId: (id: number | null) => {
      activePaneId = id;
    },
  };
}

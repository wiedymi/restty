import type { PaneState } from "./pane-state.ts";
import type { PaneShellSyncElements } from "./pane-shell-sync.types.ts";

type CreatePaneTerminalShellSyncOptions = {
  elements: Pick<PaneShellSyncElements, "btnPause" | "rendererSelect" | "fontSizeInput">;
};

export function createPaneTerminalShellSync(options: CreatePaneTerminalShellSyncOptions) {
  function syncPauseButton(state: PaneState) {
    if (options.elements.btnPause) {
      options.elements.btnPause.textContent = state.paused ? "Resume" : "Pause";
    }
  }

  function syncTerminalControlValues(state: PaneState) {
    if (options.elements.rendererSelect) {
      options.elements.rendererSelect.value = state.renderer;
    }
    if (options.elements.fontSizeInput) {
      options.elements.fontSizeInput.value = `${state.fontSize}`;
    }
  }

  return {
    syncPauseButton,
    syncTerminalControlValues,
  };
}

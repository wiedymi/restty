import { dispatchActivePaneState } from "./shell-bridge.ts";
import type { PaneState } from "./pane-state.ts";
import type { PaneShellSyncElements } from "./pane-shell-sync.types.ts";
import type { ActivePaneStateDetail } from "./shell-events.ts";

type TerminalStateDetail = NonNullable<ActivePaneStateDetail["terminal"]>;

type CreatePaneTerminalShellSyncOptions = {
  usesSvelteShell: boolean;
  target?: EventTarget;
  elements: Pick<PaneShellSyncElements, "btnPause" | "rendererSelect" | "fontSizeInput">;
};

export function createPaneTerminalShellSync(options: CreatePaneTerminalShellSyncOptions) {
  function buildTerminalState(state: PaneState): TerminalStateDetail {
    return {
      pauseLabel: state.paused ? "Resume" : "Pause",
      renderer: state.renderer,
      fontSize: state.fontSize,
    };
  }

  function syncPauseButton(state: PaneState) {
    const pauseLabel = state.paused ? "Resume" : "Pause";
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          terminal: {
            pauseLabel,
          },
        },
        options.target,
      );
      return;
    }
    if (options.elements.btnPause) {
      options.elements.btnPause.textContent = pauseLabel;
    }
  }

  function syncTerminalControlValues(state: PaneState) {
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          terminal: buildTerminalState(state),
        },
        options.target,
      );
      return;
    }
    if (options.elements.rendererSelect) {
      options.elements.rendererSelect.value = state.renderer;
    }
    if (options.elements.fontSizeInput) {
      options.elements.fontSizeInput.value = `${state.fontSize}`;
    }
  }

  return {
    buildTerminalState,
    syncPauseButton,
    syncTerminalControlValues,
  };
}

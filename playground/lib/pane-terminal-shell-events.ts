import type { PaneState } from "./pane-state.ts";
import { dispatchActivePaneState } from "./shell-bridge.ts";
import type { ActivePaneStateDetail } from "./shell-events.ts";

type TerminalStateDetail = NonNullable<ActivePaneStateDetail["terminal"]>;

type CreatePaneTerminalShellEventsOptions = {
  target: EventTarget;
};

export function createPaneTerminalShellEvents(options: CreatePaneTerminalShellEventsOptions) {
  function buildTerminalState(state: PaneState): TerminalStateDetail {
    return {
      pauseLabel: state.paused ? "Resume" : "Pause",
      renderer: state.renderer,
      fontSize: state.fontSize,
    };
  }

  function syncPauseButton(state: PaneState) {
    dispatchActivePaneState(
      {
        terminal: {
          pauseLabel: state.paused ? "Resume" : "Pause",
        },
      },
      options.target,
    );
  }

  function syncTerminalControlValues(state: PaneState) {
    dispatchActivePaneState(
      {
        terminal: buildTerminalState(state),
      },
      options.target,
    );
  }

  return {
    buildTerminalState,
    syncPauseButton,
    syncTerminalControlValues,
  };
}

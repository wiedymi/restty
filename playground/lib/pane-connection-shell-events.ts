import type { PaneShellSyncPane } from "./pane-shell-sync.types.ts";
import type { ConnectionBackend } from "./pty-connection.ts";
import { dispatchConnectionState } from "./shell-bridge.ts";

type CreatePaneConnectionShellEventsOptions = {
  target: EventTarget;
  getSelectedConnectionBackend: () => ConnectionBackend;
};

export function createPaneConnectionShellEvents(options: CreatePaneConnectionShellEventsOptions) {
  function syncPtyButton(pane: PaneShellSyncPane) {
    const label = pane.runtime.io.isPtyConnected()
      ? "Disconnect"
      : options.getSelectedConnectionBackend() === "webcontainer"
        ? "Start WebContainer"
        : "Connect PTY";
    dispatchConnectionState({ ptyButtonLabel: label }, options.target);
  }

  return {
    syncPtyButton,
  };
}

import type { PaneShellSyncElements, PaneShellSyncPane } from "./pane-shell-sync.types.ts";
import type { ConnectionBackend } from "./pty-connection.ts";

type CreatePaneConnectionShellSyncOptions = {
  elements: Pick<PaneShellSyncElements, "ptyBtn">;
  getSelectedConnectionBackend: () => ConnectionBackend;
};

export function createPaneConnectionShellSync(options: CreatePaneConnectionShellSyncOptions) {
  function syncPtyButton(pane: PaneShellSyncPane) {
    if (options.elements.ptyBtn) {
      options.elements.ptyBtn.textContent = pane.runtime.io.isPtyConnected()
        ? "Disconnect"
        : options.getSelectedConnectionBackend() === "webcontainer"
          ? "Start WebContainer"
          : "Connect PTY";
    }
  }

  return {
    syncPtyButton,
  };
}

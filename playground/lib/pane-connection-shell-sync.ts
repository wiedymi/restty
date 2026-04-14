import { dispatchConnectionState } from "./shell-bridge.ts";
import type { PaneShellSyncElements, PaneShellSyncPane } from "./pane-shell-sync.types.ts";
import type { ConnectionBackend } from "./pty-connection.ts";

type CreatePaneConnectionShellSyncOptions = {
  usesSvelteShell: boolean;
  target?: EventTarget;
  elements: Pick<PaneShellSyncElements, "ptyBtn">;
  getSelectedConnectionBackend: () => ConnectionBackend;
};

export function createPaneConnectionShellSync(options: CreatePaneConnectionShellSyncOptions) {
  function syncPtyButton(pane: PaneShellSyncPane) {
    const label = pane.runtime.io.isPtyConnected()
      ? "Disconnect"
      : options.getSelectedConnectionBackend() === "webcontainer"
        ? "Start WebContainer"
        : "Connect PTY";
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchConnectionState({ ptyButtonLabel: label }, options.target);
      return;
    }
    if (options.elements.ptyBtn) {
      options.elements.ptyBtn.textContent = label;
    }
  }

  return {
    syncPtyButton,
  };
}

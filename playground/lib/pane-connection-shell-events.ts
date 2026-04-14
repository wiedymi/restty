import type { ResttyPaneApi } from "../../src/index.ts";
import type { ConnectionBackend } from "./connection-state.ts";
import { dispatchConnectionState } from "./shell-bridge.ts";

type PtyButtonPane = Pick<ResttyPaneApi, "isPtyConnected">;

type CreatePaneConnectionShellEventsOptions = {
  target: EventTarget;
  getSelectedConnectionBackend: () => ConnectionBackend;
};

export function createPaneConnectionShellEvents(options: CreatePaneConnectionShellEventsOptions) {
  function syncPtyButton(pane: PtyButtonPane) {
    const isConnected = pane.isPtyConnected();
    const label = isConnected
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

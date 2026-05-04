import type { ResttyPaneApi } from "../../src/index.ts";
import {
  getConnectUrlForState,
  getConnectionBackendForValue,
  isAutoConnectConnectionBackend,
  type ConnectionBackend,
} from "./connection-state.ts";

export type ConnectionControllerPane = Pick<ResttyPaneApi, "disconnectPty" | "isPtyConnected">;

type CreateConnectionControllerOptions = {
  getActivePane: () => ConnectionControllerPane | null;
  forEachPane: (visitor: (paneId: number, pane: ConnectionControllerPane) => void) => void;
  connectPaneIfNeeded: (paneId: number) => void;
  syncConnectionState?: () => void;
  syncPtyButton: (pane: ConnectionControllerPane) => void;
  initialBackend: ConnectionBackend;
  initialPtyUrl: string;
  initialWebContainerCommand: string;
  initialWebContainerCwd: string;
};

export function createConnectionController(options: CreateConnectionControllerOptions) {
  let selectedConnectionBackend = options.initialBackend;
  let selectedPtyUrl = options.initialPtyUrl;
  let selectedWebContainerCommand = options.initialWebContainerCommand;
  let selectedWebContainerCwd = options.initialWebContainerCwd;

  function applyConnectionBackend(value: string | null | undefined) {
    selectedConnectionBackend = getConnectionBackendForValue(value);
    options.syncConnectionState?.();
    options.forEachPane((_paneId, pane) => {
      if (pane.isPtyConnected()) {
        pane.disconnectPty();
      }
    });
    if (isAutoConnectConnectionBackend(selectedConnectionBackend)) {
      options.forEachPane((paneId) => {
        options.connectPaneIfNeeded(paneId);
      });
    }
    const activePane = options.getActivePane();
    if (activePane) {
      options.syncPtyButton(activePane);
    }
  }

  return {
    applyConnectionBackend,
    getBackend: () => selectedConnectionBackend,
    getConnectUrl: () => getConnectUrlForState(selectedConnectionBackend, selectedPtyUrl),
    getPtyUrl: () => selectedPtyUrl,
    getWebContainerCommand: () => selectedWebContainerCommand,
    getWebContainerCwd: () => selectedWebContainerCwd,
    setPtyUrl: (value: string | null | undefined) => {
      selectedPtyUrl = value ?? selectedPtyUrl;
      options.syncConnectionState?.();
    },
    setWebContainerCommand: (value: string | null | undefined) => {
      selectedWebContainerCommand = value?.trim() || "jsh";
      options.syncConnectionState?.();
    },
    setWebContainerCwd: (value: string | null | undefined) => {
      selectedWebContainerCwd = value?.trim() || "/";
      options.syncConnectionState?.();
    },
  };
}

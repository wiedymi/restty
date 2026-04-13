import {
  getConnectUrlForState,
  getConnectionBackendForValue,
  type ConnectionBackend,
} from "./pty-connection.ts";

export type ConnectionControllerPane = {
  runtime: {
    io: {
      disconnectPty: () => void;
      isPtyConnected: () => boolean;
    };
  };
};

type CreateConnectionControllerOptions = {
  getActivePane: () => ConnectionControllerPane | null;
  getPanes: () => ConnectionControllerPane[];
  connectPaneIfNeeded: (pane: ConnectionControllerPane) => void;
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
    for (const pane of options.getPanes()) {
      if (pane.runtime.io.isPtyConnected()) {
        pane.runtime.io.disconnectPty();
      }
    }
    if (selectedConnectionBackend === "webcontainer") {
      for (const pane of options.getPanes()) {
        options.connectPaneIfNeeded(pane);
      }
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

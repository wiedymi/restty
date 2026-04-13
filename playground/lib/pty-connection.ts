import {
  createWebSocketPtyTransport,
  type PtyConnectOptions,
  type PtyResizeMeta,
  type PtyTransport,
} from "../../src/index.ts";
import { createWebContainerPtyTransport } from "./webcontainer-pty.ts";

export type ConnectionBackend = "ws" | "webcontainer";
export type ConnectionUiState = {
  ptyUrlDisabled: boolean;
  webContainerInputsDisabled: boolean;
  hintText: string;
};

type ConnectionBackendElement = {
  value?: string | null;
};

type ConnectionUiElement = {
  disabled?: boolean;
  value?: string;
  textContent?: string | null;
};

export type ConnectionUiElements = {
  connectionBackendEl: ConnectionBackendElement | null;
  ptyUrlInput: ConnectionUiElement | null;
  wcCommandInput: ConnectionUiElement | null;
  wcCwdInput: ConnectionUiElement | null;
  connectionHintEl: ConnectionUiElement | null;
};

export function getConnectionBackend(
  connectionBackendEl: ConnectionBackendElement | null,
): ConnectionBackend {
  return connectionBackendEl?.value === "webcontainer" ? "webcontainer" : "ws";
}

export function getConnectUrl(
  connectionBackendEl: ConnectionBackendElement | null,
  ptyUrlInput: ConnectionUiElement | null,
): string {
  if (getConnectionBackend(connectionBackendEl) === "webcontainer") return "";
  return ptyUrlInput?.value?.trim?.() ?? "";
}

export function getConnectionUiState(backend: ConnectionBackend): ConnectionUiState {
  const webcontainerMode = backend === "webcontainer";
  return {
    ptyUrlDisabled: webcontainerMode,
    webContainerInputsDisabled: !webcontainerMode,
    hintText: webcontainerMode
      ? "Using in-browser WebContainer process"
      : "Using WebSocket PTY URL",
  };
}

export function syncConnectionUi(elements: ConnectionUiElements): ConnectionBackend {
  const backend = getConnectionBackend(elements.connectionBackendEl);
  const uiState = getConnectionUiState(backend);

  if (elements.ptyUrlInput) elements.ptyUrlInput.disabled = uiState.ptyUrlDisabled;
  if (elements.wcCommandInput) {
    elements.wcCommandInput.disabled = uiState.webContainerInputsDisabled;
  }
  if (elements.wcCwdInput) {
    elements.wcCwdInput.disabled = uiState.webContainerInputsDisabled;
  }
  if (elements.connectionHintEl) {
    elements.connectionHintEl.textContent = uiState.hintText;
  }

  return backend;
}

type CreateAdaptivePtyTransportOptions = {
  getConnectionBackend: () => ConnectionBackend;
  getPtyUrl: () => string;
  getWebContainerCommand: () => string;
  getWebContainerCwd: () => string;
  createWebSocketTransport?: () => PtyTransport;
  createWebContainerTransport?: (options: {
    getCommand: () => string;
    getCwd: () => string;
  }) => PtyTransport;
};

export function createAdaptivePtyTransport(
  options: CreateAdaptivePtyTransportOptions,
): PtyTransport {
  const wsTransport = options.createWebSocketTransport?.() ?? createWebSocketPtyTransport();
  const webContainerTransport =
    options.createWebContainerTransport?.({
      getCommand: options.getWebContainerCommand,
      getCwd: options.getWebContainerCwd,
    }) ??
    createWebContainerPtyTransport({
      getCommand: options.getWebContainerCommand,
      getCwd: options.getWebContainerCwd,
    });

  let activeTransport: PtyTransport | null = null;

  const pickTransport = () =>
    options.getConnectionBackend() === "webcontainer" ? webContainerTransport : wsTransport;

  const disconnectAll = () => {
    const transports = new Set<PtyTransport>([wsTransport, webContainerTransport]);
    if (activeTransport) transports.add(activeTransport);
    for (const transport of transports) {
      transport.disconnect();
    }
    activeTransport = null;
  };

  return {
    connect: (connectOptions: PtyConnectOptions) => {
      const nextTransport = pickTransport();
      if (activeTransport && activeTransport !== nextTransport) {
        activeTransport.disconnect();
      }
      activeTransport = nextTransport;
      return nextTransport.connect(connectOptions);
    },
    disconnect: () => {
      disconnectAll();
    },
    sendInput: (data: string) => {
      return activeTransport?.sendInput(data) ?? false;
    },
    resize: (cols: number, rows: number, meta?: PtyResizeMeta) => {
      return activeTransport?.resize(cols, rows, meta) ?? false;
    },
    isConnected: () => {
      return activeTransport?.isConnected() ?? false;
    },
    destroy: () => {
      disconnectAll();
      wsTransport.destroy?.();
      webContainerTransport.destroy?.();
    },
  };
}

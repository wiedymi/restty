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

export function getConnectionBackendForValue(value: string | null | undefined): ConnectionBackend {
  return value === "webcontainer" ? "webcontainer" : "ws";
}

export function getConnectionBackend(
  connectionBackendEl: ConnectionBackendElement | null,
): ConnectionBackend {
  return getConnectionBackendForValue(connectionBackendEl?.value);
}

export function getConnectUrlForState(
  backend: ConnectionBackend,
  ptyUrl: string | null | undefined,
): string {
  if (backend === "webcontainer") return "";
  return ptyUrl?.trim?.() ?? "";
}

export function getConnectUrl(
  connectionBackendEl: ConnectionBackendElement | null,
  ptyUrlInput: ConnectionUiElement | null,
): string {
  return getConnectUrlForState(getConnectionBackend(connectionBackendEl), ptyUrlInput?.value);
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

export type ConnectionBackend = "ws" | "webcontainer";

export type ConnectionUiState = {
  ptyUrlDisabled: boolean;
  webContainerInputsDisabled: boolean;
  hintText: string;
};

export function getConnectionBackendForValue(value: string | null | undefined): ConnectionBackend {
  return value === "webcontainer" ? "webcontainer" : "ws";
}

export function getConnectUrlForState(
  backend: ConnectionBackend,
  ptyUrl: string | null | undefined,
): string {
  if (backend === "webcontainer") return "";
  return ptyUrl?.trim?.() ?? "";
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

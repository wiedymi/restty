export type ConnectionBackend = "just-bash" | "webcontainer" | "ws";

export type ConnectionUiState = {
  ptyUrlDisabled: boolean;
  webContainerInputsDisabled: boolean;
  hintText: string;
};

export function getConnectionBackendForValue(value: string | null | undefined): ConnectionBackend {
  if (value === "webcontainer" || value === "ws" || value === "just-bash") return value;
  return "just-bash";
}

export function isWebContainerConnectionBackend(backend: ConnectionBackend): boolean {
  return backend === "just-bash" || backend === "webcontainer";
}

export function getConnectionButtonLabel(backend: ConnectionBackend): string {
  switch (backend) {
    case "just-bash":
      return "Start Bash";
    case "webcontainer":
      return "Start WebContainer";
    case "ws":
      return "Connect OS PTY";
  }
}

export function getConnectUrlForState(
  backend: ConnectionBackend,
  ptyUrl: string | null | undefined,
): string {
  if (isWebContainerConnectionBackend(backend)) return "";
  return ptyUrl?.trim?.() ?? "";
}

export function getConnectionUiState(backend: ConnectionBackend): ConnectionUiState {
  const webcontainerMode = isWebContainerConnectionBackend(backend);
  return {
    ptyUrlDisabled: webcontainerMode,
    webContainerInputsDisabled: backend !== "webcontainer",
    hintText:
      backend === "just-bash"
        ? "Using in-browser bash"
        : backend === "webcontainer"
          ? "Using custom WebContainer command"
          : "Using OS PTY websocket URL",
  };
}

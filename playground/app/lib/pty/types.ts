export type PlaygroundConnectionBackend = "just-bash" | "webcontainer" | "ws";

export const DEFAULT_CONNECTION_BACKEND: PlaygroundConnectionBackend = "just-bash";
export const DEFAULT_PTY_URL = "ws://localhost:8787/pty";
export const DEFAULT_WEB_CONTAINER_COMMAND = "jsh";
export const DEFAULT_WEB_CONTAINER_CWD = "/";

export function normalizeConnectionBackend(
  value: string | null | undefined,
): PlaygroundConnectionBackend {
  if (value === "webcontainer" || value === "ws" || value === "just-bash") return value;
  return DEFAULT_CONNECTION_BACKEND;
}

export function isAutoConnectBackend(backend: PlaygroundConnectionBackend): boolean {
  return backend === "just-bash" || backend === "webcontainer";
}

export function getConnectUrl(
  backend: PlaygroundConnectionBackend,
  ptyUrl: string | null | undefined,
): string {
  if (isAutoConnectBackend(backend)) return "";
  return ptyUrl?.trim() ?? "";
}

import {
  ACTIVE_PANE_STATE_EVENT,
  CONNECTION_STATE_EVENT,
  THEME_FILE_RESET_EVENT,
  type ActivePaneStateDetail,
  type ConnectionStateDetail,
} from "./shell-events.ts";

type ShellListener<T> = (detail: T) => void;

export function dispatchShellEvent<T>(type: string, detail?: T, target: EventTarget = window) {
  target.dispatchEvent(
    detail === undefined ? new CustomEvent(type) : new CustomEvent(type, { detail }),
  );
}

function listenShellEvent<T>(
  target: EventTarget,
  type: string,
  listener: ShellListener<T>,
): () => void {
  const handler: EventListener = (event) => {
    const detail = (event as CustomEvent<T>).detail;
    if (detail === undefined || detail === null) return;
    listener(detail);
  };
  target.addEventListener(type, handler);
  return () => {
    target.removeEventListener(type, handler);
  };
}

export function dispatchActivePaneState(
  detail: ActivePaneStateDetail,
  target: EventTarget = window,
) {
  dispatchShellEvent(ACTIVE_PANE_STATE_EVENT, detail, target);
}

export function dispatchConnectionState(
  detail: ConnectionStateDetail,
  target: EventTarget = window,
) {
  dispatchShellEvent(CONNECTION_STATE_EVENT, detail, target);
}

export function dispatchThemeFileReset(target: EventTarget = window) {
  dispatchShellEvent(THEME_FILE_RESET_EVENT, undefined, target);
}

export function listenActivePaneState(
  target: EventTarget,
  listener: ShellListener<ActivePaneStateDetail>,
) {
  return listenShellEvent(target, ACTIVE_PANE_STATE_EVENT, listener);
}

export function listenConnectionState(
  target: EventTarget,
  listener: ShellListener<ConnectionStateDetail>,
) {
  return listenShellEvent(target, CONNECTION_STATE_EVENT, listener);
}

import {
  APPEARANCE_INPUT_EVENT,
  ACTIVE_PANE_STATE_EVENT,
  CONNECTION_INPUT_EVENT,
  CONNECTION_STATE_EVENT,
  SHELL_COMMAND_EVENT,
  TERMINAL_ACTION_EVENT,
  THEME_FILE_RESET_EVENT,
  type AppearanceInputDetail,
  type ActivePaneStateDetail,
  type ConnectionInputDetail,
  type ConnectionStateDetail,
  type ShellCommandDetail,
  type TerminalActionDetail,
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

export function dispatchShellCommand(detail: ShellCommandDetail, target: EventTarget = window) {
  dispatchShellEvent(SHELL_COMMAND_EVENT, detail, target);
}

export function dispatchConnectionInput(
  detail: ConnectionInputDetail,
  target: EventTarget = window,
) {
  dispatchShellEvent(CONNECTION_INPUT_EVENT, detail, target);
}

export function dispatchAppearanceInput(
  detail: AppearanceInputDetail,
  target: EventTarget = window,
) {
  dispatchShellEvent(APPEARANCE_INPUT_EVENT, detail, target);
}

export function dispatchTerminalAction(detail: TerminalActionDetail, target: EventTarget = window) {
  dispatchShellEvent(TERMINAL_ACTION_EVENT, detail, target);
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

export function listenShellCommand(
  target: EventTarget,
  listener: ShellListener<ShellCommandDetail>,
) {
  return listenShellEvent(target, SHELL_COMMAND_EVENT, listener);
}

export function listenConnectionInput(
  target: EventTarget,
  listener: ShellListener<ConnectionInputDetail>,
) {
  return listenShellEvent(target, CONNECTION_INPUT_EVENT, listener);
}

export function listenConnectionState(
  target: EventTarget,
  listener: ShellListener<ConnectionStateDetail>,
) {
  return listenShellEvent(target, CONNECTION_STATE_EVENT, listener);
}

export function listenAppearanceInput(
  target: EventTarget,
  listener: ShellListener<AppearanceInputDetail>,
) {
  return listenShellEvent(target, APPEARANCE_INPUT_EVENT, listener);
}

export function listenTerminalAction(
  target: EventTarget,
  listener: ShellListener<TerminalActionDetail>,
) {
  return listenShellEvent(target, TERMINAL_ACTION_EVENT, listener);
}

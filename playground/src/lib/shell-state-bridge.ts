import { listenActivePaneState, listenConnectionState } from "../../lib/shell-bridge.ts";
import {
  applyActivePaneShellState,
  applyConnectionShellState,
} from "./stores/shell-state-reducers.ts";

export function startShellStateBridge(target: EventTarget = window) {
  const stopConnectionState = listenConnectionState(target, (detail) => {
    applyConnectionShellState(detail);
  });

  const stopActivePaneState = listenActivePaneState(target, (detail) => {
    applyActivePaneShellState(detail);
  });

  return () => {
    stopActivePaneState();
    stopConnectionState();
  };
}

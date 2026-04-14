import type { ResttyPaneApi } from "../../src/index.ts";

type FocusablePane = Pick<ResttyPaneApi, "focus">;

export type SettingsDialogHost = {
  hideContextMenu: () => void;
  focusedPane: () => FocusablePane | null;
  activePane: () => FocusablePane | null;
  panes: () => FocusablePane[];
};

export function restoreTerminalFocus(host: SettingsDialogHost) {
  const pane = host.focusedPane() ?? host.activePane() ?? host.panes()[0] ?? null;
  if (!pane) return;
  pane.focus();
}

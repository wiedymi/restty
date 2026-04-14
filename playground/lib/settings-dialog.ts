type FocusablePane = {
  canvas: {
    focus: (options?: FocusOptions) => void;
  };
};

export type SettingsDialogHost = {
  hideContextMenu: () => void;
  getFocusedPane: () => FocusablePane | null;
  getActivePane: () => FocusablePane | null;
  getPanes: () => FocusablePane[];
};

export function restoreTerminalFocus(host: SettingsDialogHost) {
  const pane = host.getFocusedPane() ?? host.getActivePane() ?? host.getPanes()[0] ?? null;
  if (!pane) return;
  pane.canvas.focus({ preventScroll: true });
}

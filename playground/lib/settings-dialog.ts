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

export type SettingsDialogElement = {
  open?: boolean;
  showModal?: () => void;
  close?: () => void;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
} | null;

type SettingsDialogOptions = {
  host: SettingsDialogHost;
  settingsDialog: SettingsDialogElement;
};

export function isSettingsDialogOpen(settingsDialog: SettingsDialogElement): boolean {
  return Boolean(settingsDialog?.open);
}

export function restoreTerminalFocus(host: SettingsDialogHost) {
  const pane = host.getFocusedPane() ?? host.getActivePane() ?? host.getPanes()[0] ?? null;
  if (!pane) return;
  pane.canvas.focus({ preventScroll: true });
}

export function openSettingsDialog(options: SettingsDialogOptions) {
  options.host.hideContextMenu();
  if (!options.settingsDialog || options.settingsDialog.open) return;
  if (typeof options.settingsDialog.showModal === "function") {
    options.settingsDialog.showModal();
    return;
  }
  options.settingsDialog.setAttribute?.("open", "");
}

export function closeSettingsDialog(options: SettingsDialogOptions) {
  if (!options.settingsDialog || !options.settingsDialog.open) return;
  if (typeof options.settingsDialog.close === "function") {
    options.settingsDialog.close();
  } else {
    options.settingsDialog.removeAttribute?.("open");
  }
  restoreTerminalFocus(options.host);
}

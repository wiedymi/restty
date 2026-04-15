import type {
  CreateDefaultResttyPaneContextMenuItemsOptions,
  ResttyPaneContextMenuItem,
  ResttyPaneWithRuntimeActions,
} from "./types";

/** Return the platform-appropriate shortcut modifier label ("Cmd" on macOS, "Ctrl" elsewhere). */
export function getResttyShortcutModifierLabel(): "Cmd" | "Ctrl" {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return isMac ? "Cmd" : "Ctrl";
}

/**
 * Build the standard right-click context menu items for a pane
 * (copy, paste, split, close, clear, PTY toggle, pause toggle).
 */
export function createDefaultResttyPaneContextMenuItems<TPane extends ResttyPaneWithRuntimeActions>(
  options: CreateDefaultResttyPaneContextMenuItemsOptions<TPane>,
): Array<ResttyPaneContextMenuItem | "separator"> {
  const { pane, manager, getPtyUrl } = options;
  const mod = options.modKeyLabel ?? getResttyShortcutModifierLabel();
  const closeEnabled = manager.getPanes().length > 1;
  const pauseLabel =
    typeof pane.paused === "boolean"
      ? pane.paused
        ? "Resume Renderer"
        : "Pause Renderer"
      : "Toggle Renderer Pause";

  return [
    {
      label: "Copy",
      shortcut: `${mod}+C`,
      action: async () => {
        await pane.copySelectionToClipboard();
      },
    },
    {
      label: "Paste",
      shortcut: `${mod}+V`,
      action: async () => {
        await pane.pasteFromClipboard();
      },
    },
    "separator",
    {
      label: "Split Right",
      shortcut: `${mod}+D`,
      action: () => {
        manager.splitPane(pane.id, "vertical");
      },
    },
    {
      label: "Split Down",
      shortcut: `${mod}+Shift+D`,
      action: () => {
        manager.splitPane(pane.id, "horizontal");
      },
    },
    {
      label: "Close Pane",
      enabled: closeEnabled,
      danger: true,
      action: () => {
        manager.closePane(pane.id);
      },
    },
    "separator",
    {
      label: "Clear Screen",
      action: () => {
        pane.clearScreen();
      },
    },
    {
      label: pane.isPtyConnected() ? "Disconnect PTY" : "Connect PTY",
      action: () => {
        if (pane.isPtyConnected()) {
          pane.disconnectPty();
          return;
        }
        const url = (getPtyUrl?.() ?? "").trim();
        pane.connectPty(url);
      },
    },
    {
      label: pauseLabel,
      action: () => {
        if (typeof pane.setPaused === "function") {
          pane.setPaused(!(pane.paused ?? false));
          return;
        }
        pane.togglePause();
      },
    },
  ];
}

import type { PaneContextMenuController } from "./context-menu";
import type {
  ResttyPaneContextMenuOptions,
  ResttyPaneDefinition,
  ResttyPaneManager,
} from "./types";

export function createPaneInteractions<TPane extends ResttyPaneDefinition>(options: {
  contextMenu: ResttyPaneContextMenuOptions<TPane> | null | undefined;
  contextMenuController: PaneContextMenuController<TPane> | null;
  getManager: () => ResttyPaneManager<TPane>;
  markPaneFocused: (id: number) => void;
}) {
  const paneCleanupFns = new Map<number, Array<() => void>>();

  const bindPaneInteractions = (pane: TPane) => {
    const cleanupFns: Array<() => void> = [];
    const { id, container } = pane;

    const onPointerDown = () => {
      options.markPaneFocused(id);
    };
    container.addEventListener("pointerdown", onPointerDown);
    cleanupFns.push(() => {
      container.removeEventListener("pointerdown", onPointerDown);
    });

    const focusTarget = pane.focusTarget;
    if (focusTarget) {
      const onFocus = () => {
        options.markPaneFocused(id);
      };
      focusTarget.addEventListener("focus", onFocus);
      cleanupFns.push(() => {
        focusTarget.removeEventListener("focus", onFocus);
      });
    }

    if (options.contextMenu) {
      const onContextMenu = (event: MouseEvent) => {
        if (event.defaultPrevented) return;
        if (options.contextMenu?.canOpen && !options.contextMenu.canOpen(event, pane)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        options.markPaneFocused(id);
        options.contextMenuController?.show(
          pane,
          event.clientX,
          event.clientY,
          options.getManager(),
        );
      };
      container.addEventListener("contextmenu", onContextMenu);
      cleanupFns.push(() => {
        container.removeEventListener("contextmenu", onContextMenu);
      });
    }

    paneCleanupFns.set(id, cleanupFns);
  };

  const cleanupPaneInteractions = (id: number) => {
    const cleanupFns = paneCleanupFns.get(id) ?? [];
    paneCleanupFns.delete(id);
    for (const cleanup of cleanupFns) {
      cleanup();
    }
  };

  return {
    bindPaneInteractions,
    cleanupPaneInteractions,
  };
}

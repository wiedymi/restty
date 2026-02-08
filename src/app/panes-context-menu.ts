import type {
  ResttyPaneContextMenuItem,
  ResttyPaneContextMenuOptions,
  ResttyPaneDefinition,
  ResttyPaneManager,
} from "./panes-types";

/**
 * Context menu controller for pane right-click interactions.
 * - element: the menu DOM node
 * - isOpen: returns true if menu is currently visible
 * - containsTarget: checks if an event target is inside the menu
 * - show: displays the menu at client coordinates for a given pane
 * - hide: hides the menu
 * - destroy: removes the menu from the DOM
 */
export type PaneContextMenuController<TPane extends ResttyPaneDefinition> = {
  element: HTMLDivElement;
  isOpen: () => boolean;
  containsTarget: (target: EventTarget | null) => boolean;
  show: (pane: TPane, clientX: number, clientY: number, manager: ResttyPaneManager<TPane>) => void;
  hide: () => void;
  destroy: () => void;
};

/** Creates a context menu controller that renders menu items, handles positioning within viewport bounds, and manages click-to-hide behavior. */
export function createPaneContextMenuController<TPane extends ResttyPaneDefinition>(options: {
  contextMenu: ResttyPaneContextMenuOptions<TPane>;
  doc: Document;
  win: Window;
}): PaneContextMenuController<TPane> {
  const contextMenuEl = options.doc.createElement("div");
  contextMenuEl.className = "pane-context-menu";
  contextMenuEl.hidden = true;
  options.doc.body.appendChild(contextMenuEl);

  const hide = () => {
    contextMenuEl.hidden = true;
    contextMenuEl.innerHTML = "";
  };

  const addSeparator = () => {
    const separator = options.doc.createElement("div");
    separator.className = "pane-context-menu-separator";
    contextMenuEl.appendChild(separator);
  };

  const render = (items: Array<ResttyPaneContextMenuItem | "separator">) => {
    contextMenuEl.innerHTML = "";
    for (const item of items) {
      if (item === "separator") {
        addSeparator();
        continue;
      }

      const button = options.doc.createElement("button");
      button.type = "button";
      button.className = "pane-context-menu-item";
      if (item.danger) button.classList.add("is-danger");
      if (item.enabled === false) button.disabled = true;

      const label = options.doc.createElement("span");
      label.className = "pane-context-menu-label";
      label.textContent = item.label;
      button.appendChild(label);

      if (item.shortcut) {
        const shortcut = options.doc.createElement("span");
        shortcut.className = "pane-context-menu-shortcut";
        shortcut.textContent = item.shortcut;
        button.appendChild(shortcut);
      }

      button.addEventListener("click", () => {
        hide();
        void item.action();
      });
      contextMenuEl.appendChild(button);
    }
  };

  const show = (
    pane: TPane,
    clientX: number,
    clientY: number,
    manager: ResttyPaneManager<TPane>,
  ) => {
    const items = options.contextMenu.getItems(pane, manager);
    render(items);
    contextMenuEl.hidden = false;

    const margin = 8;
    const rect = contextMenuEl.getBoundingClientRect();
    const maxX = Math.max(margin, options.win.innerWidth - rect.width - margin);
    const maxY = Math.max(margin, options.win.innerHeight - rect.height - margin);
    const left = Math.min(Math.max(clientX, margin), maxX);
    const top = Math.min(Math.max(clientY, margin), maxY);
    contextMenuEl.style.left = `${left}px`;
    contextMenuEl.style.top = `${top}px`;
  };

  const destroy = () => {
    hide();
    contextMenuEl.remove();
  };

  return {
    element: contextMenuEl,
    isOpen: () => !contextMenuEl.hidden,
    containsTarget: (target) => target instanceof Node && contextMenuEl.contains(target),
    show,
    hide,
    destroy,
  };
}

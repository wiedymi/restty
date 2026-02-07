import type { ResttyApp } from "./types";

export type ResttyPaneSplitDirection = "vertical" | "horizontal";

export type ResttyPaneContextMenuItem = {
  label: string;
  shortcut?: string;
  enabled?: boolean;
  danger?: boolean;
  action: () => void | Promise<void>;
};

export type ResttyPaneDefinition = {
  id: number;
  container: HTMLDivElement;
  focusTarget?: HTMLElement | null;
};

export type ResttyPaneShortcutsOptions = {
  enabled?: boolean;
  canHandleEvent?: (event: KeyboardEvent) => boolean;
  isAllowedInputTarget?: (target: HTMLElement) => boolean;
};

export type ResttyPaneContextMenuOptions<TPane extends ResttyPaneDefinition> = {
  canOpen?: (event: MouseEvent, pane: TPane) => boolean;
  getItems: (
    pane: TPane,
    manager: ResttyPaneManager<TPane>,
  ) => Array<ResttyPaneContextMenuItem | "separator">;
};

export type CreateResttyPaneManagerOptions<TPane extends ResttyPaneDefinition> = {
  root: HTMLElement;
  createPane: (context: {
    id: number;
    sourcePane: TPane | null;
    manager: ResttyPaneManager<TPane>;
  }) => TPane;
  destroyPane?: (pane: TPane) => void;
  onPaneCreated?: (pane: TPane) => void;
  onPaneClosed?: (pane: TPane) => void;
  onPaneSplit?: (
    sourcePane: TPane,
    createdPane: TPane,
    direction: ResttyPaneSplitDirection,
  ) => void;
  onActivePaneChange?: (pane: TPane | null) => void;
  onLayoutChanged?: () => void;
  minPaneSize?: number;
  contextMenu?: ResttyPaneContextMenuOptions<TPane> | null;
  shortcuts?: boolean | ResttyPaneShortcutsOptions;
};

export type ResttyPaneManager<TPane extends ResttyPaneDefinition> = {
  getPanes: () => TPane[];
  getPaneById: (id: number) => TPane | null;
  getActivePane: () => TPane | null;
  getFocusedPane: () => TPane | null;
  createInitialPane: (options?: { focus?: boolean }) => TPane;
  setActivePane: (id: number, options?: { focus?: boolean }) => void;
  markPaneFocused: (id: number, options?: { focus?: boolean }) => void;
  splitPane: (id: number, direction: ResttyPaneSplitDirection) => TPane | null;
  splitActivePane: (direction: ResttyPaneSplitDirection) => TPane | null;
  closePane: (id: number) => boolean;
  requestLayoutSync: () => void;
  hideContextMenu: () => void;
  destroy: () => void;
};

type SplitResizeState = {
  pointerId: number;
  axis: "x" | "y";
  divider: HTMLDivElement;
  first: HTMLElement;
  second: HTMLElement;
  startCoord: number;
  startFirst: number;
  total: number;
};

export type ResttyPaneWithApp = ResttyPaneDefinition & {
  app: ResttyApp;
  paused?: boolean;
  setPaused?: (value: boolean) => void;
};

export type CreateDefaultResttyPaneContextMenuItemsOptions<TPane extends ResttyPaneWithApp> = {
  pane: TPane;
  manager: Pick<ResttyPaneManager<TPane>, "splitPane" | "closePane" | "getPanes">;
  modKeyLabel?: string;
  getPtyUrl?: () => string | null | undefined;
};

export function getResttyShortcutModifierLabel(): "Cmd" | "Ctrl" {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return isMac ? "Cmd" : "Ctrl";
}

export function createDefaultResttyPaneContextMenuItems<TPane extends ResttyPaneWithApp>(
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
        await pane.app.copySelectionToClipboard();
      },
    },
    {
      label: "Paste",
      shortcut: `${mod}+V`,
      action: async () => {
        await pane.app.pasteFromClipboard();
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
        pane.app.clearScreen();
      },
    },
    {
      label: pane.app.isPtyConnected() ? "Disconnect PTY" : "Connect PTY",
      action: () => {
        if (pane.app.isPtyConnected()) {
          pane.app.disconnectPty();
          return;
        }
        const url = (getPtyUrl?.() ?? "").trim();
        pane.app.connectPty(url);
      },
    },
    {
      label: pauseLabel,
      action: () => {
        if (typeof pane.setPaused === "function") {
          pane.setPaused(!(pane.paused ?? false));
          return;
        }
        pane.app.togglePause();
      },
    },
  ];
}

export function createResttyPaneManager<TPane extends ResttyPaneDefinition>(
  options: CreateResttyPaneManagerOptions<TPane>,
): ResttyPaneManager<TPane> {
  const { root, createPane } = options;
  if (!(root instanceof HTMLElement)) {
    throw new Error("createResttyPaneManager requires a root HTMLElement");
  }

  const panes = new Map<number, TPane>();
  const paneCleanupFns = new Map<number, Array<() => void>>();
  const minPaneSize = Number.isFinite(options.minPaneSize)
    ? Math.max(24, Number(options.minPaneSize))
    : 96;
  const shortcutOptions: ResttyPaneShortcutsOptions =
    typeof options.shortcuts === "object"
      ? options.shortcuts
      : { enabled: options.shortcuts !== false };

  let nextPaneId = 1;
  let activePaneId: number | null = null;
  let focusedPaneId: number | null = null;
  let resizeRaf = 0;
  let splitResizeState: SplitResizeState | null = null;

  const contextMenuEl = options.contextMenu ? document.createElement("div") : null;
  if (contextMenuEl) {
    contextMenuEl.className = "pane-context-menu";
    contextMenuEl.hidden = true;
    document.body.appendChild(contextMenuEl);
  }

  const requestLayoutSync = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      options.onLayoutChanged?.();
    });
  };

  const getPanes = () => Array.from(panes.values());

  const getPaneById = (id: number): TPane | null => {
    return panes.get(id) ?? null;
  };

  const findPaneByElement = (element: Element | null): TPane | null => {
    if (!(element instanceof HTMLElement)) return null;
    const host = element.closest(".pane");
    if (!host) return null;
    const id = Number(host.dataset.paneId ?? "");
    if (!Number.isFinite(id)) return null;
    return panes.get(id) ?? null;
  };

  const getActivePane = (): TPane | null => {
    if (activePaneId === null) return null;
    return panes.get(activePaneId) ?? null;
  };

  const getFocusedPane = (): TPane | null => {
    if (focusedPaneId !== null) {
      const focused = panes.get(focusedPaneId);
      if (focused) return focused;
    }
    if (typeof document === "undefined") return null;
    return findPaneByElement(document.activeElement);
  };

  const setActivePane = (id: number, config?: { focus?: boolean }) => {
    const pane = panes.get(id);
    if (!pane) return;
    activePaneId = id;
    for (const current of panes.values()) {
      current.container.classList.toggle("is-active", current.id === id);
    }
    options.onActivePaneChange?.(pane);
    if (config?.focus) {
      const target = pane.focusTarget ?? pane.container;
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    }
  };

  const markPaneFocused = (id: number, config?: { focus?: boolean }) => {
    focusedPaneId = id;
    setActivePane(id, config);
  };

  const getSplitBranches = (split: HTMLElement): HTMLElement[] => {
    const branches: HTMLElement[] = [];
    for (const child of Array.from(split.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.classList.contains("pane-divider")) continue;
      branches.push(child);
    }
    return branches;
  };

  const hideContextMenu = () => {
    if (!contextMenuEl) return;
    contextMenuEl.hidden = true;
    contextMenuEl.innerHTML = "";
  };

  const addContextMenuSeparator = () => {
    if (!contextMenuEl) return;
    const separator = document.createElement("div");
    separator.className = "pane-context-menu-separator";
    contextMenuEl.appendChild(separator);
  };

  const renderContextMenu = (items: Array<ResttyPaneContextMenuItem | "separator">) => {
    if (!contextMenuEl) return;
    contextMenuEl.innerHTML = "";
    for (const item of items) {
      if (item === "separator") {
        addContextMenuSeparator();
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pane-context-menu-item";
      if (item.danger) button.classList.add("is-danger");
      if (item.enabled === false) button.disabled = true;

      const label = document.createElement("span");
      label.className = "pane-context-menu-label";
      label.textContent = item.label;
      button.appendChild(label);

      if (item.shortcut) {
        const shortcut = document.createElement("span");
        shortcut.className = "pane-context-menu-shortcut";
        shortcut.textContent = item.shortcut;
        button.appendChild(shortcut);
      }

      button.addEventListener("click", () => {
        hideContextMenu();
        void item.action();
      });
      contextMenuEl.appendChild(button);
    }
  };

  const showContextMenu = (pane: TPane, clientX: number, clientY: number) => {
    if (!contextMenuEl || !options.contextMenu) return;
    const items = options.contextMenu.getItems(pane, api);
    renderContextMenu(items);
    contextMenuEl.hidden = false;

    const margin = 8;
    const rect = contextMenuEl.getBoundingClientRect();
    const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
    const left = Math.min(Math.max(clientX, margin), maxX);
    const top = Math.min(Math.max(clientY, margin), maxY);
    contextMenuEl.style.left = `${left}px`;
    contextMenuEl.style.top = `${top}px`;
  };

  const bindPaneInteractions = (pane: TPane) => {
    const cleanupFns: Array<() => void> = [];
    const { id, container } = pane;

    const onPointerDown = () => {
      markPaneFocused(id);
    };
    container.addEventListener("pointerdown", onPointerDown);
    cleanupFns.push(() => {
      container.removeEventListener("pointerdown", onPointerDown);
    });

    const focusTarget = pane.focusTarget;
    if (focusTarget) {
      const onFocus = () => {
        markPaneFocused(id);
      };
      focusTarget.addEventListener("focus", onFocus);
      cleanupFns.push(() => {
        focusTarget.removeEventListener("focus", onFocus);
      });
    }

    if (options.contextMenu) {
      const onContextMenu = (event: MouseEvent) => {
        if (options.contextMenu?.canOpen && !options.contextMenu.canOpen(event, pane)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        markPaneFocused(id);
        showContextMenu(pane, event.clientX, event.clientY);
      };
      container.addEventListener("contextmenu", onContextMenu);
      cleanupFns.push(() => {
        container.removeEventListener("contextmenu", onContextMenu);
      });
    }

    paneCleanupFns.set(id, cleanupFns);
  };

  const createSplitDivider = (direction: ResttyPaneSplitDirection): HTMLDivElement => {
    const divider = document.createElement("div");
    divider.className = `pane-divider ${direction === "vertical" ? "is-vertical" : "is-horizontal"}`;
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-orientation", direction === "vertical" ? "vertical" : "horizontal");

    const onPointerMove = (event: PointerEvent) => {
      const state = splitResizeState;
      if (!state || event.pointerId !== state.pointerId) return;
      event.preventDefault();

      const coord = state.axis === "x" ? event.clientX : event.clientY;
      const delta = coord - state.startCoord;
      const maxFirst = Math.max(minPaneSize, state.total - minPaneSize);
      const nextFirst = Math.min(maxFirst, Math.max(minPaneSize, state.startFirst + delta));
      const nextSecond = Math.max(minPaneSize, state.total - nextFirst);
      const firstPercent = (nextFirst / (nextFirst + nextSecond)) * 100;
      const secondPercent = 100 - firstPercent;
      state.first.style.flex = `0 0 ${firstPercent.toFixed(5)}%`;
      state.second.style.flex = `0 0 ${secondPercent.toFixed(5)}%`;
      requestLayoutSync();
    };

    const endResize = () => {
      if (!splitResizeState) return;
      splitResizeState.divider.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-split");
      splitResizeState = null;
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (!splitResizeState || event.pointerId !== splitResizeState.pointerId) return;
      try {
        divider.releasePointerCapture(splitResizeState.pointerId);
      } catch {
        // ignore capture release errors
      }
      divider.removeEventListener("pointermove", onPointerMove);
      divider.removeEventListener("pointerup", onPointerEnd);
      divider.removeEventListener("pointercancel", onPointerEnd);
      endResize();
    };

    divider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const first = divider.previousElementSibling as HTMLElement | null;
      const second = divider.nextElementSibling as HTMLElement | null;
      const split = divider.parentElement as HTMLElement | null;
      if (!first || !second || !split) return;

      const splitRect = split.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const axis: "x" | "y" = direction === "vertical" ? "x" : "y";
      const total = axis === "x" ? splitRect.width : splitRect.height;
      if (total <= 0) return;

      endResize();
      event.preventDefault();
      event.stopPropagation();

      splitResizeState = {
        pointerId: event.pointerId,
        axis,
        divider,
        first,
        second,
        startCoord: axis === "x" ? event.clientX : event.clientY,
        startFirst: axis === "x" ? firstRect.width : firstRect.height,
        total,
      };

      divider.classList.add("is-dragging");
      document.body.classList.add("is-resizing-split");
      divider.setPointerCapture(event.pointerId);
      divider.addEventListener("pointermove", onPointerMove);
      divider.addEventListener("pointerup", onPointerEnd);
      divider.addEventListener("pointercancel", onPointerEnd);
    });

    return divider;
  };

  const createPaneInternal = (sourcePane: TPane | null): TPane => {
    const id = nextPaneId;
    nextPaneId += 1;

    const pane = createPane({ id, sourcePane, manager: api });
    if (pane.id !== id) {
      throw new Error(`createResttyPaneManager expected pane.id=${id}, received ${pane.id}`);
    }
    if (!(pane.container instanceof HTMLDivElement)) {
      throw new Error(
        "createResttyPaneManager createPane() must return { container: HTMLDivElement }",
      );
    }

    pane.container.classList.add("pane");
    pane.container.dataset.paneId = `${id}`;

    panes.set(id, pane);
    bindPaneInteractions(pane);
    options.onPaneCreated?.(pane);
    return pane;
  };

  const collapseSplitAncestors = (start: HTMLElement | null) => {
    let current = start;
    while (current && current.classList.contains("pane-split")) {
      const branches = getSplitBranches(current);
      if (branches.length > 1) return;
      const onlyChild = branches[0];
      const parent = current.parentElement;
      if (!parent || !onlyChild) return;
      const inheritedFlex = current.style.flex;
      if (inheritedFlex) {
        onlyChild.style.flex = inheritedFlex;
      } else {
        onlyChild.style.flex = "";
      }
      parent.replaceChild(onlyChild, current);
      current = parent;
    }
  };

  const splitPane = (id: number, direction: ResttyPaneSplitDirection): TPane | null => {
    const target = panes.get(id);
    if (!target) return null;
    const parent = target.container.parentElement;
    if (!parent) return null;

    const split = document.createElement("div");
    split.className = `pane-split ${direction === "vertical" ? "is-vertical" : "is-horizontal"}`;
    const inheritedFlex = target.container.style.flex;
    if (inheritedFlex) {
      split.style.flex = inheritedFlex;
    }

    parent.replaceChild(split, target.container);
    target.container.style.flex = "0 0 50%";
    split.appendChild(target.container);
    split.appendChild(createSplitDivider(direction));

    const created = createPaneInternal(target);
    created.container.style.flex = "0 0 50%";
    split.appendChild(created.container);

    markPaneFocused(created.id, { focus: true });
    requestLayoutSync();
    options.onPaneSplit?.(target, created, direction);
    return created;
  };

  const splitActivePane = (direction: ResttyPaneSplitDirection): TPane | null => {
    const target = getFocusedPane() ?? getActivePane();
    if (!target) return null;
    return splitPane(target.id, direction);
  };

  const closePane = (id: number): boolean => {
    if (panes.size <= 1) return false;
    const pane = panes.get(id);
    if (!pane) return false;

    const cleanupFns = paneCleanupFns.get(id) ?? [];
    paneCleanupFns.delete(id);
    for (const cleanup of cleanupFns) {
      cleanup();
    }

    options.destroyPane?.(pane);
    panes.delete(id);
    if (activePaneId === id) activePaneId = null;
    if (focusedPaneId === id) focusedPaneId = null;

    const parent = pane.container.parentElement as HTMLElement | null;
    pane.container.remove();
    collapseSplitAncestors(parent);

    const fallback = getActivePane() ?? getPanes()[0] ?? null;
    if (fallback) {
      markPaneFocused(fallback.id, { focus: true });
    } else {
      options.onActivePaneChange?.(null);
    }
    options.onPaneClosed?.(pane);
    requestLayoutSync();
    return true;
  };

  const createInitialPane = (config?: { focus?: boolean }): TPane => {
    if (panes.size) {
      return getPanes()[0] as TPane;
    }
    const first = createPaneInternal(null);
    root.appendChild(first.container);
    markPaneFocused(first.id, { focus: config?.focus !== false });
    requestLayoutSync();
    return first;
  };

  const onWindowPointerDown = (event: PointerEvent) => {
    if (!contextMenuEl || contextMenuEl.hidden) return;
    if (event.target instanceof Node && contextMenuEl.contains(event.target)) return;
    hideContextMenu();
  };

  const onWindowBlur = () => {
    hideContextMenu();
  };

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (contextMenuEl && !contextMenuEl.hidden && event.key === "Escape") {
      hideContextMenu();
      return;
    }

    if (shortcutOptions.enabled === false) return;
    if (shortcutOptions.canHandleEvent && !shortcutOptions.canHandleEvent(event)) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) {
      const allowed = shortcutOptions.isAllowedInputTarget?.(target) ?? false;
      if (!allowed) return;
    }

    const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    const hasCommandModifier = isMac ? event.metaKey : event.ctrlKey;
    if (!hasCommandModifier || event.altKey || event.code !== "KeyD" || event.repeat) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    splitActivePane(event.shiftKey ? "horizontal" : "vertical");
  };

  window.addEventListener("pointerdown", onWindowPointerDown);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("keydown", onWindowKeyDown, { capture: true });

  const destroy = () => {
    window.removeEventListener("pointerdown", onWindowPointerDown);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("keydown", onWindowKeyDown, { capture: true });

    if (resizeRaf) {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
    }

    for (const pane of getPanes()) {
      const cleanupFns = paneCleanupFns.get(pane.id) ?? [];
      for (const cleanup of cleanupFns) {
        cleanup();
      }
      paneCleanupFns.delete(pane.id);
      options.destroyPane?.(pane);
    }
    panes.clear();
    activePaneId = null;
    focusedPaneId = null;
    root.replaceChildren();

    hideContextMenu();
    contextMenuEl?.remove();
  };

  const api: ResttyPaneManager<TPane> = {
    getPanes,
    getPaneById,
    getActivePane,
    getFocusedPane,
    createInitialPane,
    setActivePane,
    markPaneFocused,
    splitPane,
    splitActivePane,
    closePane,
    requestLayoutSync,
    hideContextMenu,
    destroy,
  };

  return api;
}

import { createPaneContextMenuController } from "./context-menu";
import {
  DEFAULT_RESTTY_PANE_STYLE_OPTIONS,
  applyPaneStyleOptionsToRoot,
  clearPaneStyleOptionsFromRoot,
  ensureResttyPaneStylesDocument,
  normalizePaneStyleOptions,
} from "./styles";
import type {
  CreateResttyPaneManagerOptions,
  ResttyPaneDefinition,
  ResttyPaneManager,
  ResttyPaneShortcutsOptions,
  ResttyPaneStyleOptions,
  ResttyPaneSplitDirection,
} from "./types";
import { collapseSplitAncestors, createSplitDividerFactory, findClosestPaneToRect } from "./layout";
import { createPaneInteractions } from "./pane-interactions";
import { attachPaneManagerWindowEvents } from "./window-events";

export function createResttyPaneManager<TPane extends ResttyPaneDefinition>(
  options: CreateResttyPaneManagerOptions<TPane>,
): ResttyPaneManager<TPane> {
  const { root, createPane } = options;
  const isElementLike =
    typeof HTMLElement !== "undefined"
      ? root instanceof HTMLElement
      : !!root && typeof (root as { ownerDocument?: unknown }).ownerDocument !== "undefined";
  if (!isElementLike) {
    throw new Error("createResttyPaneManager requires a root HTMLElement");
  }

  const panes = new Map<number, TPane>();
  const minPaneSize = Number.isFinite(options.minPaneSize)
    ? Math.max(24, Number(options.minPaneSize))
    : 96;
  const shortcutOptions: ResttyPaneShortcutsOptions =
    typeof options.shortcuts === "object"
      ? options.shortcuts
      : { enabled: options.shortcuts !== false };
  const stylesInput =
    typeof options.styles === "object" && options.styles ? options.styles : undefined;
  const stylesEnabled = options.styles === false ? false : (stylesInput?.enabled ?? true);
  let styleOptions = normalizePaneStyleOptions({
    ...DEFAULT_RESTTY_PANE_STYLE_OPTIONS,
    ...stylesInput,
  });

  if (stylesEnabled) {
    const doc = root.ownerDocument ?? document;
    ensureResttyPaneStylesDocument(doc);
    applyPaneStyleOptionsToRoot(root, styleOptions);
  }

  let nextPaneId = 1;
  let activePaneId: number | null = null;
  let focusedPaneId: number | null = null;
  let resizeRaf = 0;

  const ownerDoc = root.ownerDocument ?? document;
  const ownerWin = ownerDoc.defaultView ?? window;
  const contextMenuController = options.contextMenu
    ? createPaneContextMenuController({
        contextMenu: options.contextMenu,
        doc: ownerDoc,
        win: ownerWin,
      })
    : null;

  const requestLayoutSync = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      options.onLayoutChanged?.();
    });
  };

  const { createSplitDivider } = createSplitDividerFactory({ minPaneSize, requestLayoutSync });

  const getStyleOptions = (): Readonly<Required<ResttyPaneStyleOptions>> => ({
    ...styleOptions,
  });

  const setStyleOptions = (next: ResttyPaneStyleOptions) => {
    styleOptions = normalizePaneStyleOptions({
      ...styleOptions,
      ...next,
    });
    if (!stylesEnabled) return;
    applyPaneStyleOptionsToRoot(root, styleOptions);
  };

  const getPanes = () => Array.from(panes.values());

  const getPaneById = (id: number): TPane | null => panes.get(id) ?? null;

  const findPaneByElement = (element: Element | null): TPane | null => {
    if (!(element instanceof HTMLElement)) return null;
    const host = element.closest(".pane");
    if (!host) return null;
    const id = Number(host.dataset.paneId ?? "");
    if (!Number.isFinite(id)) return null;
    return panes.get(id) ?? null;
  };

  const getActivePane = (): TPane | null =>
    activePaneId === null ? null : (panes.get(activePaneId) ?? null);

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

  const hideContextMenu = () => contextMenuController?.hide();

  let api: ResttyPaneManager<TPane>;
  const paneInteractions = createPaneInteractions({
    contextMenu: options.contextMenu,
    contextMenuController,
    getManager: () => api,
    markPaneFocused,
  });

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
    paneInteractions.bindPaneInteractions(pane);
    options.onPaneCreated?.(pane);
    return pane;
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
    const closingRect = pane.container.getBoundingClientRect();

    paneInteractions.cleanupPaneInteractions(id);

    options.destroyPane?.(pane);
    panes.delete(id);
    if (activePaneId === id) activePaneId = null;
    if (focusedPaneId === id) focusedPaneId = null;

    const parent = pane.container.parentElement as HTMLElement | null;
    pane.container.remove();
    collapseSplitAncestors(parent);

    const fallback =
      getActivePane() ??
      findClosestPaneToRect(closingRect, panes.values()) ??
      getPanes()[0] ??
      null;
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

  const removeWindowEvents = attachPaneManagerWindowEvents({
    contextMenuController,
    hideContextMenu,
    shortcutOptions,
    splitActivePane,
  });

  const destroy = () => {
    removeWindowEvents();

    if (resizeRaf) {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
    }

    for (const pane of getPanes()) {
      paneInteractions.cleanupPaneInteractions(pane.id);
      options.destroyPane?.(pane);
    }
    panes.clear();
    activePaneId = null;
    focusedPaneId = null;
    root.replaceChildren();

    hideContextMenu();
    contextMenuController?.destroy();

    if (stylesEnabled) {
      clearPaneStyleOptionsFromRoot(root);
    }
  };

  api = {
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
    getStyleOptions,
    setStyleOptions,
    requestLayoutSync,
    hideContextMenu,
    destroy,
  };

  return api;
}

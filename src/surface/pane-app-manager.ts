import { type ResttyPaneManager } from "./panes-types";
import { createResttyPaneManager } from "./panes/manager";
import { createManagedPane } from "./panes/managed-pane-create";
import {
  resolveManagedPaneContextMenu,
  resolveManagedPaneShortcuts,
} from "./panes/managed-pane-options";
import { getDefaultResttyRuntimeSession } from "../runtime/core/session";
import type { PaneSearchUiController } from "./pane-search-ui";
import { createManagedPaneSearchUiController } from "./panes/managed-pane-search-ui";
import type {
  CreateResttyManagedPaneManagerOptions,
  ResttyManagedPaneManager,
  ResttyManagedPane,
} from "./panes/managed-pane-types";

/**
 * Create a managed-pane manager that automatically constructs
 * canvas, IME input, and terminal runtime instances for each pane.
 */
export function createResttyManagedPaneManager(
  options: CreateResttyManagedPaneManagerOptions,
): ResttyManagedPaneManager {
  const session = options.session ?? getDefaultResttyRuntimeSession();
  const autoInit = options.autoInit ?? true;

  const paneClassName = options.paneDom?.paneClassName ?? "pane";
  const canvasClassName = options.paneDom?.canvasClassName ?? "pane-canvas";
  const imeInputClassName =
    options.paneDom?.imeInputClassName ?? "pane-ime-input restty-pane-ime-input";
  const contextMenu = resolveManagedPaneContextMenu(options);
  const shortcuts = resolveManagedPaneShortcuts(options.shortcuts);

  let manager: ResttyPaneManager<ResttyManagedPane>;
  const searchUiController: PaneSearchUiController = createManagedPaneSearchUiController({
    root: options.root,
    searchUi: options.searchUi,
    getActivePane: () => manager.getActivePane(),
    getFocusedPane: () => manager.getFocusedPane(),
  });

  manager = createResttyPaneManager<ResttyManagedPane>({
    root: options.root,
    minPaneSize: options.minPaneSize,
    styles: options.paneStyles,
    shortcuts,
    contextMenu,
    createPane: ({ id, sourcePane }) => {
      const pane = createManagedPane({
        id,
        sourcePane,
        dom: {
          paneClassName,
          canvasClassName,
          imeInputClassName,
        },
        terminal: options.terminal,
        services: options.services,
        session,
        autoInit,
        onSearchState: (state) => {
          searchUiController.handleSearchState(id, state);
        },
      });
      searchUiController.registerPane(pane);

      return pane;
    },
    destroyPane: (pane) => {
      searchUiController.unregisterPane(pane.id);
      pane.app.lifecycle.destroy();
    },
    onPaneCreated: options.onPaneCreated,
    onPaneClosed: options.onPaneClosed,
    onPaneSplit: options.onPaneSplit,
    onActivePaneChange: (pane) => {
      searchUiController.handleActivePaneChange(pane?.id ?? null);
      options.onActivePaneChange?.(pane);
    },
    onLayoutChanged: () => {
      options.onLayoutChanged?.();
    },
  });
  const destroy = () => {
    searchUiController.destroy();
    manager.destroy();
  };

  return {
    ...manager,
    openPaneSearch: (id, config) => {
      searchUiController.open(id, config);
    },
    closePaneSearch: (id, config) => {
      searchUiController.close(id, config);
    },
    togglePaneSearch: (id, config) => {
      searchUiController.toggle(id, config);
    },
    isPaneSearchOpen: (id) => searchUiController.isOpen(id),
    getSearchUiStyleOptions: () => searchUiController.getStyleOptions(),
    setSearchUiStyleOptions: (next) => {
      searchUiController.setStyleOptions(next);
    },
    destroy,
  };
}

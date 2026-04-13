import { type ResttyPaneManager } from "./panes-types";
import { createResttyPaneManager } from "./panes/manager";
import { createManagedPaneDom } from "./panes/managed-pane-dom";
import {
  resolveManagedPaneContextMenu,
  resolveManagedPaneShortcuts,
} from "./panes/managed-pane-options";
import { createManagedPaneRuntime } from "./panes/managed-pane-runtime";
import { getDefaultResttyAppSession } from "../runtime/session";
import type { PaneSearchUiController } from "./pane-search-ui";
import { createManagedPaneSearchUiController } from "./panes/managed-pane-search-ui";
import type {
  CreateResttyAppPaneManagerOptions,
  ResttyAppPaneManager,
  ResttyManagedAppPane,
} from "./panes/managed-pane-types";

export type {
  CreateResttyAppPaneManagerOptions,
  ResttyAppPaneManager,
  ResttyDefaultPaneContextMenuOptions,
  ResttyManagedAppPane,
  ResttyManagedPaneSearchUiOptions,
  ResttyManagedPaneSearchUiStyleOptions,
  ResttyManagedPaneStyleOptions,
  ResttyManagedPaneStylesOptions,
  ResttyPaneDomDefaults,
  ResttyPaneRuntimeContext,
  ResttyRuntimeServicesConfigInput,
  ResttyTerminalConfigInput,
} from "./panes/managed-pane-types";

/**
 * Create an app-aware pane manager that automatically constructs
 * canvas, IME input, and terminal app instances for each pane.
 */
export function createResttyAppPaneManager(
  options: CreateResttyAppPaneManagerOptions,
): ResttyAppPaneManager {
  const session = options.session ?? getDefaultResttyAppSession();
  const autoInit = options.autoInit ?? true;

  const paneClassName = options.paneDom?.paneClassName ?? "pane";
  const canvasClassName = options.paneDom?.canvasClassName ?? "pane-canvas";
  const imeInputClassName =
    options.paneDom?.imeInputClassName ?? "pane-ime-input restty-pane-ime-input";
  const termDebugClassName = options.paneDom?.termDebugClassName ?? "pane-term-debug";
  const contextMenu = resolveManagedPaneContextMenu(options);
  const shortcuts = resolveManagedPaneShortcuts(options.shortcuts);

  let manager: ResttyPaneManager<ResttyManagedAppPane>;
  const searchUiController: PaneSearchUiController = createManagedPaneSearchUiController({
    root: options.root,
    searchUi: options.searchUi,
    getActivePane: () => manager.getActivePane(),
    getFocusedPane: () => manager.getFocusedPane(),
  });

  manager = createResttyPaneManager<ResttyManagedAppPane>({
    root: options.root,
    minPaneSize: options.minPaneSize,
    styles: options.paneStyles,
    shortcuts,
    contextMenu,
    createPane: ({ id, sourcePane }) => {
      const { container, canvas, imeInput, termDebugEl } = createManagedPaneDom({
        paneClassName,
        canvasClassName,
        imeInputClassName,
        termDebugClassName,
      });

      const context = { id, sourcePane, canvas, imeInput, termDebugEl };
      const app = createManagedPaneRuntime({
        context,
        terminal: options.terminal,
        services: options.services,
        session,
        autoInit,
        onSearchState: (state) => {
          searchUiController.handleSearchState(id, state);
        },
      });

      const pane = {
        id,
        container,
        focusTarget: canvas,
        app,
        canvas,
        imeInput,
        termDebugEl,
      };
      searchUiController.registerPane(pane);

      return pane;
    },
    destroyPane: (pane) => {
      searchUiController.unregisterPane(pane.id);
      pane.app.destroy();
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

import {
  type ResttyPaneContextMenuOptions,
  type ResttyPaneManager,
  type ResttyPaneShortcutsOptions,
} from "./panes-types";
import { createDefaultResttyPaneContextMenuItems } from "./panes/default-context-menu-items";
import { createResttyPaneManager } from "./panes/manager";
import { createManagedPaneDom } from "./panes/managed-pane-dom";
import { getDefaultResttyAppSession } from "../runtime/session";
import { createResttyRuntime } from "./app-factory";
import type { ResttyAppCallbacks, ResttyRuntimeConfig } from "../runtime/types";
import {
  createPaneSearchUiController,
  type PaneSearchUiController,
  type ResttyPaneSearchUiCloseOptions,
  type ResttyPaneSearchUiOpenOptions,
  type ResttyPaneSearchUiStyleOptions,
} from "./pane-search-ui";
import type {
  CreateResttyAppPaneManagerOptions,
  ResttyAppPaneManager,
  ResttyDefaultPaneContextMenuOptions,
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

function defaultInputTargetPredicate(target: HTMLElement): boolean {
  return (
    target.classList.contains("pane-ime-input") ||
    target.classList.contains("restty-pane-ime-input")
  );
}

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

  let contextMenu = options.contextMenu ?? null;
  if (!contextMenu) {
    const defaultMenuConfig = options.defaultContextMenu;
    const enabled =
      defaultMenuConfig === undefined
        ? true
        : typeof defaultMenuConfig === "boolean"
          ? defaultMenuConfig
          : (defaultMenuConfig.enabled ?? true);

    if (enabled) {
      const config =
        typeof defaultMenuConfig === "object" && defaultMenuConfig ? defaultMenuConfig : undefined;
      contextMenu = {
        canOpen: config?.canOpen,
        getItems: (pane, manager) =>
          createDefaultResttyPaneContextMenuItems({
            pane,
            manager,
            modKeyLabel: config?.modKeyLabel,
            getPtyUrl: config?.getPtyUrl,
          }),
      };
    }
  }

  let shortcuts = options.shortcuts;
  if (shortcuts === undefined || shortcuts === true) {
    shortcuts = {
      enabled: true,
      isAllowedInputTarget: defaultInputTargetPredicate,
    };
  } else if (typeof shortcuts === "object" && !shortcuts.isAllowedInputTarget) {
    shortcuts = {
      ...shortcuts,
      isAllowedInputTarget: defaultInputTargetPredicate,
    };
  }

  let manager: ResttyPaneManager<ResttyManagedAppPane>;
  const searchUiConfig =
    typeof options.searchUi === "object" && options.searchUi ? options.searchUi : undefined;
  const searchUiController: PaneSearchUiController = createPaneSearchUiController({
    root: options.root,
    enabled: options.searchUi === false ? false : (searchUiConfig?.enabled ?? true),
    placeholder: searchUiConfig?.placeholder,
    previousButtonText: searchUiConfig?.previousButtonText,
    nextButtonText: searchUiConfig?.nextButtonText,
    clearButtonText: searchUiConfig?.clearButtonText,
    closeButtonText: searchUiConfig?.closeButtonText,
    statusFormatter: searchUiConfig?.statusFormatter,
    shortcut: searchUiConfig?.shortcut,
    styles: searchUiConfig?.styles,
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
      const baseTerminal =
        typeof options.terminal === "function"
          ? options.terminal(context)
          : (options.terminal ?? {});
      const baseServices =
        typeof options.services === "function"
          ? options.services(context)
          : (options.services ?? {});

      const mergedElements = {
        ...baseServices.elements,
        termDebugEl: baseServices.elements?.termDebugEl ?? termDebugEl,
      };
      const mergedCallbacks: ResttyAppCallbacks = {
        ...baseServices.callbacks,
        onSearchState: (state) => {
          baseServices.callbacks?.onSearchState?.(state);
          searchUiController.handleSearchState(id, state);
        },
      };
      const runtimeOptions: ResttyRuntimeConfig = {
        ...baseTerminal,
        ...baseServices,
        canvas,
        imeInput,
        session,
        elements: mergedElements,
        callbacks: mergedCallbacks,
      };

      const app = createResttyRuntime(runtimeOptions);

      if (autoInit) {
        void app.init();
      }

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

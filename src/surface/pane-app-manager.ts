import {
  type ResttyPaneStyleOptions,
  type ResttyPaneStylesOptions,
  type ResttyPaneContextMenuOptions,
  type ResttyPaneManager,
  type ResttyPaneShortcutsOptions,
  type ResttyPaneWithApp,
} from "./panes-types";
import { createDefaultResttyPaneContextMenuItems } from "./panes/default-context-menu-items";
import { createResttyPaneManager } from "./panes/manager";
import { getDefaultResttyAppSession } from "../runtime/session";
import { createResttyRuntime } from "./app-factory";
import type {
  ResttyAppCallbacks,
  ResttyAppSession,
  ResttyRuntimeConfig,
  ResttyRuntimeServicesConfig,
  ResttyTerminalConfig,
} from "../runtime/types";
import {
  createPaneSearchUiController,
  type PaneSearchUiController,
  type ResttyPaneSearchUiCloseOptions,
  type ResttyPaneSearchUiOpenOptions,
  type ResttyPaneSearchUiOptions,
  type ResttyPaneSearchUiStyleOptions,
} from "./pane-search-ui";

/**
 * A pane created by the app pane manager, extending the base pane
 * with DOM elements needed by the terminal app.
 */
export type ResttyManagedAppPane = ResttyPaneWithApp & {
  /** The canvas element used for terminal rendering. */
  canvas: HTMLCanvasElement;
  /** Hidden textarea for IME composition input. */
  imeInput: HTMLTextAreaElement;
  /** Pre element for terminal debug / accessibility output. */
  termDebugEl: HTMLPreElement;
};

/**
 * Default CSS class names for pane DOM elements.
 */
export type ResttyPaneDomDefaults = {
  paneClassName?: string;
  canvasClassName?: string;
  imeInputClassName?: string;
  termDebugClassName?: string;
};

/** Style options for managed panes (alias for ResttyPaneStyleOptions). */
export type ResttyManagedPaneStyleOptions = ResttyPaneStyleOptions;
/** Style configuration including enabled flag (alias for ResttyPaneStylesOptions). */
export type ResttyManagedPaneStylesOptions = ResttyPaneStylesOptions;
/** Style configuration for the built-in pane search UI. */
export type ResttyManagedPaneSearchUiStyleOptions = ResttyPaneSearchUiStyleOptions;
/** Built-in pane search UI configuration. */
export type ResttyManagedPaneSearchUiOptions = ResttyPaneSearchUiOptions;

/** Pane context passed to per-pane config factories. */
export type ResttyPaneRuntimeContext = {
  id: number;
  sourcePane: ResttyManagedAppPane | null;
  canvas: HTMLCanvasElement;
  imeInput: HTMLTextAreaElement;
  termDebugEl: HTMLPreElement;
};

/** Static or factory terminal behavior config for one pane. */
export type ResttyTerminalConfigInput =
  | ResttyTerminalConfig
  | ((context: ResttyPaneRuntimeContext) => ResttyTerminalConfig);

/** Static or factory runtime services config for one pane. */
export type ResttyRuntimeServicesConfigInput =
  | ResttyRuntimeServicesConfig
  | ((context: ResttyPaneRuntimeContext) => ResttyRuntimeServicesConfig);

export type ResttyAppPaneManager = ResttyPaneManager<ResttyManagedAppPane> & {
  openPaneSearch: (id: number, options?: ResttyPaneSearchUiOpenOptions) => void;
  closePaneSearch: (id: number, options?: ResttyPaneSearchUiCloseOptions) => void;
  togglePaneSearch: (
    id: number,
    options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions,
  ) => void;
  isPaneSearchOpen: (id: number) => boolean;
  getSearchUiStyleOptions: () => Readonly<Required<ResttyPaneSearchUiStyleOptions>>;
  setSearchUiStyleOptions: (options: ResttyPaneSearchUiStyleOptions) => void;
};

/**
 * Configuration for the built-in default context menu.
 */
export type ResttyDefaultPaneContextMenuOptions = {
  /** Whether the default context menu is enabled (default true). */
  enabled?: boolean;
  /** Guard predicate; return false to suppress the menu for a given event. */
  canOpen?: (event: MouseEvent, pane: ResttyManagedAppPane) => boolean;
  /** Override the modifier key label shown in shortcut hints. */
  modKeyLabel?: string;
  /** Provide the PTY WebSocket URL for the connect/disconnect menu item. */
  getPtyUrl?: () => string | null | undefined;
};

/**
 * Options for creating an app-level pane manager that wires up DOM
 * elements, the terminal app, and the shared session automatically.
 */
export type CreateResttyAppPaneManagerOptions = {
  /** Root element that will contain all pane DOM trees. */
  root: HTMLElement;
  /** Shared session for WASM/WebGPU resources (defaults to the global session). */
  session?: ResttyAppSession;
  /** Per-pane terminal behavior config, static object or factory. */
  terminal?: ResttyTerminalConfigInput;
  /** Per-pane runtime services config, static object or factory. */
  services?: ResttyRuntimeServicesConfigInput;
  /** Override default CSS class names for pane DOM elements. */
  paneDom?: ResttyPaneDomDefaults;
  /** Automatically call app.init() after pane creation (default true). */
  autoInit?: boolean;
  /** Minimum pane size in pixels during split-resize (default 96). */
  minPaneSize?: number;
  /** Enable or configure built-in pane CSS styles. */
  paneStyles?: boolean | ResttyManagedPaneStylesOptions;
  /** Enable or configure the built-in pane search UI. */
  searchUi?: boolean | ResttyManagedPaneSearchUiOptions;
  /** Enable or configure keyboard shortcuts for splitting. */
  shortcuts?: boolean | ResttyPaneShortcutsOptions;
  /** Custom context menu implementation (overrides defaultContextMenu). */
  contextMenu?: ResttyPaneContextMenuOptions<ResttyManagedAppPane> | null;
  /** Enable or configure the built-in default context menu. */
  defaultContextMenu?: boolean | ResttyDefaultPaneContextMenuOptions;
  /** Called after a new pane is created. */
  onPaneCreated?: (pane: ResttyManagedAppPane) => void;
  /** Called after a pane is closed. */
  onPaneClosed?: (pane: ResttyManagedAppPane) => void;
  /** Called after a pane is split. */
  onPaneSplit?: (
    sourcePane: ResttyManagedAppPane,
    createdPane: ResttyManagedAppPane,
    direction: "vertical" | "horizontal",
  ) => void;
  /** Called when the active pane changes (or becomes null). */
  onActivePaneChange?: (pane: ResttyManagedAppPane | null) => void;
  /** Called when the layout changes (splits, closes, resizes). */
  onLayoutChanged?: () => void;
};

function createImeInput(className: string): HTMLTextAreaElement {
  const imeInput = document.createElement("textarea");
  imeInput.className = className;
  imeInput.tabIndex = -1;
  imeInput.autocapitalize = "off";
  imeInput.autocomplete = "off";
  imeInput.autocorrect = "off";
  imeInput.spellcheck = false;
  imeInput.style.position = "fixed";
  imeInput.style.left = "0";
  imeInput.style.top = "0";
  imeInput.style.width = "1em";
  imeInput.style.height = "1em";
  imeInput.style.padding = "0";
  imeInput.style.margin = "0";
  imeInput.style.border = "0";
  imeInput.style.outline = "none";
  imeInput.style.background = "transparent";
  imeInput.style.color = "transparent";
  imeInput.style.caretColor = "transparent";
  imeInput.style.overflow = "hidden";
  imeInput.style.resize = "none";
  imeInput.style.opacity = "0";
  imeInput.style.pointerEvents = "none";
  return imeInput;
}

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
      const container = document.createElement("div");
      container.className = paneClassName;

      const canvas = document.createElement("canvas");
      canvas.className = canvasClassName;
      canvas.tabIndex = 0;

      const imeInput = createImeInput(imeInputClassName);

      const termDebugEl = document.createElement("pre");
      termDebugEl.className = termDebugClassName;
      termDebugEl.setAttribute("aria-live", "polite");

      container.append(canvas, imeInput, termDebugEl);

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

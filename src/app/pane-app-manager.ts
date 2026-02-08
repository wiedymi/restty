import {
  createDefaultResttyPaneContextMenuItems,
  createResttyPaneManager,
  type ResttyPaneStyleOptions,
  type ResttyPaneStylesOptions,
  type ResttyPaneContextMenuOptions,
  type ResttyPaneManager,
  type ResttyPaneShortcutsOptions,
  type ResttyPaneWithApp,
} from "./panes";
import { getDefaultResttyAppSession } from "./session";
import { createResttyApp } from "./index";
import type { ResttyAppOptions, ResttyAppSession } from "./types";

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

/** App options minus the DOM/session fields that the pane manager provides. */
export type ResttyPaneAppOptionsInput = Omit<ResttyAppOptions, "canvas" | "imeInput" | "session">;

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
  /** Per-pane app options, static object or factory receiving pane context. */
  appOptions?:
    | ResttyPaneAppOptionsInput
    | ((context: {
        id: number;
        sourcePane: ResttyManagedAppPane | null;
        canvas: HTMLCanvasElement;
        imeInput: HTMLTextAreaElement;
        termDebugEl: HTMLPreElement;
      }) => ResttyPaneAppOptionsInput);
  /** Override default CSS class names for pane DOM elements. */
  paneDom?: ResttyPaneDomDefaults;
  /** Automatically call app.init() after pane creation (default true). */
  autoInit?: boolean;
  /** Minimum pane size in pixels during split-resize (default 96). */
  minPaneSize?: number;
  /** Enable or configure built-in pane CSS styles. */
  paneStyles?: boolean | ResttyManagedPaneStylesOptions;
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
  imeInput.autocapitalize = "off";
  imeInput.autocomplete = "off";
  imeInput.autocorrect = "off";
  imeInput.spellcheck = false;
  imeInput.setAttribute("aria-hidden", "true");
  imeInput.style.position = "fixed";
  imeInput.style.left = "0";
  imeInput.style.top = "0";
  imeInput.style.width = "1px";
  imeInput.style.height = "1px";
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
): ResttyPaneManager<ResttyManagedAppPane> {
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

  const manager = createResttyPaneManager<ResttyManagedAppPane>({
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

      const baseOptions =
        typeof options.appOptions === "function"
          ? options.appOptions({ id, sourcePane, canvas, imeInput, termDebugEl })
          : (options.appOptions ?? {});

      const mergedElements = {
        ...baseOptions.elements,
        termDebugEl: baseOptions.elements?.termDebugEl ?? termDebugEl,
      };

      const app = createResttyApp({
        ...baseOptions,
        canvas,
        imeInput,
        session,
        elements: mergedElements,
      });

      if (autoInit) {
        void app.init();
      }

      return {
        id,
        container,
        focusTarget: canvas,
        app,
        canvas,
        imeInput,
        termDebugEl,
      };
    },
    destroyPane: (pane) => {
      pane.app.destroy();
    },
    onPaneCreated: options.onPaneCreated,
    onPaneClosed: options.onPaneClosed,
    onPaneSplit: options.onPaneSplit,
    onActivePaneChange: options.onActivePaneChange,
    onLayoutChanged: () => {
      options.onLayoutChanged?.();
    },
  });

  return manager;
}

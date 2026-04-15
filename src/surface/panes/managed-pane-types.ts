import type {
  ResttyPaneContextMenuOptions,
  ResttyPaneManager,
  ResttyPaneShortcutsOptions,
  ResttyPaneStyleOptions,
  ResttyPaneStylesOptions,
  ResttyPaneWithManagedRuntime,
  ResttyPaneWithRuntimeActions,
} from "./types";
import type { ResttyRuntimeServicesConfig, ResttyTerminalConfig } from "../../runtime/core/config";
import type { ResttyRuntimeSession } from "../../runtime/core/resources";
import type {
  ResttyPaneSearchUiCloseOptions,
  ResttyPaneSearchUiOpenOptions,
  ResttyPaneSearchUiOptions,
  ResttyPaneSearchUiStyleOptions,
} from "../search-ui";

/**
 * A pane created by the managed-pane manager, extending the base pane
 * with DOM elements needed by the terminal runtime.
 */
export type ResttyManagedPane = ResttyPaneWithManagedRuntime & {
  /** The canvas element used for terminal rendering. */
  canvas: HTMLCanvasElement;
  /** Hidden textarea for IME composition input. */
  imeInput: HTMLTextAreaElement;
};

/**
 * Default CSS class names for pane DOM elements.
 */
export type ResttyPaneDomDefaults = {
  paneClassName?: string;
  canvasClassName?: string;
  imeInputClassName?: string;
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
  sourcePane: ResttyManagedPane | null;
  canvas: HTMLCanvasElement;
  imeInput: HTMLTextAreaElement;
};

/** Static or factory terminal behavior config for one pane. */
export type ResttyTerminalConfigInput =
  | ResttyTerminalConfig
  | ((context: ResttyPaneRuntimeContext) => ResttyTerminalConfig);

/** Static or factory runtime services config for one pane. */
export type ResttyRuntimeServicesConfigInput =
  | ResttyRuntimeServicesConfig
  | ((context: ResttyPaneRuntimeContext) => ResttyRuntimeServicesConfig);

export type ResttyManagedPaneManager = ResttyPaneManager<ResttyManagedPane> & {
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
  canOpen?: (event: MouseEvent, pane: ResttyPaneWithRuntime) => boolean;
  /** Override the modifier key label shown in shortcut hints. */
  modKeyLabel?: string;
  /** Provide the PTY WebSocket URL for the connect/disconnect menu item. */
  getPtyUrl?: () => string | null | undefined;
};

/**
 * Options for creating a managed-pane manager that wires up DOM
 * elements, the terminal runtime, and the shared session automatically.
 */
export type CreateResttyManagedPaneManagerOptions = {
  /** Root element that will contain all pane DOM trees. */
  root: HTMLElement;
  /** Shared session for WASM/WebGPU resources (defaults to the global session). */
  session?: ResttyRuntimeSession;
  /** Per-pane terminal behavior config, static object or factory. */
  terminal?: ResttyTerminalConfigInput;
  /** Per-pane runtime services config, static object or factory. */
  services?: ResttyRuntimeServicesConfigInput;
  /** Override default CSS class names for pane DOM elements. */
  paneDom?: ResttyPaneDomDefaults;
  /** Automatically call runtime.lifecycle.init() after pane creation (default true). */
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
  contextMenu?: ResttyPaneContextMenuOptions<ResttyManagedPane> | null;
  /** Enable or configure the built-in default context menu. */
  defaultContextMenu?: boolean | ResttyDefaultPaneContextMenuOptions;
  /** Called after a new pane is created. */
  onPaneCreated?: (pane: ResttyManagedPane) => void;
  /** Called after a pane is closed. */
  onPaneClosed?: (pane: ResttyManagedPane) => void;
  /** Called after a pane is split. */
  onPaneSplit?: (
    sourcePane: ResttyManagedPane,
    createdPane: ResttyManagedPane,
    direction: "vertical" | "horizontal",
  ) => void;
  /** Called when the active pane changes (or becomes null). */
  onActivePaneChange?: (pane: ResttyManagedPane | null) => void;
  /** Called when the layout changes (splits, closes, resizes). */
  onLayoutChanged?: () => void;
};

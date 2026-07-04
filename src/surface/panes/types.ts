import type {
  ResttyRuntime,
  ResttyRuntimeInteractionApi,
  ResttyRuntimeIoApi,
  ResttyRuntimeRenderApi,
  ResttyRuntimeSearchApi,
  ResttyRuntimeTerminalApi,
} from "../runtime/core/api";

/**
 * Direction for splitting a pane.
 * - vertical: split left/right
 * - horizontal: split top/bottom
 */
export type ResttyPaneSplitDirection = "vertical" | "horizontal";

/**
 * A single item in a pane context menu.
 */
export type ResttyPaneContextMenuItem = {
  /** Display text for the menu item. */
  label: string;
  /** Keyboard shortcut hint shown alongside the label. */
  shortcut?: string;
  /** Whether the item is interactive (default true). */
  enabled?: boolean;
  /** Render the item with destructive/warning styling. */
  danger?: boolean;
  /** Callback invoked when the item is selected. */
  action: () => void | Promise<void>;
};

/**
 * Minimum definition of a pane managed by the pane manager.
 */
export type ResttyPaneDefinition = {
  /** Unique numeric identifier for this pane. */
  id: number;
  /** DOM container element that holds the pane content. */
  container: HTMLDivElement;
  /** Element to receive focus when the pane is activated. */
  focusTarget?: HTMLElement | null;
};

/**
 * Configuration for pane keyboard shortcuts.
 */
export type ResttyPaneShortcutsOptions = {
  /** Enable or disable shortcut handling (default true). */
  enabled?: boolean;
  /** Guard that determines whether a keyboard event should be handled. */
  canHandleEvent?: (event: KeyboardEvent) => boolean;
  /** Guard that determines whether the event target is an allowed input element. */
  isAllowedInputTarget?: (target: HTMLElement) => boolean;
};

/**
 * Configuration for the pane right-click context menu.
 */
export type ResttyPaneContextMenuOptions<TPane extends ResttyPaneDefinition> = {
  /** Guard that determines whether the context menu may open for a given event and pane. */
  canOpen?: (event: MouseEvent, pane: TPane) => boolean;
  /** Build the list of menu items and separators for a pane. */
  getItems: (
    pane: TPane,
    manager: ResttyPaneManager<TPane>,
  ) => Array<ResttyPaneContextMenuItem | "separator">;
};

/**
 * Visual styling options for pane layout and dividers.
 */
export type ResttyPaneStyleOptions = {
  /** CSS background color for the split container. */
  splitBackground?: string;
  /** CSS background color for individual panes. */
  paneBackground?: string;
  /** Opacity applied to inactive panes (0-1). */
  inactivePaneOpacity?: number;
  /** Opacity applied to the active pane (0-1). */
  activePaneOpacity?: number;
  /** Duration in ms for opacity transitions between active/inactive states. */
  opacityTransitionMs?: number;
  /** CSS color for the visible split divider. */
  dividerColor?: string;
  /** Divider/gutter thickness in CSS pixels. */
  dividerThicknessPx?: number;
};

/**
 * Pane style options with an enable/disable toggle.
 */
export type ResttyPaneStylesOptions = ResttyPaneStyleOptions & {
  /** Enable or disable automatic pane styling (default true). */
  enabled?: boolean;
};

/**
 * Options for creating a pane manager instance.
 */
export type CreateResttyPaneManagerOptions<TPane extends ResttyPaneDefinition> = {
  /** Root DOM element that contains all pane containers. */
  root: HTMLElement;
  /** Factory function called to create a new pane. */
  createPane: (context: {
    id: number;
    sourcePane: TPane | null;
    manager: ResttyPaneManager<TPane>;
  }) => TPane;
  /** Cleanup function called when a pane is removed. */
  destroyPane?: (pane: TPane) => void;
  /** Called after a new pane has been created and inserted into the layout. */
  onPaneCreated?: (pane: TPane) => void;
  /** Called after a pane has been closed and removed from the layout. */
  onPaneClosed?: (pane: TPane) => void;
  /** Called after a pane has been split into two. */
  onPaneSplit?: (
    sourcePane: TPane,
    createdPane: TPane,
    direction: ResttyPaneSplitDirection,
  ) => void;
  /** Called when the active pane changes (null when all panes are closed). */
  onActivePaneChange?: (pane: TPane | null) => void;
  /** Called after any layout change (split, close, resize). */
  onLayoutChanged?: () => void;
  /** Minimum pane size in CSS pixels before further splits are rejected. */
  minPaneSize?: number;
  /** Context menu configuration, or null to disable. */
  contextMenu?: ResttyPaneContextMenuOptions<TPane> | null;
  /** Keyboard shortcut configuration, or a boolean to enable/disable with defaults. */
  shortcuts?: boolean | ResttyPaneShortcutsOptions;
  /** Pane styling configuration, or a boolean to enable/disable with defaults. */
  styles?: boolean | ResttyPaneStylesOptions;
};

/**
 * Public API for managing a split-pane layout.
 */
export type ResttyPaneManager<TPane extends ResttyPaneDefinition> = {
  /** Return all currently open panes. */
  getPanes: () => TPane[];
  /** Look up a pane by its numeric ID, or null if not found. */
  getPaneById: (id: number) => TPane | null;
  /** Return the currently active pane, or null if none. */
  getActivePane: () => TPane | null;
  /** Return the pane that currently has DOM focus, or null if none. */
  getFocusedPane: () => TPane | null;
  /** Create the first pane in an empty layout. */
  createInitialPane: (options?: { focus?: boolean }) => TPane;
  /** Set a pane as active by ID, optionally moving DOM focus to it. */
  setActivePane: (id: number, options?: { focus?: boolean }) => void;
  /** Mark a pane as focused by ID without necessarily changing the active pane. */
  markPaneFocused: (id: number, options?: { focus?: boolean }) => void;
  /** Split an existing pane by ID in the given direction, returning the new pane or null on failure. */
  splitPane: (id: number, direction: ResttyPaneSplitDirection) => TPane | null;
  /** Split the currently active pane, returning the new pane or null on failure. */
  splitActivePane: (direction: ResttyPaneSplitDirection) => TPane | null;
  /** Close a pane by ID, returning true if it was found and removed. */
  closePane: (id: number) => boolean;
  /** Return the current resolved style options. */
  getStyleOptions: () => Readonly<Required<ResttyPaneStyleOptions>>;
  /** Update style options and reapply them to the layout. */
  setStyleOptions: (options: ResttyPaneStyleOptions) => void;
  /** Schedule an asynchronous layout recalculation. */
  requestLayoutSync: () => void;
  /** Dismiss any open context menu. */
  hideContextMenu: () => void;
  /** Tear down all panes, event listeners, and DOM structures. */
  destroy: () => void;
};

/**
 * Pane definition extended with a ResttyRuntime instance and pause control.
 */
export type ResttyPaneWithRuntime = ResttyPaneDefinition & {
  /** The terminal runtime running inside this pane. */
  runtime: ResttyRuntime;
  /** Whether the pane's renderer is currently paused. */
  paused?: boolean;
  /** Pause or resume this pane's renderer. */
  setPaused?: (value: boolean) => void;
};

export type ResttyPaneWithRuntimeActions = ResttyPaneWithRuntime & {
  setRenderer: ResttyRuntimeTerminalApi["setRenderer"];
  setPaused: ResttyRuntimeTerminalApi["setPaused"];
  setFontSize: ResttyRuntimeTerminalApi["setFontSize"];
  setLigatures: ResttyRuntimeTerminalApi["setLigatures"];
  setFontHinting: ResttyRuntimeTerminalApi["setFontHinting"];
  setFontHintTarget: ResttyRuntimeTerminalApi["setFontHintTarget"];
  setFonts: ResttyRuntimeTerminalApi["setFonts"];
  applyTheme: ResttyRuntimeTerminalApi["applyTheme"];
  resetTheme: ResttyRuntimeTerminalApi["resetTheme"];
  sendInput: ResttyRuntimeIoApi["sendInput"];
  sendKeyInput: ResttyRuntimeIoApi["sendKeyInput"];
  copySelectionToClipboard: () => Promise<boolean>;
  pasteFromClipboard: () => Promise<boolean>;
  clearScreen: () => void;
  connectPty: (url?: string) => void;
  disconnectPty: () => void;
  isPtyConnected: () => boolean;
  togglePause: () => void;
  setMouseMode: ResttyRuntimeInteractionApi["setMouseMode"];
  getMouseStatus: ResttyRuntimeInteractionApi["getMouseStatus"];
  selectWordAtClientPoint: ResttyRuntimeInteractionApi["selectWordAtClientPoint"];
  setSearchQuery: ResttyRuntimeSearchApi["setQuery"];
  clearSearch: ResttyRuntimeSearchApi["clear"];
  searchNext: ResttyRuntimeSearchApi["next"];
  searchPrevious: ResttyRuntimeSearchApi["previous"];
  getSearchState: ResttyRuntimeSearchApi["getState"];
  resize: ResttyRuntimeInteractionApi["resize"];
  focus: ResttyRuntimeInteractionApi["focus"];
  blur: ResttyRuntimeInteractionApi["blur"];
  updateSize: ResttyRuntimeInteractionApi["updateSize"];
  getBackend: ResttyRuntimeRenderApi["getBackend"];
  setShaderStages: ResttyRuntimeRenderApi["setShaderStages"];
  getShaderStages: ResttyRuntimeRenderApi["getShaderStages"];
};

export type ResttyPaneWithManagedRuntime = ResttyPaneWithRuntimeActions & {
  initRuntime: () => Promise<void>;
  destroyRuntime: () => void;
};

/**
 * Options for building the default set of context menu items for a pane with a runtime.
 */
export type CreateDefaultResttyPaneContextMenuItemsOptions<
  TPane extends ResttyPaneWithRuntimeActions,
> = {
  /** The pane the context menu was opened on. */
  pane: TPane;
  /** Subset of the pane manager API needed for split/close actions. */
  manager: Pick<ResttyPaneManager<TPane>, "splitPane" | "closePane" | "getPanes">;
  /** Platform modifier key label (e.g. "Cmd" or "Ctrl") shown in shortcut hints. */
  modKeyLabel?: string;
  /** Provider for the current PTY URL, used for reconnect/copy-URL items. */
  getPtyUrl?: () => string | null | undefined;
};

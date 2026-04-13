import type { ResttyAppSession, ResttyRuntimeServicesConfig } from "../../runtime/types";
import type {
  ResttyDefaultPaneContextMenuOptions,
  ResttyManagedAppPane,
  ResttyManagedPaneSearchUiOptions,
  ResttyManagedPaneStylesOptions,
  ResttyPaneDomDefaults,
  ResttyPaneRuntimeContext,
  ResttyTerminalConfigInput,
} from "../pane-app-manager";
import type { ResttyPaneContextMenuOptions, ResttyPaneShortcutsOptions } from "../panes-types";
import type { ResttySurfaceEvents } from "./events";

export type ResttySurfaceConfig = {
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
  /** Whether to create the first pane automatically (default true). */
  createInitialPane?: boolean | { focus?: boolean };
  /** Surface lifecycle and pane-layout event handlers. */
  events?: ResttySurfaceEvents;
};

export type ResttyServicesConfig = ResttyRuntimeServicesConfig;
export type ResttyServicesConfigInput =
  | ResttyServicesConfig
  | ((context: ResttyPaneRuntimeContext) => ResttyServicesConfig);

/**
 * Top-level configuration for creating a Restty instance.
 */
export type ResttyConfig = {
  /** Root element that will contain the Restty surface. */
  root: HTMLElement;
  /** Shared session for WASM/WebGPU resources. */
  session?: ResttyAppSession;
  /** Surface shell and pane manager behavior. */
  surface?: ResttySurfaceConfig;
  /** Per-pane terminal behavior config, static or factory. */
  terminal?: ResttyTerminalConfigInput;
  /** Per-pane services/hooks config, static or factory. */
  services?: ResttyServicesConfigInput;
};

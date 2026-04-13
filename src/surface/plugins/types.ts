import type { ResttyPaneSplitDirection } from "../panes/types";
import type { ResttyPlugin } from "./context.types";

export type {
  ResttyPluginDisposable,
  ResttyPluginCleanup,
  ResttyInputInterceptorPayload,
  ResttyOutputInterceptorPayload,
  ResttyInputInterceptor,
  ResttyOutputInterceptor,
  ResttyLifecycleHookPayload,
  ResttyLifecycleHook,
  ResttyRenderHookPayload,
  ResttyRenderHook,
  ResttyInterceptorOptions,
  ResttyRenderStageHandle,
  ResttyPluginHostApi,
  ResttyPluginContext,
  ResttyPlugin,
} from "./context.types";

/** Current Restty plugin API version. */
export const RESTTY_PLUGIN_API_VERSION = 1;

/** Plugin API version requirements. */
export type ResttyPluginApiRange = {
  min: number;
  max?: number;
};

/** Optional compatibility requirements declared by plugins. */
export type ResttyPluginRequires = {
  pluginApi?: number | ResttyPluginApiRange;
};

/** Diagnostics snapshot for a plugin. */
export type ResttyPluginInfo = {
  id: string;
  version: string | null;
  apiVersion: number | null;
  requires: ResttyPluginRequires | null;
  active: boolean;
  activatedAt: number | null;
  lastError: string | null;
  listeners: number;
  inputInterceptors: number;
  outputInterceptors: number;
  lifecycleHooks: number;
  renderHooks: number;
  renderStages: number;
};

/** Declarative plugin manifest entry for registry-based loading. */
export type ResttyPluginManifestEntry = {
  id: string;
  enabled?: boolean;
  options?: unknown;
};

/** Provider entry for plugin registry lookups. */
export type ResttyPluginRegistryEntry = ResttyPlugin | (() => ResttyPlugin | Promise<ResttyPlugin>);

/** Registry shape accepted by loadPlugins. */
export type ResttyPluginRegistry =
  | ReadonlyMap<string, ResttyPluginRegistryEntry>
  | Record<string, ResttyPluginRegistryEntry>;

/** Status for manifest-driven plugin load attempts. */
export type ResttyPluginLoadStatus = "loaded" | "skipped" | "missing" | "failed";

/** Result row returned by loadPlugins. */
export type ResttyPluginLoadResult = {
  id: string;
  status: ResttyPluginLoadStatus;
  error: string | null;
};

/** Event payloads emitted by the Restty plugin host. */
export type ResttyPluginEvents = {
  "plugin:activated": { pluginId: string };
  "plugin:deactivated": { pluginId: string };
  "pane:created": { paneId: number };
  "pane:closed": { paneId: number };
  "pane:split": {
    sourcePaneId: number;
    createdPaneId: number;
    direction: ResttyPaneSplitDirection;
  };
  "pane:active-changed": { paneId: number | null };
  "layout:changed": {};
  "pane:resized": { paneId: number; cols: number; rows: number };
  "pane:focused": { paneId: number };
  "pane:blurred": { paneId: number };
};

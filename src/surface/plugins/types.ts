import type { ResttyPaneSplitDirection } from "./panes-types";
import type { ResttyShaderStage } from "../runtime/types";
import type { ResttyPaneHandle } from "./restty-pane-handle";
import type { Restty } from "./restty";

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

/** A disposable resource returned by plugin APIs. */
export type ResttyPluginDisposable = {
  dispose: () => void;
};

/** Optional cleanup return supported by plugin activation. */
export type ResttyPluginCleanup = void | (() => void) | ResttyPluginDisposable;

/** Payload passed to input interceptors before terminal/program input is written. */
export type ResttyInputInterceptorPayload = {
  paneId: number;
  text: string;
  source: string;
};

/** Payload passed to output interceptors before PTY data is rendered. */
export type ResttyOutputInterceptorPayload = {
  paneId: number;
  text: string;
  source: string;
};

/** Input interceptor contract. */
export type ResttyInputInterceptor = (
  payload: ResttyInputInterceptorPayload,
) => string | null | void;

/** Output interceptor contract. */
export type ResttyOutputInterceptor = (
  payload: ResttyOutputInterceptorPayload,
) => string | null | void;

/** Payload passed to lifecycle hooks registered by plugins. */
export type ResttyLifecycleHookPayload = {
  phase: "before" | "after";
  action:
    | "create-initial-pane"
    | "split-active-pane"
    | "split-pane"
    | "close-pane"
    | "set-active-pane"
    | "mark-pane-focused"
    | "connect-pty"
    | "disconnect-pty"
    | "resize"
    | "focus"
    | "blur";
  paneId?: number | null;
  sourcePaneId?: number;
  createdPaneId?: number | null;
  direction?: ResttyPaneSplitDirection;
  cols?: number;
  rows?: number;
  ok?: boolean;
  error?: string | null;
};

/** Lifecycle hook contract. */
export type ResttyLifecycleHook = (payload: ResttyLifecycleHookPayload) => void;

/** Payload passed to render hooks registered by plugins. */
export type ResttyRenderHookPayload = {
  phase: "before" | "after";
  paneId: number;
  text: string;
  source: string;
  dropped: boolean;
};

/** Render hook contract. */
export type ResttyRenderHook = (payload: ResttyRenderHookPayload) => void;

/** Shared options for interceptor ordering. */
export type ResttyInterceptorOptions = {
  priority?: number;
};

export type ResttyRenderStageHandle = {
  id: string;
  setUniforms: (uniforms: number[]) => void;
  setEnabled: (value: boolean) => void;
  dispose: () => void;
};

/** Context object provided to each plugin on activation. */
export type ResttyPluginContext = {
  restty: Restty;
  options: unknown;
  panes: () => ResttyPaneHandle[];
  pane: (id: number) => ResttyPaneHandle | null;
  activePane: () => ResttyPaneHandle | null;
  focusedPane: () => ResttyPaneHandle | null;
  on: <E extends keyof ResttyPluginEvents>(
    event: E,
    listener: (payload: ResttyPluginEvents[E]) => void,
  ) => ResttyPluginDisposable;
  addInputInterceptor: (
    interceptor: ResttyInputInterceptor,
    options?: ResttyInterceptorOptions,
  ) => ResttyPluginDisposable;
  addOutputInterceptor: (
    interceptor: ResttyOutputInterceptor,
    options?: ResttyInterceptorOptions,
  ) => ResttyPluginDisposable;
  addLifecycleHook: (
    hook: ResttyLifecycleHook,
    options?: ResttyInterceptorOptions,
  ) => ResttyPluginDisposable;
  addRenderHook: (
    hook: ResttyRenderHook,
    options?: ResttyInterceptorOptions,
  ) => ResttyPluginDisposable;
  addRenderStage: (stage: ResttyShaderStage) => ResttyRenderStageHandle;
};

/** Plugin contract for extending Restty behavior. */
export type ResttyPlugin = {
  id: string;
  version?: string;
  apiVersion?: number;
  requires?: ResttyPluginRequires;
  activate: (
    context: ResttyPluginContext,
    options?: unknown,
  ) => ResttyPluginCleanup | Promise<ResttyPluginCleanup>;
};

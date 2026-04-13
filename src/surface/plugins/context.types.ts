import type { ResttyShaderStage } from "../../runtime/core/models";
import type { ResttyPaneSplitDirection } from "../panes/types";
import type { ResttyPaneHandle } from "../restty/pane-handle";
import type { Restty } from "../restty";
import type { ResttyPluginEvents, ResttyPluginRequires } from "./types";

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

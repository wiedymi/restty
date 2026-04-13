import type { ResttyShaderStage } from "../../runtime/core/models";
import type { ResttyInterceptorOptions, ResttyPlugin } from "./context.types";
import type { ResttyPluginEvents, ResttyPluginInfo, ResttyPluginRequires } from "./types";

export type ResttyPluginRuntimeDisposerKind =
  | "event"
  | "input-interceptor"
  | "output-interceptor"
  | "lifecycle-hook"
  | "render-hook"
  | "render-stage";

export type ResttyPluginRuntimeDisposer = {
  kind: ResttyPluginRuntimeDisposerKind;
  active: boolean;
  dispose: () => void;
};

export type ResttyPluginRuntime = {
  plugin: ResttyPlugin;
  cleanup: (() => void) | null;
  activatedAt: number;
  options: unknown;
  disposers: Array<ResttyPluginRuntimeDisposer>;
};

export type ResttyPluginDiagnostic = {
  id: string;
  version: string | null;
  apiVersion: number | null;
  requires: ResttyPluginRequires | null;
  active: boolean;
  activatedAt: number | null;
  lastError: string | null;
};

export type ResttyRegisteredInterceptor<T extends (payload: unknown) => unknown> = {
  id: number;
  pluginId: string;
  priority: number;
  order: number;
  interceptor: T;
};

export type ResttyManagedShaderStage = {
  id: string;
  stage: ResttyShaderStage;
  order: number;
  ownerPluginId: string | null;
};

export type ResttyInterceptorSeq = {
  nextId: number;
  nextOrder: number;
};

export type PluginListenersMap = Map<keyof ResttyPluginEvents, Set<(payload: unknown) => void>>;

export type PluginDiagnosticMap = Map<string, ResttyPluginDiagnostic>;
export type PluginRuntimeMap = Map<string, ResttyPluginRuntime>;

export type BuildPluginInfoResult = ResttyPluginInfo | null;

export type RegisterPluginInterceptorOptions = ResttyInterceptorOptions | undefined;

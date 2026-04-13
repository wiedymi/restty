import type { ResttyPluginEvents, ResttyPluginInfo } from "./types";
import type {
  PluginDiagnosticMap,
  PluginListenersMap,
  PluginRuntimeMap,
  RegisterPluginInterceptorOptions,
  ResttyInterceptorSeq,
  ResttyPluginDiagnostic,
  ResttyPluginRuntime,
  ResttyPluginRuntimeDisposer,
  ResttyPluginRuntimeDisposerKind,
  ResttyRegisteredInterceptor,
} from "./runtime.types";

export function registerPluginInterceptor<T extends (payload: unknown) => unknown>(
  bucket: Array<ResttyRegisteredInterceptor<T>>,
  pluginId: string,
  interceptor: T,
  options: RegisterPluginInterceptorOptions,
  seq: ResttyInterceptorSeq,
): { dispose: () => void; nextId: number; nextOrder: number } {
  const entry: ResttyRegisteredInterceptor<T> = {
    id: seq.nextId,
    pluginId,
    priority: Number.isFinite(options?.priority) ? Number(options?.priority) : 0,
    order: seq.nextOrder,
    interceptor,
  };
  bucket.push(entry);
  bucket.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.order - b.order;
  });
  return {
    nextId: seq.nextId + 1,
    nextOrder: seq.nextOrder + 1,
    dispose: () => {
      const index = bucket.findIndex((current) => current.id === entry.id);
      if (index >= 0) {
        bucket.splice(index, 1);
      }
    },
  };
}

export function applyPluginInterceptors<TPayload extends { text: string }>(
  bucket: Array<ResttyRegisteredInterceptor<(payload: TPayload) => string | null | void>>,
  kind: "input" | "output",
  payload: TPayload,
): string | null {
  let currentText = payload.text;
  for (let i = 0; i < bucket.length; i += 1) {
    const entry = bucket[i];
    try {
      const result = entry.interceptor({ ...payload, text: currentText });
      if (result === null) return null;
      if (typeof result === "string") currentText = result;
    } catch (error) {
      console.error(`[restty plugin] ${kind} interceptor error (${entry.pluginId}):`, error);
    }
  }
  return currentText;
}

export function runPluginHooks<TPayload>(
  bucket: Array<ResttyRegisteredInterceptor<(payload: TPayload) => void>>,
  kind: "lifecycle" | "render",
  payload: TPayload,
): void {
  for (let i = 0; i < bucket.length; i += 1) {
    const entry = bucket[i];
    try {
      entry.interceptor(payload);
    } catch (error) {
      console.error(`[restty plugin] ${kind} hook error (${entry.pluginId}):`, error);
    }
  }
}

export function attachRuntimeDisposer(
  runtime: ResttyPluginRuntime,
  kind: ResttyPluginRuntimeDisposerKind,
  dispose: () => void,
): () => void {
  const entry: ResttyPluginRuntimeDisposer = {
    kind,
    active: true,
    dispose: () => {
      if (!entry.active) return;
      entry.active = false;
      dispose();
    },
  };
  runtime.disposers.push(entry);
  return entry.dispose;
}

export function teardownPluginRuntime(runtime: ResttyPluginRuntime): void {
  for (let i = 0; i < runtime.disposers.length; i += 1) {
    try {
      runtime.disposers[i].dispose();
    } catch {
      // ignore plugin dispose errors
    }
  }
  runtime.disposers.length = 0;
  const cleanup = runtime.cleanup;
  runtime.cleanup = null;
  if (!cleanup) return;
  try {
    cleanup();
  } catch (error) {
    console.error(`[restty plugin] cleanup error (${runtime.plugin.id}):`, error);
  }
}

export function setPluginLoadError(
  pluginDiagnostics: PluginDiagnosticMap,
  pluginId: string,
  message: string,
): void {
  pluginDiagnostics.set(pluginId, {
    id: pluginId,
    version: null,
    apiVersion: null,
    requires: null,
    active: false,
    activatedAt: null,
    lastError: message,
  });
}

export function patchPluginDiagnostic(
  pluginDiagnostics: PluginDiagnosticMap,
  pluginId: string,
  patch: Partial<Pick<ResttyPluginDiagnostic, "active" | "activatedAt" | "lastError">>,
): void {
  const current = pluginDiagnostics.get(pluginId);
  if (!current) return;
  pluginDiagnostics.set(pluginId, {
    ...current,
    ...patch,
  });
}

function countActiveDisposers(
  runtime: ResttyPluginRuntime | null,
  kind: ResttyPluginRuntimeDisposerKind,
): number {
  if (!runtime) return 0;
  let count = 0;
  for (let i = 0; i < runtime.disposers.length; i += 1) {
    const entry = runtime.disposers[i];
    if (entry.active && entry.kind === kind) count += 1;
  }
  return count;
}

export function buildPluginInfo(
  pluginId: string,
  pluginDiagnostics: PluginDiagnosticMap,
  pluginRuntimes: PluginRuntimeMap,
): ResttyPluginInfo | null {
  const diagnostic = pluginDiagnostics.get(pluginId) ?? null;
  const runtime = pluginRuntimes.get(pluginId) ?? null;
  if (!diagnostic && !runtime) return null;
  const plugin = runtime?.plugin;

  return {
    id: pluginId,
    version: plugin?.version?.trim?.() || diagnostic?.version || null,
    apiVersion:
      plugin?.apiVersion ??
      (Number.isFinite(diagnostic?.apiVersion) ? diagnostic?.apiVersion : null),
    requires: plugin?.requires ?? diagnostic?.requires ?? null,
    active: runtime ? true : (diagnostic?.active ?? false),
    activatedAt: runtime?.activatedAt ?? diagnostic?.activatedAt ?? null,
    lastError: diagnostic?.lastError ?? null,
    listeners: countActiveDisposers(runtime, "event"),
    inputInterceptors: countActiveDisposers(runtime, "input-interceptor"),
    outputInterceptors: countActiveDisposers(runtime, "output-interceptor"),
    lifecycleHooks: countActiveDisposers(runtime, "lifecycle-hook"),
    renderHooks: countActiveDisposers(runtime, "render-hook"),
    renderStages: countActiveDisposers(runtime, "render-stage"),
  };
}

export function onPluginEvent<E extends keyof ResttyPluginEvents>(
  pluginListeners: PluginListenersMap,
  event: E,
  listener: (payload: ResttyPluginEvents[E]) => void,
): () => void {
  let listeners = pluginListeners.get(event);
  if (!listeners) {
    listeners = new Set();
    pluginListeners.set(event, listeners);
  }
  const wrapped = listener as (payload: unknown) => void;
  listeners.add(wrapped);
  return () => {
    const current = pluginListeners.get(event);
    if (!current) return;
    current.delete(wrapped);
    if (current.size === 0) {
      pluginListeners.delete(event);
    }
  };
}

export function emitPluginEvent<E extends keyof ResttyPluginEvents>(
  pluginListeners: PluginListenersMap,
  event: E,
  payload: ResttyPluginEvents[E],
): void {
  const listeners = pluginListeners.get(event);
  if (!listeners || listeners.size === 0) return;
  const snapshot = Array.from(listeners);
  for (let i = 0; i < snapshot.length; i += 1) {
    try {
      snapshot[i](payload);
    } catch (error) {
      console.error(`[restty plugin] listener error (${String(event)}):`, error);
    }
  }
}

import {
  type ResttyInterceptorOptions,
  type ResttyInputInterceptor,
  type ResttyLifecycleHook,
  type ResttyLifecycleHookPayload,
  type ResttyOutputInterceptor,
  type ResttyPluginContext,
  type ResttyPluginEvents,
  type ResttyRenderHook,
  type ResttyRenderHookPayload,
} from "./types";
import {
  type ResttyPluginRuntimeDisposerKind,
  type ResttyPluginRuntime,
  type ResttyRegisteredInterceptor,
  registerPluginInterceptor,
  applyPluginInterceptors,
  runPluginHooks,
  attachRuntimeDisposer,
  onPluginEvent,
  emitPluginEvent,
} from "./runtime";
import type { ResttyPluginHostDeps } from "./dispatcher.types";
import { normalizeShaderStage } from "../../runtime/shader-stages";

export class ResttyPluginDispatcher {
  private readonly deps: ResttyPluginHostDeps;
  private readonly pluginListeners = new Map<
    keyof ResttyPluginEvents,
    Set<(payload: unknown) => void>
  >();
  private readonly inputInterceptors: Array<ResttyRegisteredInterceptor<ResttyInputInterceptor>> =
    [];
  private readonly outputInterceptors: Array<ResttyRegisteredInterceptor<ResttyOutputInterceptor>> =
    [];
  private readonly lifecycleHooks: Array<ResttyRegisteredInterceptor<ResttyLifecycleHook>> = [];
  private readonly renderHooks: Array<ResttyRegisteredInterceptor<ResttyRenderHook>> = [];
  private nextInterceptorId = 1;
  private nextInterceptorOrder = 1;

  constructor(deps: ResttyPluginHostDeps) {
    this.deps = deps;
  }

  createPluginContext(runtime: ResttyPluginRuntime): ResttyPluginContext {
    return {
      restty: this.deps.restty,
      options: runtime.options,
      panes: this.deps.panes,
      pane: this.deps.pane,
      activePane: this.deps.activePane,
      focusedPane: this.deps.focusedPane,
      on: <E extends keyof ResttyPluginEvents>(
        event: E,
        listener: (payload: ResttyPluginEvents[E]) => void,
      ) => {
        return {
          dispose: this.attachRuntimeDisposer(
            runtime,
            "event",
            this.onPluginEvent(event, listener),
          ),
        };
      },
      addInputInterceptor: (interceptor, options) => {
        return {
          dispose: this.attachRuntimeDisposer(
            runtime,
            "input-interceptor",
            this.addInputInterceptor(runtime.plugin.id, interceptor, options),
          ),
        };
      },
      addOutputInterceptor: (interceptor, options) => {
        return {
          dispose: this.attachRuntimeDisposer(
            runtime,
            "output-interceptor",
            this.addOutputInterceptor(runtime.plugin.id, interceptor, options),
          ),
        };
      },
      addLifecycleHook: (hook, options) => {
        return {
          dispose: this.attachRuntimeDisposer(
            runtime,
            "lifecycle-hook",
            this.addLifecycleHook(runtime.plugin.id, hook, options),
          ),
        };
      },
      addRenderHook: (hook, options) => {
        return {
          dispose: this.attachRuntimeDisposer(
            runtime,
            "render-hook",
            this.addRenderHook(runtime.plugin.id, hook, options),
          ),
        };
      },
      addRenderStage: (stage) => {
        const rawId = stage?.id?.trim?.() ?? "";
        if (!rawId) {
          throw new Error(`Restty plugin ${runtime.plugin.id} render stage id is required`);
        }
        const stageId = `${runtime.plugin.id}:${rawId}`;
        const normalized = normalizeShaderStage({ ...stage, id: stageId });
        const handle = this.deps.addRenderStage(normalized, runtime.plugin.id);
        return {
          ...handle,
          dispose: this.attachRuntimeDisposer(runtime, "render-stage", handle.dispose),
        };
      },
    };
  }

  applyInputInterceptors(paneId: number, text: string, source: string): string | null {
    return this.applyInterceptors(this.inputInterceptors, "input", { paneId, text, source });
  }

  applyOutputInterceptors(paneId: number, text: string, source: string): string | null {
    return this.applyInterceptors(this.outputInterceptors, "output", { paneId, text, source });
  }

  runLifecycleHooks(payload: ResttyLifecycleHookPayload): void {
    this.runHooks(this.lifecycleHooks, "lifecycle", payload);
  }

  runRenderHooks(payload: ResttyRenderHookPayload): void {
    this.runHooks(this.renderHooks, "render", payload);
  }

  emitPluginEvent<E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ): void {
    emitPluginEvent(this.pluginListeners, event, payload);
  }

  private attachRuntimeDisposer(
    runtime: ResttyPluginRuntime,
    kind: ResttyPluginRuntimeDisposerKind,
    dispose: () => void,
  ): () => void {
    return attachRuntimeDisposer(runtime, kind, dispose);
  }

  private addInputInterceptor(
    pluginId: string,
    interceptor: ResttyInputInterceptor,
    options?: ResttyInterceptorOptions,
  ): () => void {
    return this.registerInterceptor(this.inputInterceptors, pluginId, interceptor, options);
  }

  private addOutputInterceptor(
    pluginId: string,
    interceptor: ResttyOutputInterceptor,
    options?: ResttyInterceptorOptions,
  ): () => void {
    return this.registerInterceptor(this.outputInterceptors, pluginId, interceptor, options);
  }

  private addLifecycleHook(
    pluginId: string,
    hook: ResttyLifecycleHook,
    options?: ResttyInterceptorOptions,
  ): () => void {
    return this.registerInterceptor(this.lifecycleHooks, pluginId, hook, options);
  }

  private addRenderHook(
    pluginId: string,
    hook: ResttyRenderHook,
    options?: ResttyInterceptorOptions,
  ): () => void {
    return this.registerInterceptor(this.renderHooks, pluginId, hook, options);
  }

  private registerInterceptor<T extends (payload: unknown) => string | null | void>(
    bucket: Array<ResttyRegisteredInterceptor<T>>,
    pluginId: string,
    interceptor: T,
    options?: ResttyInterceptorOptions,
  ): () => void {
    const result = registerPluginInterceptor(bucket, pluginId, interceptor, options, {
      nextId: this.nextInterceptorId,
      nextOrder: this.nextInterceptorOrder,
    });
    this.nextInterceptorId = result.nextId;
    this.nextInterceptorOrder = result.nextOrder;
    return result.dispose;
  }

  private applyInterceptors<TPayload extends { text: string }>(
    bucket: Array<ResttyRegisteredInterceptor<(payload: TPayload) => string | null | void>>,
    kind: "input" | "output",
    payload: TPayload,
  ): string | null {
    return applyPluginInterceptors(bucket, kind, payload);
  }

  private runHooks<TPayload>(
    bucket: Array<ResttyRegisteredInterceptor<(payload: TPayload) => void>>,
    kind: "lifecycle" | "render",
    payload: TPayload,
  ): void {
    runPluginHooks(bucket, kind, payload);
  }

  private onPluginEvent<E extends keyof ResttyPluginEvents>(
    event: E,
    listener: (payload: ResttyPluginEvents[E]) => void,
  ): () => void {
    return onPluginEvent(this.pluginListeners, event, listener);
  }
}

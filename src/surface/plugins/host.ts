import {
  RESTTY_PLUGIN_API_VERSION,
  type ResttyLifecycleHookPayload,
  type ResttyPlugin,
  type ResttyPluginEvents,
  type ResttyPluginInfo,
  type ResttyPluginLoadResult,
  type ResttyPluginManifestEntry,
  type ResttyPluginRegistry,
  type ResttyRenderHookPayload,
} from "./types";
import {
  type ResttyPluginRuntime,
  type ResttyPluginDiagnostic,
  teardownPluginRuntime,
  setPluginLoadError,
  patchPluginDiagnostic,
  buildPluginInfo,
} from "./runtime";
import {
  assertPluginCompatibility,
  errorToMessage,
  lookupPluginRegistryEntry,
  normalizePluginCleanup,
  normalizePluginMetadata,
  resolvePluginRegistryEntry,
} from "./utils";
import { ResttyPluginDispatcher, type ResttyPluginHostDeps } from "./dispatcher";

export class ResttyPluginHost {
  private readonly pluginRuntimes = new Map<string, ResttyPluginRuntime>();
  private readonly pluginDiagnostics = new Map<string, ResttyPluginDiagnostic>();
  private readonly dispatcher: ResttyPluginDispatcher;

  constructor(deps: ResttyPluginHostDeps) {
    this.dispatcher = new ResttyPluginDispatcher(deps);
  }

  async use(plugin: ResttyPlugin, options?: unknown): Promise<void> {
    if (!plugin || typeof plugin !== "object") {
      throw new Error("Restty plugin must be an object");
    }
    const pluginId = plugin.id?.trim?.() ?? "";
    if (!pluginId) {
      throw new Error("Restty plugin id is required");
    }
    if (typeof plugin.activate !== "function") {
      throw new Error(`Restty plugin ${pluginId} must define activate(context)`);
    }
    if (this.pluginRuntimes.has(pluginId)) return;
    try {
      assertPluginCompatibility(pluginId, plugin, RESTTY_PLUGIN_API_VERSION);
    } catch (error) {
      this.pluginDiagnostics.set(pluginId, {
        id: pluginId,
        version: plugin.version?.trim?.() || null,
        apiVersion: Number.isFinite(plugin.apiVersion) ? Number(plugin.apiVersion) : null,
        requires: plugin.requires ?? null,
        active: false,
        activatedAt: null,
        lastError: errorToMessage(error),
      });
      throw error;
    }

    const runtime: ResttyPluginRuntime = {
      plugin: normalizePluginMetadata(plugin, pluginId),
      cleanup: null,
      activatedAt: Date.now(),
      options,
      disposers: [],
    };
    this.pluginDiagnostics.set(pluginId, {
      id: pluginId,
      version: runtime.plugin.version?.trim?.() || null,
      apiVersion: Number.isFinite(runtime.plugin.apiVersion)
        ? Number(runtime.plugin.apiVersion)
        : null,
      requires: runtime.plugin.requires ?? null,
      active: false,
      activatedAt: null,
      lastError: null,
    });
    this.pluginRuntimes.set(pluginId, runtime);
    try {
      const cleanup = await runtime.plugin.activate(
        this.dispatcher.createPluginContext(runtime),
        runtime.options,
      );
      runtime.cleanup = normalizePluginCleanup(cleanup);
      runtime.activatedAt = Date.now();
      this.updatePluginDiagnostic(pluginId, {
        active: true,
        activatedAt: runtime.activatedAt,
        lastError: null,
      });
      this.emitPluginEvent("plugin:activated", { pluginId });
    } catch (error) {
      this.teardownPluginRuntime(runtime);
      this.pluginRuntimes.delete(pluginId);
      this.updatePluginDiagnostic(pluginId, {
        active: false,
        activatedAt: null,
        lastError: errorToMessage(error),
      });
      throw error;
    }
  }

  async loadPlugins(
    manifest: ReadonlyArray<ResttyPluginManifestEntry>,
    registry: ResttyPluginRegistry,
  ): Promise<ResttyPluginLoadResult[]> {
    const results: ResttyPluginLoadResult[] = [];
    for (let i = 0; i < manifest.length; i += 1) {
      const item = manifest[i];
      const pluginId = item.id?.trim?.() ?? "";
      if (!pluginId) {
        results.push({
          id: "",
          status: "failed",
          error: "Restty plugin manifest entry is missing id",
        });
        continue;
      }
      if (item.enabled === false) {
        results.push({ id: pluginId, status: "skipped", error: null });
        continue;
      }

      const entry = lookupPluginRegistryEntry(registry, pluginId);
      if (!entry) {
        const message = `Restty plugin ${pluginId} was not found in registry`;
        this.setPluginLoadError(pluginId, message);
        results.push({ id: pluginId, status: "missing", error: message });
        continue;
      }

      let plugin: ResttyPlugin;
      try {
        plugin = await resolvePluginRegistryEntry(entry);
      } catch (error) {
        const message = errorToMessage(error);
        this.setPluginLoadError(pluginId, message);
        results.push({ id: pluginId, status: "failed", error: message });
        continue;
      }

      const resolvedId = plugin.id?.trim?.() ?? "";
      if (resolvedId !== pluginId) {
        const message = `Restty plugin registry entry ${pluginId} resolved to id ${resolvedId || "(empty)"}`;
        this.setPluginLoadError(pluginId, message);
        results.push({ id: pluginId, status: "failed", error: message });
        continue;
      }

      try {
        await this.use(plugin, item.options);
        results.push({ id: pluginId, status: "loaded", error: null });
      } catch (error) {
        results.push({
          id: pluginId,
          status: "failed",
          error: errorToMessage(error),
        });
      }
    }
    return results;
  }

  unuse(pluginId: string): boolean {
    const key = pluginId?.trim?.() ?? "";
    if (!key) return false;
    const runtime = this.pluginRuntimes.get(key);
    if (!runtime) return false;
    this.pluginRuntimes.delete(key);
    this.teardownPluginRuntime(runtime);
    this.updatePluginDiagnostic(key, {
      active: false,
      activatedAt: null,
    });
    this.emitPluginEvent("plugin:deactivated", { pluginId: key });
    return true;
  }

  plugins(): string[] {
    return Array.from(this.pluginRuntimes.keys());
  }

  pluginInfo(pluginId: string): ResttyPluginInfo | null;
  pluginInfo(): ResttyPluginInfo[];
  pluginInfo(pluginId?: string): ResttyPluginInfo | ResttyPluginInfo[] | null {
    if (typeof pluginId === "string") {
      const key = pluginId.trim();
      if (!key) return null;
      return this.buildPluginInfo(key);
    }
    const keys = new Set<string>();
    for (const key of this.pluginDiagnostics.keys()) keys.add(key);
    for (const key of this.pluginRuntimes.keys()) keys.add(key);
    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => this.buildPluginInfo(key))
      .filter((entry): entry is ResttyPluginInfo => entry !== null);
  }

  destroy(): void {
    const pluginIds = this.plugins();
    for (let i = 0; i < pluginIds.length; i += 1) {
      this.unuse(pluginIds[i]);
    }
  }

  applyInputInterceptors(paneId: number, text: string, source: string): string | null {
    return this.dispatcher.applyInputInterceptors(paneId, text, source);
  }

  applyOutputInterceptors(paneId: number, text: string, source: string): string | null {
    return this.dispatcher.applyOutputInterceptors(paneId, text, source);
  }

  runLifecycleHooks(payload: ResttyLifecycleHookPayload): void {
    this.dispatcher.runLifecycleHooks(payload);
  }

  runRenderHooks(payload: ResttyRenderHookPayload): void {
    this.dispatcher.runRenderHooks(payload);
  }

  emitPluginEvent<E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ): void {
    this.dispatcher.emitPluginEvent(event, payload);
  }

  private setPluginLoadError(pluginId: string, message: string): void {
    setPluginLoadError(this.pluginDiagnostics, pluginId, message);
  }

  private updatePluginDiagnostic(
    pluginId: string,
    patch: Partial<Pick<ResttyPluginDiagnostic, "active" | "activatedAt" | "lastError">>,
  ): void {
    patchPluginDiagnostic(this.pluginDiagnostics, pluginId, patch);
  }

  private buildPluginInfo(pluginId: string): ResttyPluginInfo | null {
    return buildPluginInfo(pluginId, this.pluginDiagnostics, this.pluginRuntimes);
  }

  private teardownPluginRuntime(runtime: ResttyPluginRuntime): void {
    teardownPluginRuntime(runtime);
  }
}

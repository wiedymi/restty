import type { ResttyPaneSplitDirection } from "../panes/types";
import type { ResttyPaneHandle } from "./pane-handle";
import { ResttyPluginHost } from "../plugins/host";
import type { ResttyPluginHostDeps } from "../plugins/dispatcher.types";
import type {
  ResttyLifecycleHookPayload,
  ResttyPlugin,
  ResttyPluginHostApi,
  ResttyRenderHookPayload,
  ResttyRenderStageHandle,
} from "../plugins/context.types";
import type {
  ResttyPluginEvents,
  ResttyPluginInfo,
  ResttyPluginLoadResult,
  ResttyPluginManifestEntry,
  ResttyPluginRegistry,
} from "../plugins/types";

type PaneIdentity = {
  id: number;
};

type ResttyPluginSurfaceApiDeps = Omit<
  ResttyPluginHostApi,
  "createInitialPane" | "splitActivePane" | "splitPane"
> & {
  createInitialPaneSurface: (options?: { focus?: boolean }) => PaneIdentity;
  splitActivePaneSurface: (direction: ResttyPaneSplitDirection) => PaneIdentity | null;
  splitPaneSurface: (id: number, direction: ResttyPaneSplitDirection) => PaneIdentity | null;
};

type ResttyLifecycleHooks = {
  runLifecycleHooks: (payload: ResttyLifecycleHookPayload) => void;
};

type ResttyLifecycleAndPluginHooks = ResttyLifecycleHooks & {
  emitPluginEvent: <E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ) => void;
};

export function createResttyPluginSurfaceApi(
  deps: ResttyPluginSurfaceApiDeps,
): ResttyPluginHostApi {
  const { createInitialPaneSurface, splitActivePaneSurface, splitPaneSurface, ...surfaceApi } =
    deps;

  const requirePaneHandle = (id: number): ResttyPaneHandle => {
    const handle = surfaceApi.pane(id);
    if (!handle) {
      throw new Error(`Restty plugin surface could not resolve pane ${id}`);
    }
    return handle;
  };

  return {
    ...surfaceApi,
    createInitialPane: (options) => {
      const pane = createInitialPaneSurface(options);
      return requirePaneHandle(pane.id);
    },
    splitActivePane: (direction) => {
      const pane = splitActivePaneSurface(direction);
      return pane ? requirePaneHandle(pane.id) : null;
    },
    splitPane: (id, direction) => {
      const pane = splitPaneSurface(id, direction);
      return pane ? requirePaneHandle(pane.id) : null;
    },
  };
}

export class ResttyController {
  private readonly pluginHost: ResttyPluginHost;

  constructor(deps: ResttyPluginHostDeps) {
    this.pluginHost = new ResttyPluginHost(deps);
  }

  async use(plugin: ResttyPlugin, options?: unknown): Promise<void> {
    await this.pluginHost.use(plugin, options);
  }

  async loadPlugins(
    manifest: ReadonlyArray<ResttyPluginManifestEntry>,
    registry: ResttyPluginRegistry,
  ): Promise<ResttyPluginLoadResult[]> {
    return this.pluginHost.loadPlugins(manifest, registry);
  }

  unuse(pluginId: string): boolean {
    return this.pluginHost.unuse(pluginId);
  }

  plugins(): string[] {
    return this.pluginHost.plugins();
  }

  pluginInfo(pluginId: string): ResttyPluginInfo | null;
  pluginInfo(): ResttyPluginInfo[];
  pluginInfo(pluginId?: string): ResttyPluginInfo | ResttyPluginInfo[] | null {
    if (typeof pluginId === "string") return this.pluginHost.pluginInfo(pluginId);
    return this.pluginHost.pluginInfo();
  }

  applyInputInterceptors(paneId: number, text: string, source: string): string | null {
    return this.pluginHost.applyInputInterceptors(paneId, text, source);
  }

  applyOutputInterceptors(paneId: number, text: string, source: string): string | null {
    return this.pluginHost.applyOutputInterceptors(paneId, text, source);
  }

  lifecycleHooks(): ResttyLifecycleHooks {
    return {
      runLifecycleHooks: (payload) => this.runLifecycleHooks(payload),
    };
  }

  lifecycleAndPluginHooks(): ResttyLifecycleAndPluginHooks {
    return {
      runLifecycleHooks: (payload) => this.runLifecycleHooks(payload),
      emitPluginEvent: (event, payload) => this.emitPluginEvent(event, payload),
    };
  }

  runLifecycleHooks(payload: ResttyLifecycleHookPayload): void {
    this.pluginHost.runLifecycleHooks(payload);
  }

  runRenderHooks(payload: ResttyRenderHookPayload): void {
    this.pluginHost.runRenderHooks(payload);
  }

  emitPluginEvent<E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ): void {
    this.pluginHost.emitPluginEvent(event, payload);
  }

  destroy(): void {
    this.pluginHost.destroy();
  }
}

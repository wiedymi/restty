import type { ResttyPaneSplitDirection } from "../panes/types";
import type { ResttyPaneHandle } from "./pane-handle";
import { ResttyPluginHost } from "../plugins/host";
import type { ResttyPluginHostDeps } from "../plugins/dispatcher.types";
import type {
  ResttyLifecycleHookPayload,
  ResttyPlugin,
  ResttyPluginHostApi,
  ResttyRenderHookPayload,
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

export type ResttyPluginSurfaceApiSource<TPaneIdentity extends PaneIdentity = PaneIdentity> = Omit<
  ResttyPluginHostApi,
  "createInitialPane" | "splitActivePane" | "splitPane"
> & {
  createInitialPane: (options?: { focus?: boolean }) => TPaneIdentity;
  splitActivePane: (direction: ResttyPaneSplitDirection) => TPaneIdentity | null;
  splitPane: (id: number, direction: ResttyPaneSplitDirection) => TPaneIdentity | null;
};

type ResttyPluginSurfacePassthroughApi = Omit<
  ResttyPluginSurfaceApiSource,
  "createInitialPane" | "splitActivePane" | "splitPane"
>;

const resttyPluginSurfacePassthroughKeys = [
  "panes",
  "pane",
  "activePane",
  "focusedPane",
  "forEachPane",
  "isPtyConnected",
  "setRenderer",
  "setPaused",
  "togglePause",
  "setFontSize",
  "setLigatures",
  "setFontHinting",
  "setFontHintTarget",
  "setFontSources",
  "applyTheme",
  "resetTheme",
  "sendInput",
  "sendKeyInput",
  "clearScreen",
  "connectPty",
  "disconnectPty",
  "setMouseMode",
  "getMouseStatus",
  "copySelectionToClipboard",
  "pasteFromClipboard",
  "selectWordAtClientPoint",
  "setSearchQuery",
  "clearSearch",
  "searchNext",
  "searchPrevious",
  "getSearchState",
  "openSearch",
  "closeSearch",
  "toggleSearch",
  "isSearchOpen",
  "resize",
  "focus",
  "blur",
  "updateSize",
  "getBackend",
  "setShaderStages",
  "getShaderStages",
  "addShaderStage",
  "removeShaderStage",
  "closePane",
  "getPaneStyleOptions",
  "setPaneStyleOptions",
  "getSearchUiStyleOptions",
  "setSearchUiStyleOptions",
  "setActivePane",
  "markPaneFocused",
  "requestLayoutSync",
  "hideContextMenu",
] as const satisfies ReadonlyArray<keyof ResttyPluginSurfacePassthroughApi>;

function createResttyPluginSurfacePassthroughApi(
  source: ResttyPluginSurfaceApiSource,
): ResttyPluginSurfacePassthroughApi {
  const passthrough = {} as ResttyPluginSurfacePassthroughApi;
  for (const key of resttyPluginSurfacePassthroughKeys) {
    passthrough[key] = source[key].bind(source);
  }
  return passthrough;
}

type ResttyLifecycleHooks = {
  runLifecycleHooks: (payload: ResttyLifecycleHookPayload) => void;
};

type ResttyLifecycleAndPluginHooks = ResttyLifecycleHooks & {
  emitPluginEvent: <E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ) => void;
};

type ResttyPaneManagerHooks = {
  runRenderHooks: (payload: ResttyRenderHookPayload) => void;
  emitPluginEvent: <E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ) => void;
};

export function createResttyPluginSurfaceApi(
  source: ResttyPluginSurfaceApiSource,
): ResttyPluginHostApi {
  const surfaceApi = createResttyPluginSurfacePassthroughApi(source);

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
      const pane = source.createInitialPane(options);
      return requirePaneHandle(pane.id);
    },
    splitActivePane: (direction) => {
      const pane = source.splitActivePane(direction);
      return pane ? requirePaneHandle(pane.id) : null;
    },
    splitPane: (id, direction) => {
      const pane = source.splitPane(id, direction);
      return pane ? requirePaneHandle(pane.id) : null;
    },
  };
}

export class ResttyController {
  private readonly pluginHost: ResttyPluginHost;
  readonly lifecycleHooks: ResttyLifecycleHooks;
  readonly lifecycleAndPluginHooks: ResttyLifecycleAndPluginHooks;
  readonly paneManagerHooks: ResttyPaneManagerHooks;

  constructor(deps: ResttyPluginHostDeps) {
    this.pluginHost = new ResttyPluginHost(deps);
    this.lifecycleHooks = {
      runLifecycleHooks: (payload) => this.runLifecycleHooks(payload),
    };
    this.lifecycleAndPluginHooks = {
      runLifecycleHooks: (payload) => this.runLifecycleHooks(payload),
      emitPluginEvent: (event, payload) => this.emitPluginEvent(event, payload),
    };
    this.paneManagerHooks = {
      runRenderHooks: (payload) => this.runRenderHooks(payload),
      emitPluginEvent: (event, payload) => this.emitPluginEvent(event, payload),
    };
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

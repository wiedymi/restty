import type { ResttyFontSource, ResttyShaderStage } from "../runtime/core/models";
import type {
  ResttyManagedPaneManager,
  ResttyManagedPane,
  ResttyManagedPaneSearchUiStyleOptions,
  ResttyManagedPaneStyleOptions,
} from "./panes/managed-pane-types";
import { ResttyPaneHandle } from "./restty/pane-handle";
import { ResttyActivePaneApi } from "./restty/active-pane-api";
import { bootstrapResttySurface } from "./restty/bootstrap";
import {
  RESTTY_PLUGIN_API_VERSION,
  type ResttyPluginApiRange,
  type ResttyPluginRequires,
  type ResttyPluginInfo,
  type ResttyPluginManifestEntry,
  type ResttyPluginRegistryEntry,
  type ResttyPluginRegistry,
  type ResttyPluginLoadStatus,
  type ResttyPluginLoadResult,
} from "./plugins/types";
import type {
  ResttyPluginDisposable,
  ResttyPluginCleanup,
  ResttyInputInterceptorPayload,
  ResttyOutputInterceptorPayload,
  ResttyInputInterceptor,
  ResttyOutputInterceptor,
  ResttyLifecycleHook,
  ResttyRenderHook,
  ResttyInterceptorOptions,
  ResttyRenderStageHandle,
  ResttyPluginContext,
  ResttyPlugin,
} from "./plugins/context.types";
import type { ResttyConfig } from "./restty/config";
import type { ResttySurfacePane } from "./restty/events";
import { ResttyController } from "./restty/controller";
import * as paneOps from "./restty/pane-ops";
import { ResttyShaderOps } from "./restty/shader-ops";

export { ResttyPaneHandle } from "./restty/pane-handle";
export type { ResttyPaneApi } from "./restty/pane-handle";
export { RESTTY_PLUGIN_API_VERSION } from "./plugins/types";
export type {
  ResttyPluginApiRange,
  ResttyPluginRequires,
  ResttyPluginInfo,
  ResttyPluginManifestEntry,
  ResttyPluginRegistryEntry,
  ResttyPluginRegistry,
  ResttyPluginLoadStatus,
  ResttyPluginLoadResult,
  ResttyPluginEvents,
  ResttyPluginDisposable,
  ResttyPluginCleanup,
  ResttyPluginHostApi,
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
  ResttyPluginContext,
  ResttyPlugin,
} from "./plugins/types";
export type {
  ResttyConfig,
  ResttyServicesConfig,
  ResttyServicesConfigInput,
  ResttySurfaceConfig,
} from "./restty/config";
export type { ResttySurfaceEvents, ResttySurfacePane } from "./restty/events";

/**
 * Main entry point for the restty terminal widget. Manages a set of
 * split panes, each running its own terminal runtime, and exposes
 * convenience methods that operate on the active pane.
 */
export class Restty extends ResttyActivePaneApi {
  readonly paneManager: ResttyManagedPaneManager;
  private fontSources: ResttyFontSource[] | undefined;
  private readonly shaderOps: ResttyShaderOps;
  private readonly controller: ResttyController;

  constructor(options: ResttyConfig) {
    super();
    this.fontSources = undefined;
    const { shaderOps, controller, paneManager, createInitialPane } = bootstrapResttySurface({
      restty: this,
      getPanes: () => this.paneManager.getPanes(),
      getPaneById: (id) => this.paneManager.getPaneById(id),
      getFontSources: () => this.fontSources,
      options,
    });
    this.shaderOps = shaderOps;
    this.controller = controller;
    this.paneManager = paneManager;

    if (createInitialPane) {
      const focus =
        typeof createInitialPane === "object" ? (createInitialPane.focus ?? true) : true;
      this.createInitialPane({ focus });
    }
  }

  getPanes(): ResttySurfacePane[] {
    return this.paneManager.getPanes();
  }

  getPaneById(id: number): ResttySurfacePane | null {
    return this.paneManager.getPaneById(id);
  }

  getActivePane(): ResttySurfacePane | null {
    return this.paneManager.getActivePane();
  }

  getFocusedPane(): ResttySurfacePane | null {
    return this.paneManager.getFocusedPane();
  }

  panes(): ResttyPaneHandle[] {
    return paneOps.panes(this.paneLookup());
  }

  pane(id: number): ResttyPaneHandle | null {
    return paneOps.pane(this.paneLookup(), id);
  }

  activePane(): ResttyPaneHandle | null {
    return paneOps.activePane(this.paneLookup());
  }

  focusedPane(): ResttyPaneHandle | null {
    return paneOps.focusedPane(this.paneLookup());
  }

  forEachPane(visitor: (pane: ResttyPaneHandle) => void): void {
    paneOps.forEachPane(this.paneLookup(), visitor);
  }

  async setFontSources(sources: ResttyFontSource[]): Promise<void> {
    this.fontSources = sources.length ? [...sources] : undefined;
    const panes = this.getPanes();
    const updates: Array<Promise<void>> = new Array(panes.length);
    for (let i = 0; i < panes.length; i += 1) {
      updates[i] = panes[i].runtime.terminal.setFontSources(this.fontSources ?? []);
    }
    await Promise.all(updates);
  }

  setShaderStages(stages: ResttyShaderStage[]): void {
    this.shaderOps.setShaderStages(stages);
  }

  getShaderStages(): ResttyShaderStage[] {
    return this.shaderOps.getShaderStages();
  }

  addShaderStage(stage: ResttyShaderStage): ResttyRenderStageHandle {
    return this.shaderOps.addShaderStage(stage);
  }

  removeShaderStage(id: string): boolean {
    return this.shaderOps.removeShaderStage(id);
  }

  createInitialPane(options?: { focus?: boolean }): ResttySurfacePane {
    return paneOps.createInitialPane(this.paneManager, this.controller.lifecycleHooks(), options);
  }

  splitActivePane(direction: ResttyPaneSplitDirection): ResttySurfacePane | null {
    return paneOps.splitActivePane(
      this.paneManager,
      this.paneLookup(),
      this.controller.lifecycleHooks(),
      direction,
    );
  }

  splitPane(id: number, direction: ResttyPaneSplitDirection): ResttySurfacePane | null {
    return paneOps.splitPane(this.paneManager, this.controller.lifecycleHooks(), id, direction);
  }

  closePane(id: number): boolean {
    return paneOps.closePane(this.paneManager, this.controller.lifecycleHooks(), id);
  }

  getPaneStyleOptions(): Readonly<Required<ResttyManagedPaneStyleOptions>> {
    return paneOps.getPaneStyleOptions(this.paneManager);
  }

  setPaneStyleOptions(options: ResttyManagedPaneStyleOptions): void {
    paneOps.setPaneStyleOptions(this.paneManager, options);
  }

  getSearchUiStyleOptions(): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>> {
    return paneOps.getSearchUiStyleOptions(this.paneManager);
  }

  setSearchUiStyleOptions(options: ResttyManagedPaneSearchUiStyleOptions): void {
    paneOps.setSearchUiStyleOptions(this.paneManager, options);
  }

  setActivePane(id: number, options?: { focus?: boolean }): void {
    paneOps.setActivePane(
      this.paneManager,
      this.paneLookup(),
      this.controller.lifecycleHooks(),
      id,
      options,
    );
  }

  markPaneFocused(id: number, options?: { focus?: boolean }): void {
    paneOps.markPaneFocused(
      this.paneManager,
      this.paneLookup(),
      this.controller.lifecycleHooks(),
      id,
      options,
    );
  }

  requestLayoutSync(): void {
    this.paneManager.requestLayoutSync();
  }

  hideContextMenu(): void {
    this.paneManager.hideContextMenu();
  }

  async use(plugin: ResttyPlugin, options?: unknown): Promise<void> {
    await this.controller.use(plugin, options);
  }

  async loadPlugins(
    manifest: ReadonlyArray<ResttyPluginManifestEntry>,
    registry: ResttyPluginRegistry,
  ): Promise<ResttyPluginLoadResult[]> {
    return this.controller.loadPlugins(manifest, registry);
  }

  unuse(pluginId: string): boolean {
    return this.controller.unuse(pluginId);
  }

  plugins(): string[] {
    return this.controller.plugins();
  }

  pluginInfo(pluginId: string): ResttyPluginInfo | null;
  pluginInfo(): ResttyPluginInfo[];
  pluginInfo(pluginId?: string): ResttyPluginInfo | ResttyPluginInfo[] | null {
    if (typeof pluginId === "string") return this.controller.pluginInfo(pluginId);
    return this.controller.pluginInfo();
  }

  destroy(): void {
    this.controller.destroy();
    this.shaderOps.clear();
    this.paneManager.destroy();
  }

  connectPty(url = ""): void {
    paneOps.connectPty(this.paneLookup(), this.controller.lifecycleHooks(), url);
  }

  disconnectPty(): void {
    paneOps.disconnectPty(this.paneLookup(), this.controller.lifecycleHooks());
  }

  resize(cols: number, rows: number): void {
    paneOps.resize(this.paneLookup(), this.controller.lifecycleAndPluginHooks(), cols, rows);
  }

  focus(): void {
    paneOps.focus(this.paneLookup(), this.controller.lifecycleAndPluginHooks());
  }

  blur(): void {
    paneOps.blur(this.paneLookup(), this.controller.lifecycleAndPluginHooks());
  }

  private paneLookup(): {
    getPanes: () => ResttyManagedPane[];
    getPaneById: (id: number) => ResttyManagedPane | null;
    getActivePane: () => ResttyManagedPane | null;
    getFocusedPane: () => ResttyManagedPane | null;
    openPaneSearch: ResttyManagedPaneManager["openPaneSearch"];
    closePaneSearch: ResttyManagedPaneManager["closePaneSearch"];
    togglePaneSearch: ResttyManagedPaneManager["togglePaneSearch"];
    isPaneSearchOpen: ResttyManagedPaneManager["isPaneSearchOpen"];
    getSearchUiStyleOptions: ResttyManagedPaneManager["getSearchUiStyleOptions"];
    setSearchUiStyleOptions: ResttyManagedPaneManager["setSearchUiStyleOptions"];
  } {
    const paneManager = this.paneManager;
    return {
      getPanes: () => this.getPanes(),
      getPaneById: (id) => this.getPaneById(id),
      getActivePane: () => this.getActivePane(),
      getFocusedPane: () => this.getFocusedPane(),
      openPaneSearch: (id, options) => {
        paneManager.openPaneSearch(id, options);
      },
      closePaneSearch: (id, options) => {
        paneManager.closePaneSearch(id, options);
      },
      togglePaneSearch: (id, options) => {
        paneManager.togglePaneSearch(id, options);
      },
      isPaneSearchOpen: (id) => paneManager.isPaneSearchOpen(id),
      getSearchUiStyleOptions: () => paneManager.getSearchUiStyleOptions(),
      setSearchUiStyleOptions: (options) => {
        paneManager.setSearchUiStyleOptions(options);
      },
    };
  }

  protected requireActivePaneHandle(): ResttyPaneHandle {
    return paneOps.requireActivePaneHandle(this.paneLookup());
  }
}

/** Create a new Restty instance with the given options. */
export function createRestty(options: ResttyConfig): Restty {
  return new Restty(options);
}

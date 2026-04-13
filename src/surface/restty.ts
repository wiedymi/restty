import type { DesktopNotification } from "../input";
import {
  createResttyAppPaneManager,
  type ResttyAppPaneManager,
  type CreateResttyAppPaneManagerOptions,
  type ResttyManagedAppPane,
  type ResttyManagedPaneStyleOptions,
  type ResttyManagedPaneSearchUiStyleOptions,
  type ResttyTerminalConfig,
} from "./pane-app-manager";
import type { ResttyPaneSplitDirection } from "./panes-types";
import type { ResttyFontSource, ResttyShaderStage } from "../runtime/types";
import { ResttyPaneHandle } from "./restty-pane-handle";
import { ResttyActivePaneApi } from "./restty/active-pane-api";
import {
  createMergedPaneAppOptions,
  createPaneManagerEventHandlers,
} from "./restty/manager-options";
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
  type ResttyPluginEvents,
  type ResttyPluginDisposable,
  type ResttyPluginCleanup,
  type ResttyInputInterceptorPayload,
  type ResttyOutputInterceptorPayload,
  type ResttyInputInterceptor,
  type ResttyOutputInterceptor,
  type ResttyLifecycleHookPayload,
  type ResttyLifecycleHook,
  type ResttyRenderHookPayload,
  type ResttyRenderHook,
  type ResttyInterceptorOptions,
  type ResttyRenderStageHandle,
  type ResttyPluginContext,
  type ResttyPlugin,
} from "./restty-plugin-types";
import { ResttyPluginOps } from "./restty/plugin-ops";
import * as paneOps from "./restty/pane-ops";
import { ResttyShaderOps } from "./restty/shader-ops";

export { ResttyPaneHandle } from "./restty-pane-handle";
export type { ResttyPaneApi } from "./restty-pane-handle";
export { RESTTY_PLUGIN_API_VERSION } from "./restty-plugin-types";
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
} from "./restty-plugin-types";

/**
 * Top-level configuration for creating a Restty instance.
 */
export type ResttyConfig = Omit<CreateResttyAppPaneManagerOptions, "appOptions"> & {
  /** Per-pane terminal config, static or factory. */
  terminal?: CreateResttyAppPaneManagerOptions["appOptions"];
  /** Font sources applied to every pane. */
  fontSources?: ResttyTerminalConfig["fontSources"];
  /** Global shader stages synchronized to all panes. */
  shaderStages?: ResttyShaderStage[];
  /** Global handler for desktop notifications emitted by any pane. */
  onDesktopNotification?: (notification: DesktopNotification & { paneId: number }) => void;
  /** Whether to create the first pane automatically (default true). */
  createInitialPane?: boolean | { focus?: boolean };
};

/**
 * Main entry point for the restty terminal widget. Manages a set of
 * split panes, each running its own terminal app, and exposes
 * convenience methods that operate on the active pane.
 */
export class Restty extends ResttyActivePaneApi {
  readonly paneManager: ResttyAppPaneManager;
  private fontSources: ResttyFontSource[] | undefined;
  private readonly shaderOps: ResttyShaderOps;
  private readonly pluginOps: ResttyPluginOps;

  constructor(options: ResttyConfig) {
    super();
    const {
      createInitialPane = true,
      terminal,
      fontSources,
      shaderStages,
      onDesktopNotification,
      onPaneCreated,
      onPaneClosed,
      onPaneSplit,
      onActivePaneChange,
      onLayoutChanged,
      ...paneManagerOptions
    } = options;

    this.fontSources = fontSources ? [...fontSources] : undefined;
    this.shaderOps = new ResttyShaderOps(
      {
        getPanes: () => this.paneManager.getPanes(),
        getPaneById: (id) => this.paneManager.getPaneById(id),
      },
      shaderStages,
    );
    this.pluginOps = new ResttyPluginOps({
      restty: this,
      panes: () => this.panes(),
      pane: (id) => this.pane(id),
      activePane: () => this.activePane(),
      focusedPane: () => this.focusedPane(),
      addRenderStage: (stage, ownerPluginId) =>
        this.shaderOps.addManagedShaderStage(stage, ownerPluginId),
    });

    const mergedAppOptions = createMergedPaneAppOptions({
      appOptions: terminal,
      getFontSources: () => this.fontSources,
      onDesktopNotification,
      shaderOps: this.shaderOps,
      pluginOps: this.pluginOps,
      runRenderHooks: (payload) => this.runRenderHooks(payload),
    });

    const paneManagerEventHandlers = createPaneManagerEventHandlers({
      shaderOps: this.shaderOps,
      emitPluginEvent: (event, payload) => this.emitPluginEvent(event, payload),
      onPaneCreated,
      onPaneClosed,
      onPaneSplit,
      onActivePaneChange,
      onLayoutChanged,
    });

    this.paneManager = createResttyAppPaneManager({
      ...paneManagerOptions,
      appOptions: mergedAppOptions,
      ...paneManagerEventHandlers,
    });

    if (createInitialPane) {
      const focus =
        typeof createInitialPane === "object" ? (createInitialPane.focus ?? true) : true;
      this.createInitialPane({ focus });
    }
  }

  getPanes(): ResttyManagedAppPane[] {
    return this.paneManager.getPanes();
  }

  getPaneById(id: number): ResttyManagedAppPane | null {
    return this.paneManager.getPaneById(id);
  }

  getActivePane(): ResttyManagedAppPane | null {
    return this.paneManager.getActivePane();
  }

  getFocusedPane(): ResttyManagedAppPane | null {
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
      updates[i] = panes[i].app.setFontSources(this.fontSources ?? []);
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

  createInitialPane(options?: { focus?: boolean }): ResttyManagedAppPane {
    return paneOps.createInitialPane(this.paneManager, this.lifecycleHooks(), options);
  }

  splitActivePane(direction: ResttyPaneSplitDirection): ResttyManagedAppPane | null {
    return paneOps.splitActivePane(
      this.paneManager,
      this.paneLookup(),
      this.lifecycleHooks(),
      direction,
    );
  }

  splitPane(id: number, direction: ResttyPaneSplitDirection): ResttyManagedAppPane | null {
    return paneOps.splitPane(this.paneManager, this.lifecycleHooks(), id, direction);
  }

  closePane(id: number): boolean {
    return paneOps.closePane(this.paneManager, this.lifecycleHooks(), id);
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
    paneOps.setActivePane(this.paneManager, this.paneLookup(), this.lifecycleHooks(), id, options);
  }

  markPaneFocused(id: number, options?: { focus?: boolean }): void {
    paneOps.markPaneFocused(
      this.paneManager,
      this.paneLookup(),
      this.lifecycleHooks(),
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
    await this.pluginOps.use(plugin, options);
  }

  async loadPlugins(
    manifest: ReadonlyArray<ResttyPluginManifestEntry>,
    registry: ResttyPluginRegistry,
  ): Promise<ResttyPluginLoadResult[]> {
    return this.pluginOps.loadPlugins(manifest, registry);
  }

  unuse(pluginId: string): boolean {
    return this.pluginOps.unuse(pluginId);
  }

  plugins(): string[] {
    return this.pluginOps.plugins();
  }

  pluginInfo(pluginId: string): ResttyPluginInfo | null;
  pluginInfo(): ResttyPluginInfo[];
  pluginInfo(pluginId?: string): ResttyPluginInfo | ResttyPluginInfo[] | null {
    if (typeof pluginId === "string") return this.pluginOps.pluginInfo(pluginId);
    return this.pluginOps.pluginInfo();
  }

  destroy(): void {
    this.pluginOps.destroy();
    this.shaderOps.clear();
    this.paneManager.destroy();
  }

  connectPty(url = ""): void {
    paneOps.connectPty(this.paneLookup(), this.lifecycleHooks(), url);
  }

  disconnectPty(): void {
    paneOps.disconnectPty(this.paneLookup(), this.lifecycleHooks());
  }

  resize(cols: number, rows: number): void {
    paneOps.resize(this.paneLookup(), this.lifecycleAndPluginHooks(), cols, rows);
  }

  focus(): void {
    paneOps.focus(this.paneLookup(), this.lifecycleAndPluginHooks());
  }

  blur(): void {
    paneOps.blur(this.paneLookup(), this.lifecycleAndPluginHooks());
  }

  private paneLookup(): {
    getPanes: () => ResttyManagedAppPane[];
    getPaneById: (id: number) => ResttyManagedAppPane | null;
    getActivePane: () => ResttyManagedAppPane | null;
    getFocusedPane: () => ResttyManagedAppPane | null;
    openPaneSearch: ResttyAppPaneManager["openPaneSearch"];
    closePaneSearch: ResttyAppPaneManager["closePaneSearch"];
    togglePaneSearch: ResttyAppPaneManager["togglePaneSearch"];
    isPaneSearchOpen: ResttyAppPaneManager["isPaneSearchOpen"];
    getSearchUiStyleOptions: ResttyAppPaneManager["getSearchUiStyleOptions"];
    setSearchUiStyleOptions: ResttyAppPaneManager["setSearchUiStyleOptions"];
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

  private lifecycleHooks(): {
    runLifecycleHooks: (payload: ResttyLifecycleHookPayload) => void;
  } {
    return {
      runLifecycleHooks: (payload) => this.runLifecycleHooks(payload),
    };
  }

  private lifecycleAndPluginHooks(): {
    runLifecycleHooks: (payload: ResttyLifecycleHookPayload) => void;
    emitPluginEvent: <E extends keyof ResttyPluginEvents>(
      event: E,
      payload: ResttyPluginEvents[E],
    ) => void;
  } {
    return {
      runLifecycleHooks: (payload) => this.runLifecycleHooks(payload),
      emitPluginEvent: (event, payload) => this.emitPluginEvent(event, payload),
    };
  }

  protected requireActivePaneHandle(): ResttyPaneHandle {
    return paneOps.requireActivePaneHandle(this.paneLookup());
  }

  private runLifecycleHooks(payload: ResttyLifecycleHookPayload): void {
    this.pluginOps.runLifecycleHooks(payload);
  }

  private runRenderHooks(payload: ResttyRenderHookPayload): void {
    this.pluginOps.runRenderHooks(payload);
  }

  private emitPluginEvent<E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ): void {
    this.pluginOps.emitPluginEvent(event, payload);
  }
}

/** Create a new Restty instance with the given options. */
export function createRestty(options: ResttyConfig): Restty {
  return new Restty(options);
}

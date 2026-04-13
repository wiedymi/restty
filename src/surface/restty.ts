import { createResttyManagedPaneManager } from "./panes/managed-pane-manager";
import type { ResttyFontSource, ResttyShaderStage } from "../runtime/core/models";
import type {
  ResttyManagedPaneManager,
  ResttyManagedPane,
  ResttyManagedPaneSearchUiStyleOptions,
  ResttyManagedPaneStyleOptions,
} from "./panes/managed-pane-types";
import { ResttyPaneHandle } from "./restty/pane-handle";
import { ResttyActivePaneApi } from "./restty/active-pane-api";
import {
  createMergedPaneServicesConfig,
  createMergedPaneTerminalConfig,
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
} from "./plugins/types";
import type {
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
} from "./plugins/context.types";
import { ResttyPluginHost } from "./plugins/host";
import type { ResttyConfig } from "./restty/config";
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
export type { ResttySurfaceEvents } from "./restty/events";

/**
 * Main entry point for the restty terminal widget. Manages a set of
 * split panes, each running its own terminal runtime, and exposes
 * convenience methods that operate on the active pane.
 */
export class Restty extends ResttyActivePaneApi {
  readonly paneManager: ResttyManagedPaneManager;
  private fontSources: ResttyFontSource[] | undefined;
  private readonly shaderOps: ResttyShaderOps;
  private readonly pluginHost: ResttyPluginHost;
  private readonly pluginSurfaceApi: ResttyPluginHostApi;

  constructor(options: ResttyConfig) {
    super();
    const { root, session, surface, terminal, services } = options;
    const {
      paneDom,
      autoInit,
      minPaneSize,
      paneStyles,
      searchUi,
      shortcuts,
      contextMenu,
      defaultContextMenu,
      createInitialPane = true,
      events,
    } = surface ?? {};
    const {
      onPaneCreated,
      onPaneClosed,
      onPaneSplit,
      onActivePaneChange,
      onLayoutChanged,
      onDesktopNotification,
    } = events ?? {};

    this.fontSources = undefined;
    this.pluginSurfaceApi = this.createPluginSurfaceApi();
    this.shaderOps = new ResttyShaderOps({
      getPanes: () => this.paneManager.getPanes(),
      getPaneById: (id) => this.paneManager.getPaneById(id),
    });
    this.pluginHost = new ResttyPluginHost({
      restty: this.pluginSurfaceApi,
      panes: () => this.panes(),
      pane: (id) => this.pane(id),
      activePane: () => this.activePane(),
      focusedPane: () => this.focusedPane(),
      addRenderStage: (stage, ownerPluginId) =>
        this.shaderOps.addManagedShaderStage(stage, ownerPluginId),
    });

    const mergedTerminalConfig = createMergedPaneTerminalConfig({
      terminal,
      getFontSources: () => this.fontSources,
      shaderOps: this.shaderOps,
    });
    const mergedServicesConfig = createMergedPaneServicesConfig({
      services,
      onDesktopNotification,
      pluginHost: this.pluginHost,
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

    this.paneManager = createResttyManagedPaneManager({
      root,
      session,
      paneDom,
      autoInit,
      minPaneSize,
      paneStyles,
      searchUi,
      shortcuts,
      contextMenu,
      defaultContextMenu,
      terminal: mergedTerminalConfig,
      services: mergedServicesConfig,
      ...paneManagerEventHandlers,
    });

    if (createInitialPane) {
      const focus =
        typeof createInitialPane === "object" ? (createInitialPane.focus ?? true) : true;
      this.createInitialPane({ focus });
    }
  }

  getPanes(): ResttyManagedPane[] {
    return this.paneManager.getPanes();
  }

  getPaneById(id: number): ResttyManagedPane | null {
    return this.paneManager.getPaneById(id);
  }

  getActivePane(): ResttyManagedPane | null {
    return this.paneManager.getActivePane();
  }

  getFocusedPane(): ResttyManagedPane | null {
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

  createInitialPane(options?: { focus?: boolean }): ResttyManagedPane {
    return paneOps.createInitialPane(this.paneManager, this.lifecycleHooks(), options);
  }

  splitActivePane(direction: ResttyPaneSplitDirection): ResttyManagedPane | null {
    return paneOps.splitActivePane(
      this.paneManager,
      this.paneLookup(),
      this.lifecycleHooks(),
      direction,
    );
  }

  splitPane(id: number, direction: ResttyPaneSplitDirection): ResttyManagedPane | null {
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

  destroy(): void {
    this.pluginHost.destroy();
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

  private createPluginSurfaceApi(): ResttyPluginHostApi {
    const requirePaneHandle = (id: number): ResttyPaneHandle => {
      const handle = this.pane(id);
      if (!handle) {
        throw new Error(`Restty plugin surface could not resolve pane ${id}`);
      }
      return handle;
    };

    return {
      panes: () => this.panes(),
      pane: (id) => this.pane(id),
      activePane: () => this.activePane(),
      focusedPane: () => this.focusedPane(),
      forEachPane: (visitor) => {
        this.forEachPane(visitor);
      },
      isPtyConnected: () => this.isPtyConnected(),
      setRenderer: (value) => this.setRenderer(value),
      setPaused: (value) => this.setPaused(value),
      togglePause: () => this.togglePause(),
      setFontSize: (value) => this.setFontSize(value),
      setLigatures: (value) => this.setLigatures(value),
      setFontHinting: (value) => this.setFontHinting(value),
      setFontHintTarget: (value) => this.setFontHintTarget(value),
      setFontSources: (sources) => this.setFontSources(sources),
      applyTheme: (theme, sourceLabel) => this.applyTheme(theme, sourceLabel),
      resetTheme: () => this.resetTheme(),
      sendInput: (text, source) => this.sendInput(text, source),
      sendKeyInput: (text, source) => this.sendKeyInput(text, source),
      clearScreen: () => this.clearScreen(),
      connectPty: (url) => this.connectPty(url),
      disconnectPty: () => this.disconnectPty(),
      setMouseMode: (value) => this.setMouseMode(value),
      getMouseStatus: () => this.getMouseStatus(),
      copySelectionToClipboard: () => this.copySelectionToClipboard(),
      pasteFromClipboard: () => this.pasteFromClipboard(),
      selectWordAtClientPoint: (clientX, clientY) => this.selectWordAtClientPoint(clientX, clientY),
      setSearchQuery: (query) => this.setSearchQuery(query),
      clearSearch: () => this.clearSearch(),
      searchNext: () => this.searchNext(),
      searchPrevious: () => this.searchPrevious(),
      getSearchState: () => this.getSearchState(),
      openSearch: (options) => this.openSearch(options),
      closeSearch: (options) => this.closeSearch(options),
      toggleSearch: (options) => this.toggleSearch(options),
      isSearchOpen: () => this.isSearchOpen(),
      resize: (cols, rows) => this.resize(cols, rows),
      focus: () => this.focus(),
      blur: () => this.blur(),
      updateSize: (force) => this.updateSize(force),
      getBackend: () => this.getBackend(),
      setShaderStages: (stages) => this.setShaderStages(stages),
      getShaderStages: () => this.getShaderStages(),
      addShaderStage: (stage) => this.addShaderStage(stage),
      removeShaderStage: (id) => this.removeShaderStage(id),
      createInitialPane: (options) => {
        const pane = this.createInitialPane(options);
        return requirePaneHandle(pane.id);
      },
      splitActivePane: (direction) => {
        const pane = this.splitActivePane(direction);
        return pane ? requirePaneHandle(pane.id) : null;
      },
      splitPane: (id, direction) => {
        const pane = this.splitPane(id, direction);
        return pane ? requirePaneHandle(pane.id) : null;
      },
      closePane: (id) => this.closePane(id),
      getPaneStyleOptions: () => this.getPaneStyleOptions(),
      setPaneStyleOptions: (options) => this.setPaneStyleOptions(options),
      getSearchUiStyleOptions: () => this.getSearchUiStyleOptions(),
      setSearchUiStyleOptions: (options) => this.setSearchUiStyleOptions(options),
      setActivePane: (id, options) => this.setActivePane(id, options),
      markPaneFocused: (id, options) => this.markPaneFocused(id, options),
      requestLayoutSync: () => this.requestLayoutSync(),
      hideContextMenu: () => this.hideContextMenu(),
    };
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
    this.pluginHost.runLifecycleHooks(payload);
  }

  private runRenderHooks(payload: ResttyRenderHookPayload): void {
    this.pluginHost.runRenderHooks(payload);
  }

  private emitPluginEvent<E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ): void {
    this.pluginHost.emitPluginEvent(event, payload);
  }
}

/** Create a new Restty instance with the given options. */
export function createRestty(options: ResttyConfig): Restty {
  return new Restty(options);
}

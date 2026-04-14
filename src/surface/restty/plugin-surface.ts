import type { ResttyPluginHostApi } from "../plugins/context.types";
import type { ResttySurfacePane } from "./events";
import type { ResttyPaneHandle } from "./pane-handle";
import { createResttyPluginSurfaceApi } from "./controller";

export type ResttyPluginSurfaceBridgeSource = Omit<
  ResttyPluginHostApi,
  "createInitialPane" | "splitActivePane" | "splitPane"
> & {
  createInitialPane: (options?: { focus?: boolean }) => ResttySurfacePane;
  splitActivePane: ResttyPluginHostApi["splitActivePane"];
  splitPane: ResttyPluginHostApi["splitPane"];
};

export function createResttyPluginSurfaceBridge(
  restty: ResttyPluginSurfaceBridgeSource,
): ResttyPluginHostApi {
  return createResttyPluginSurfaceApi({
    panes: () => restty.panes(),
    pane: (id) => restty.pane(id),
    activePane: () => restty.activePane(),
    focusedPane: () => restty.focusedPane(),
    forEachPane: (visitor) => {
      restty.forEachPane(visitor);
    },
    isPtyConnected: () => restty.isPtyConnected(),
    setRenderer: (value) => restty.setRenderer(value),
    setPaused: (value) => restty.setPaused(value),
    togglePause: () => restty.togglePause(),
    setFontSize: (value) => restty.setFontSize(value),
    setLigatures: (value) => restty.setLigatures(value),
    setFontHinting: (value) => restty.setFontHinting(value),
    setFontHintTarget: (value) => restty.setFontHintTarget(value),
    setFontSources: (sources) => restty.setFontSources(sources),
    applyTheme: (theme, sourceLabel) => restty.applyTheme(theme, sourceLabel),
    resetTheme: () => restty.resetTheme(),
    sendInput: (text, source) => restty.sendInput(text, source),
    sendKeyInput: (text, source) => restty.sendKeyInput(text, source),
    clearScreen: () => restty.clearScreen(),
    connectPty: (url) => restty.connectPty(url),
    disconnectPty: () => restty.disconnectPty(),
    setMouseMode: (value) => restty.setMouseMode(value),
    getMouseStatus: () => restty.getMouseStatus(),
    copySelectionToClipboard: () => restty.copySelectionToClipboard(),
    pasteFromClipboard: () => restty.pasteFromClipboard(),
    selectWordAtClientPoint: (clientX, clientY) => restty.selectWordAtClientPoint(clientX, clientY),
    setSearchQuery: (query) => restty.setSearchQuery(query),
    clearSearch: () => restty.clearSearch(),
    searchNext: () => restty.searchNext(),
    searchPrevious: () => restty.searchPrevious(),
    getSearchState: () => restty.getSearchState(),
    openSearch: (options) => restty.openSearch(options),
    closeSearch: (options) => restty.closeSearch(options),
    toggleSearch: (options) => restty.toggleSearch(options),
    isSearchOpen: () => restty.isSearchOpen(),
    resize: (cols, rows) => restty.resize(cols, rows),
    focus: () => restty.focus(),
    blur: () => restty.blur(),
    updateSize: (force) => restty.updateSize(force),
    getBackend: () => restty.getBackend(),
    setShaderStages: (stages) => restty.setShaderStages(stages),
    getShaderStages: () => restty.getShaderStages(),
    addShaderStage: (stage) => restty.addShaderStage(stage),
    removeShaderStage: (id) => restty.removeShaderStage(id),
    createInitialPaneSurface: (options) => restty.createInitialPane(options),
    splitActivePaneSurface: (direction) => restty.splitActivePane(direction),
    splitPaneSurface: (id, direction) => restty.splitPane(id, direction),
    closePane: (id) => restty.closePane(id),
    getPaneStyleOptions: () => restty.getPaneStyleOptions(),
    setPaneStyleOptions: (options) => restty.setPaneStyleOptions(options),
    getSearchUiStyleOptions: () => restty.getSearchUiStyleOptions(),
    setSearchUiStyleOptions: (options) => restty.setSearchUiStyleOptions(options),
    setActivePane: (id, options) => restty.setActivePane(id, options),
    markPaneFocused: (id, options) => restty.markPaneFocused(id, options),
    requestLayoutSync: () => restty.requestLayoutSync(),
    hideContextMenu: () => restty.hideContextMenu(),
  });
}

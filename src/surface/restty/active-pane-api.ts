import type { ResttyPaneApi, ResttyPaneHandle } from "./pane-handle";

export type ResttyActivePaneSurfaceApi = Omit<ResttyPaneApi, "id" | "resize" | "focus" | "blur">;

export abstract class ResttyActivePaneApi implements ResttyActivePaneSurfaceApi {
  protected abstract requireActivePaneHandle(): ResttyPaneHandle;

  isPtyConnected(): ReturnType<ResttyPaneApi["isPtyConnected"]> {
    return this.requireActivePaneHandle().isPtyConnected();
  }

  setRenderer(value: Parameters<ResttyPaneApi["setRenderer"]>[0]): void {
    this.requireActivePaneHandle().setRenderer(value);
  }

  setPaused(value: Parameters<ResttyPaneApi["setPaused"]>[0]): void {
    this.requireActivePaneHandle().setPaused(value);
  }

  togglePause(): void {
    this.requireActivePaneHandle().togglePause();
  }

  setFontSize(value: Parameters<ResttyPaneApi["setFontSize"]>[0]): void {
    this.requireActivePaneHandle().setFontSize(value);
  }

  setLigatures(value: Parameters<ResttyPaneApi["setLigatures"]>[0]): void {
    this.requireActivePaneHandle().setLigatures(value);
  }

  setFontHinting(value: Parameters<ResttyPaneApi["setFontHinting"]>[0]): void {
    this.requireActivePaneHandle().setFontHinting(value);
  }

  setFontHintTarget(value: Parameters<ResttyPaneApi["setFontHintTarget"]>[0]): void {
    this.requireActivePaneHandle().setFontHintTarget(value);
  }

  setFontSources(
    sources: Parameters<ResttyPaneApi["setFontSources"]>[0],
  ): ReturnType<ResttyPaneApi["setFontSources"]> {
    return this.requireActivePaneHandle().setFontSources(sources);
  }

  applyTheme(
    theme: Parameters<ResttyPaneApi["applyTheme"]>[0],
    sourceLabel?: Parameters<ResttyPaneApi["applyTheme"]>[1],
  ): void {
    this.requireActivePaneHandle().applyTheme(theme, sourceLabel);
  }

  resetTheme(): void {
    this.requireActivePaneHandle().resetTheme();
  }

  sendInput(
    text: Parameters<ResttyPaneApi["sendInput"]>[0],
    source?: Parameters<ResttyPaneApi["sendInput"]>[1],
  ): void {
    this.requireActivePaneHandle().sendInput(text, source);
  }

  sendKeyInput(
    text: Parameters<ResttyPaneApi["sendKeyInput"]>[0],
    source?: Parameters<ResttyPaneApi["sendKeyInput"]>[1],
  ): void {
    this.requireActivePaneHandle().sendKeyInput(text, source);
  }

  clearScreen(): void {
    this.requireActivePaneHandle().clearScreen();
  }

  connectPty(url: Parameters<ResttyPaneApi["connectPty"]>[0] = ""): void {
    this.requireActivePaneHandle().connectPty(url);
  }

  disconnectPty(): void {
    this.requireActivePaneHandle().disconnectPty();
  }

  setMouseMode(value: Parameters<ResttyPaneApi["setMouseMode"]>[0]): void {
    this.requireActivePaneHandle().setMouseMode(value);
  }

  getMouseStatus(): ReturnType<ResttyPaneApi["getMouseStatus"]> {
    return this.requireActivePaneHandle().getMouseStatus();
  }

  copySelectionToClipboard(): ReturnType<ResttyPaneApi["copySelectionToClipboard"]> {
    return this.requireActivePaneHandle().copySelectionToClipboard();
  }

  pasteFromClipboard(): ReturnType<ResttyPaneApi["pasteFromClipboard"]> {
    return this.requireActivePaneHandle().pasteFromClipboard();
  }

  selectWordAtClientPoint(
    clientX: Parameters<ResttyPaneApi["selectWordAtClientPoint"]>[0],
    clientY: Parameters<ResttyPaneApi["selectWordAtClientPoint"]>[1],
  ): ReturnType<ResttyPaneApi["selectWordAtClientPoint"]> {
    return this.requireActivePaneHandle().selectWordAtClientPoint(clientX, clientY);
  }

  setSearchQuery(query: Parameters<ResttyPaneApi["setSearchQuery"]>[0]): void {
    this.requireActivePaneHandle().setSearchQuery(query);
  }

  clearSearch(): void {
    this.requireActivePaneHandle().clearSearch();
  }

  searchNext(): void {
    this.requireActivePaneHandle().searchNext();
  }

  searchPrevious(): void {
    this.requireActivePaneHandle().searchPrevious();
  }

  getSearchState(): ReturnType<ResttyPaneApi["getSearchState"]> {
    return this.requireActivePaneHandle().getSearchState();
  }

  openSearch(options?: Parameters<ResttyPaneApi["openSearch"]>[0]): void {
    this.requireActivePaneHandle().openSearch(options);
  }

  closeSearch(options?: Parameters<ResttyPaneApi["closeSearch"]>[0]): void {
    this.requireActivePaneHandle().closeSearch(options);
  }

  toggleSearch(options?: Parameters<ResttyPaneApi["toggleSearch"]>[0]): void {
    this.requireActivePaneHandle().toggleSearch(options);
  }

  isSearchOpen(): boolean {
    return this.requireActivePaneHandle().isSearchOpen();
  }

  getSearchUiStyleOptions(): ReturnType<ResttyPaneApi["getSearchUiStyleOptions"]> {
    return this.requireActivePaneHandle().getSearchUiStyleOptions();
  }

  setSearchUiStyleOptions(options: Parameters<ResttyPaneApi["setSearchUiStyleOptions"]>[0]): void {
    this.requireActivePaneHandle().setSearchUiStyleOptions(options);
  }

  setShaderStages(stages: Parameters<ResttyPaneApi["setShaderStages"]>[0]): void {
    this.requireActivePaneHandle().setShaderStages(stages);
  }

  getShaderStages(): ReturnType<ResttyPaneApi["getShaderStages"]> {
    return this.requireActivePaneHandle().getShaderStages();
  }

  updateSize(force?: boolean): void {
    this.requireActivePaneHandle().updateSize(force);
  }

  getBackend(): string {
    return this.requireActivePaneHandle().getBackend();
  }
}

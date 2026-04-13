import type { InputHandler, MouseMode } from "../../input";
import type { GhosttyTheme } from "../../theme";
import type {
  ResttyFontHintTarget,
  ResttyFontSource,
  ResttySearchState,
} from "../../runtime/core/models";
import type { ResttyPaneHandle } from "../restty-pane-handle";
import type {
  ResttyPaneSearchUiCloseOptions,
  ResttyPaneSearchUiOpenOptions,
} from "../pane-search-ui";
import type { ResttyManagedPaneSearchUiStyleOptions } from "../panes/managed-pane-types";

export abstract class ResttyActivePaneApi {
  protected abstract requireActivePaneHandle(): ResttyPaneHandle;

  isPtyConnected(): boolean {
    return this.requireActivePaneHandle().isPtyConnected();
  }

  setRenderer(value: "auto" | "webgpu" | "webgl2"): void {
    this.requireActivePaneHandle().setRenderer(value);
  }

  setPaused(value: boolean): void {
    this.requireActivePaneHandle().setPaused(value);
  }

  togglePause(): void {
    this.requireActivePaneHandle().togglePause();
  }

  setFontSize(value: number): void {
    this.requireActivePaneHandle().setFontSize(value);
  }

  setLigatures(value: boolean): void {
    this.requireActivePaneHandle().setLigatures(value);
  }

  setFontHinting(value: boolean): void {
    this.requireActivePaneHandle().setFontHinting(value);
  }

  setFontHintTarget(value: ResttyFontHintTarget): void {
    this.requireActivePaneHandle().setFontHintTarget(value);
  }

  setFontSources(sources: ResttyFontSource[]): Promise<void> {
    return this.requireActivePaneHandle().setFontSources(sources);
  }

  applyTheme(theme: GhosttyTheme, sourceLabel?: string): void {
    this.requireActivePaneHandle().applyTheme(theme, sourceLabel);
  }

  resetTheme(): void {
    this.requireActivePaneHandle().resetTheme();
  }

  sendInput(text: string, source?: string): void {
    this.requireActivePaneHandle().sendInput(text, source);
  }

  sendKeyInput(text: string, source?: string): void {
    this.requireActivePaneHandle().sendKeyInput(text, source);
  }

  clearScreen(): void {
    this.requireActivePaneHandle().clearScreen();
  }

  connectPty(url = ""): void {
    this.requireActivePaneHandle().connectPty(url);
  }

  disconnectPty(): void {
    this.requireActivePaneHandle().disconnectPty();
  }

  setMouseMode(value: MouseMode): void {
    this.requireActivePaneHandle().setMouseMode(value);
  }

  getMouseStatus(): ReturnType<InputHandler["getMouseStatus"]> {
    return this.requireActivePaneHandle().getMouseStatus();
  }

  copySelectionToClipboard(): Promise<boolean> {
    return this.requireActivePaneHandle().copySelectionToClipboard();
  }

  pasteFromClipboard(): Promise<boolean> {
    return this.requireActivePaneHandle().pasteFromClipboard();
  }

  selectWordAtClientPoint(clientX: number, clientY: number): boolean {
    return this.requireActivePaneHandle().selectWordAtClientPoint(clientX, clientY);
  }

  setSearchQuery(query: string): void {
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

  getSearchState(): ResttySearchState {
    return this.requireActivePaneHandle().getSearchState();
  }

  openSearch(options?: ResttyPaneSearchUiOpenOptions): void {
    this.requireActivePaneHandle().openSearch(options);
  }

  closeSearch(options?: ResttyPaneSearchUiCloseOptions): void {
    this.requireActivePaneHandle().closeSearch(options);
  }

  toggleSearch(options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions): void {
    this.requireActivePaneHandle().toggleSearch(options);
  }

  isSearchOpen(): boolean {
    return this.requireActivePaneHandle().isSearchOpen();
  }

  getSearchUiStyleOptions(): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>> {
    return this.requireActivePaneHandle().getSearchUiStyleOptions();
  }

  setSearchUiStyleOptions(options: ResttyManagedPaneSearchUiStyleOptions): void {
    this.requireActivePaneHandle().setSearchUiStyleOptions(options);
  }

  setShaderStages(stages: ReturnType<ResttyPaneHandle["getShaderStages"]>): void {
    this.requireActivePaneHandle().setShaderStages(stages);
  }

  getShaderStages(): ReturnType<ResttyPaneHandle["getShaderStages"]> {
    return this.requireActivePaneHandle().getShaderStages();
  }

  updateSize(force?: boolean): void {
    this.requireActivePaneHandle().updateSize(force);
  }

  getBackend(): string {
    return this.requireActivePaneHandle().getBackend();
  }
}

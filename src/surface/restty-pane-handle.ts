import type { InputHandler, MouseMode } from "../input";
import type { GhosttyTheme } from "../theme";
import type {
  ResttyManagedAppPane,
  ResttyManagedPaneSearchUiStyleOptions,
} from "./pane-app-manager";
import type {
  ResttyFontHintTarget,
  ResttyFontSource,
  ResttySearchState,
  ResttyShaderStage,
} from "../runtime/types";
import type {
  ResttyPaneSearchUiCloseOptions,
  ResttyPaneSearchUiOpenOptions,
} from "./pane-search-ui";

type PaneSearchUiHandleOps = {
  open: (paneId: number, options?: ResttyPaneSearchUiOpenOptions) => void;
  close: (paneId: number, options?: ResttyPaneSearchUiCloseOptions) => void;
  toggle: (
    paneId: number,
    options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions,
  ) => void;
  isOpen: (paneId: number) => boolean;
  getStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
  setStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
};

/**
 * Public API surface exposed by each pane handle.
 */
export type ResttyPaneApi = {
  id: number;
  setRenderer: (value: "auto" | "webgpu" | "webgl2") => void;
  setPaused: (value: boolean) => void;
  togglePause: () => void;
  setFontSize: (value: number) => void;
  setLigatures: (value: boolean) => void;
  setFontHinting: (value: boolean) => void;
  setFontHintTarget: (value: ResttyFontHintTarget) => void;
  setFontSources: (sources: ResttyFontSource[]) => Promise<void>;
  applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
  resetTheme: () => void;
  sendInput: (text: string, source?: string) => void;
  sendKeyInput: (text: string, source?: string) => void;
  clearScreen: () => void;
  connectPty: (url?: string) => void;
  disconnectPty: () => void;
  isPtyConnected: () => boolean;
  setMouseMode: (value: MouseMode) => void;
  getMouseStatus: () => ReturnType<InputHandler["getMouseStatus"]>;
  copySelectionToClipboard: () => Promise<boolean>;
  pasteFromClipboard: () => Promise<boolean>;
  selectWordAtClientPoint: (clientX: number, clientY: number) => boolean;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  searchNext: () => void;
  searchPrevious: () => void;
  getSearchState: () => ResttySearchState;
  openSearch: (options?: ResttyPaneSearchUiOpenOptions) => void;
  closeSearch: (options?: ResttyPaneSearchUiCloseOptions) => void;
  toggleSearch: (options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions) => void;
  isSearchOpen: () => boolean;
  resize: (cols: number, rows: number) => void;
  focus: () => void;
  blur: () => void;
  updateSize: (force?: boolean) => void;
  getBackend: () => string;
  getSearchUiStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
  setSearchUiStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
  setShaderStages: (stages: ResttyShaderStage[]) => void;
  getShaderStages: () => ResttyShaderStage[];
};

/**
 * Thin wrapper around a managed pane that delegates calls to the
 * underlying app. Resolves the pane lazily so it stays valid across
 * layout changes.
 */
export class ResttyPaneHandle implements ResttyPaneApi {
  private readonly resolvePane: () => ResttyManagedAppPane;
  private readonly searchUiOps: PaneSearchUiHandleOps;

  constructor(resolvePane: () => ResttyManagedAppPane, searchUiOps: PaneSearchUiHandleOps) {
    this.resolvePane = resolvePane;
    this.searchUiOps = searchUiOps;
  }

  get id(): number {
    return this.resolvePane().id;
  }

  setRenderer(value: "auto" | "webgpu" | "webgl2"): void {
    this.resolvePane().app.terminal.setRenderer(value);
  }

  setPaused(value: boolean): void {
    this.resolvePane().app.terminal.setPaused(value);
  }

  togglePause(): void {
    this.resolvePane().app.terminal.togglePause();
  }

  setFontSize(value: number): void {
    this.resolvePane().app.terminal.setFontSize(value);
  }

  setLigatures(value: boolean): void {
    this.resolvePane().app.terminal.setLigatures(value);
  }

  setFontHinting(value: boolean): void {
    this.resolvePane().app.terminal.setFontHinting(value);
  }

  setFontHintTarget(value: ResttyFontHintTarget): void {
    this.resolvePane().app.terminal.setFontHintTarget(value);
  }

  setFontSources(sources: ResttyFontSource[]): Promise<void> {
    return this.resolvePane().app.terminal.setFontSources(sources);
  }

  applyTheme(theme: GhosttyTheme, sourceLabel?: string): void {
    this.resolvePane().app.terminal.applyTheme(theme, sourceLabel);
  }

  resetTheme(): void {
    this.resolvePane().app.terminal.resetTheme();
  }

  sendInput(text: string, source?: string): void {
    this.resolvePane().app.io.sendInput(text, source);
  }

  sendKeyInput(text: string, source?: string): void {
    this.resolvePane().app.io.sendKeyInput(text, source);
  }

  clearScreen(): void {
    this.resolvePane().app.terminal.clearScreen();
  }

  connectPty(url = ""): void {
    this.resolvePane().app.io.connectPty(url);
  }

  disconnectPty(): void {
    this.resolvePane().app.io.disconnectPty();
  }

  isPtyConnected(): boolean {
    return this.resolvePane().app.io.isPtyConnected();
  }

  setMouseMode(value: MouseMode): void {
    this.resolvePane().app.interaction.setMouseMode(value);
  }

  getMouseStatus(): ReturnType<InputHandler["getMouseStatus"]> {
    return this.resolvePane().app.interaction.getMouseStatus();
  }

  copySelectionToClipboard(): Promise<boolean> {
    return this.resolvePane().app.interaction.copySelectionToClipboard();
  }

  pasteFromClipboard(): Promise<boolean> {
    return this.resolvePane().app.interaction.pasteFromClipboard();
  }

  selectWordAtClientPoint(clientX: number, clientY: number): boolean {
    return this.resolvePane().app.interaction.selectWordAtClientPoint(clientX, clientY);
  }

  setSearchQuery(query: string): void {
    this.resolvePane().app.search.setQuery(query);
  }

  clearSearch(): void {
    this.resolvePane().app.search.clear();
  }

  searchNext(): void {
    this.resolvePane().app.search.next();
  }

  searchPrevious(): void {
    this.resolvePane().app.search.previous();
  }

  getSearchState(): ResttySearchState {
    return this.resolvePane().app.search.getState();
  }

  openSearch(options?: ResttyPaneSearchUiOpenOptions): void {
    this.searchUiOps.open(this.id, options);
  }

  closeSearch(options?: ResttyPaneSearchUiCloseOptions): void {
    this.searchUiOps.close(this.id, options);
  }

  toggleSearch(options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions): void {
    this.searchUiOps.toggle(this.id, options);
  }

  isSearchOpen(): boolean {
    return this.searchUiOps.isOpen(this.id);
  }

  resize(cols: number, rows: number): void {
    this.resolvePane().app.interaction.resize(cols, rows);
  }

  focus(): void {
    this.resolvePane().app.interaction.focus();
  }

  blur(): void {
    this.resolvePane().app.interaction.blur();
  }

  updateSize(force?: boolean): void {
    this.resolvePane().app.interaction.updateSize(force);
  }

  getBackend(): string {
    return this.resolvePane().app.render.getBackend();
  }

  getSearchUiStyleOptions(): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>> {
    return this.searchUiOps.getStyleOptions();
  }

  setSearchUiStyleOptions(options: ResttyManagedPaneSearchUiStyleOptions): void {
    this.searchUiOps.setStyleOptions(options);
  }

  setShaderStages(stages: ResttyShaderStage[]): void {
    this.resolvePane().app.render.setShaderStages(stages);
  }

  getShaderStages(): ResttyShaderStage[] {
    return this.resolvePane().app.render.getShaderStages();
  }
}

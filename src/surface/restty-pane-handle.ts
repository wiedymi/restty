import type { InputHandler, MouseMode } from "../input";
import type { GhosttyTheme } from "../theme";
import type {
  ResttyManagedAppPane,
  ResttyManagedPaneSearchUiStyleOptions,
} from "./pane-app-manager";
import type { ResttySearchState, ResttyShaderStage } from "../runtime/types";
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
  dumpAtlasForCodepoint: (cp: number) => void;
  resize: (cols: number, rows: number) => void;
  focus: () => void;
  blur: () => void;
  updateSize: (force?: boolean) => void;
  getBackend: () => string;
  getSearchUiStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
  setSearchUiStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
  setShaderStages: (stages: ResttyShaderStage[]) => void;
  getShaderStages: () => ResttyShaderStage[];
  getRawPane: () => ResttyManagedAppPane;
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
    this.resolvePane().app.setRenderer(value);
  }

  setPaused(value: boolean): void {
    this.resolvePane().app.setPaused(value);
  }

  togglePause(): void {
    this.resolvePane().app.togglePause();
  }

  setFontSize(value: number): void {
    this.resolvePane().app.setFontSize(value);
  }

  applyTheme(theme: GhosttyTheme, sourceLabel?: string): void {
    this.resolvePane().app.applyTheme(theme, sourceLabel);
  }

  resetTheme(): void {
    this.resolvePane().app.resetTheme();
  }

  sendInput(text: string, source?: string): void {
    this.resolvePane().app.sendInput(text, source);
  }

  sendKeyInput(text: string, source?: string): void {
    this.resolvePane().app.sendKeyInput(text, source);
  }

  clearScreen(): void {
    this.resolvePane().app.clearScreen();
  }

  connectPty(url = ""): void {
    this.resolvePane().app.connectPty(url);
  }

  disconnectPty(): void {
    this.resolvePane().app.disconnectPty();
  }

  isPtyConnected(): boolean {
    return this.resolvePane().app.isPtyConnected();
  }

  setMouseMode(value: MouseMode): void {
    this.resolvePane().app.setMouseMode(value);
  }

  getMouseStatus(): ReturnType<InputHandler["getMouseStatus"]> {
    return this.resolvePane().app.getMouseStatus();
  }

  copySelectionToClipboard(): Promise<boolean> {
    return this.resolvePane().app.copySelectionToClipboard();
  }

  pasteFromClipboard(): Promise<boolean> {
    return this.resolvePane().app.pasteFromClipboard();
  }

  selectWordAtClientPoint(clientX: number, clientY: number): boolean {
    return this.resolvePane().app.selectWordAtClientPoint(clientX, clientY);
  }

  setSearchQuery(query: string): void {
    this.resolvePane().app.setSearchQuery(query);
  }

  clearSearch(): void {
    this.resolvePane().app.clearSearch();
  }

  searchNext(): void {
    this.resolvePane().app.searchNext();
  }

  searchPrevious(): void {
    this.resolvePane().app.searchPrevious();
  }

  getSearchState(): ResttySearchState {
    return this.resolvePane().app.getSearchState();
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

  dumpAtlasForCodepoint(cp: number): void {
    this.resolvePane().app.dumpAtlasForCodepoint(cp);
  }

  resize(cols: number, rows: number): void {
    this.resolvePane().app.resize(cols, rows);
  }

  focus(): void {
    this.resolvePane().app.focus();
  }

  blur(): void {
    this.resolvePane().app.blur();
  }

  updateSize(force?: boolean): void {
    this.resolvePane().app.updateSize(force);
  }

  getBackend(): string {
    return this.resolvePane().app.getBackend();
  }

  getSearchUiStyleOptions(): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>> {
    return this.searchUiOps.getStyleOptions();
  }

  setSearchUiStyleOptions(options: ResttyManagedPaneSearchUiStyleOptions): void {
    this.searchUiOps.setStyleOptions(options);
  }

  setShaderStages(stages: ResttyShaderStage[]): void {
    this.resolvePane().app.setShaderStages(stages);
  }

  getShaderStages(): ResttyShaderStage[] {
    return this.resolvePane().app.getShaderStages();
  }

  getRawPane(): ResttyManagedAppPane {
    return this.resolvePane();
  }
}

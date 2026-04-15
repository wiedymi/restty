import type {
  ResttyManagedPane,
  ResttyManagedPaneSearchUiStyleOptions,
} from "../panes/managed-pane-types";
import type {
  ResttyRuntimeInteractionApi,
  ResttyRuntimeIoApi,
  ResttyRuntimeRenderApi,
  ResttyRuntimeSearchApi,
  ResttyRuntimeTerminalApi,
} from "../../runtime/core/api";
import type { ResttyPaneSearchUiCloseOptions, ResttyPaneSearchUiOpenOptions } from "../search-ui";

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
  setRenderer: ResttyRuntimeTerminalApi["setRenderer"];
  setPaused: ResttyRuntimeTerminalApi["setPaused"];
  togglePause: ResttyRuntimeTerminalApi["togglePause"];
  setFontSize: ResttyRuntimeTerminalApi["setFontSize"];
  setLigatures: ResttyRuntimeTerminalApi["setLigatures"];
  setFontHinting: ResttyRuntimeTerminalApi["setFontHinting"];
  setFontHintTarget: ResttyRuntimeTerminalApi["setFontHintTarget"];
  setFontSources: ResttyRuntimeTerminalApi["setFontSources"];
  applyTheme: ResttyRuntimeTerminalApi["applyTheme"];
  resetTheme: ResttyRuntimeTerminalApi["resetTheme"];
  sendInput: ResttyRuntimeIoApi["sendInput"];
  sendKeyInput: ResttyRuntimeIoApi["sendKeyInput"];
  clearScreen: ResttyRuntimeTerminalApi["clearScreen"];
  connectPty: ResttyRuntimeIoApi["connectPty"];
  disconnectPty: ResttyRuntimeIoApi["disconnectPty"];
  isPtyConnected: ResttyRuntimeIoApi["isPtyConnected"];
  setMouseMode: ResttyRuntimeInteractionApi["setMouseMode"];
  getMouseStatus: ResttyRuntimeInteractionApi["getMouseStatus"];
  copySelectionToClipboard: ResttyRuntimeInteractionApi["copySelectionToClipboard"];
  pasteFromClipboard: ResttyRuntimeInteractionApi["pasteFromClipboard"];
  selectWordAtClientPoint: ResttyRuntimeInteractionApi["selectWordAtClientPoint"];
  setSearchQuery: ResttyRuntimeSearchApi["setQuery"];
  clearSearch: ResttyRuntimeSearchApi["clear"];
  searchNext: ResttyRuntimeSearchApi["next"];
  searchPrevious: ResttyRuntimeSearchApi["previous"];
  getSearchState: ResttyRuntimeSearchApi["getState"];
  openSearch: (options?: ResttyPaneSearchUiOpenOptions) => void;
  closeSearch: (options?: ResttyPaneSearchUiCloseOptions) => void;
  toggleSearch: (options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions) => void;
  isSearchOpen: () => boolean;
  resize: ResttyRuntimeInteractionApi["resize"];
  focus: ResttyRuntimeInteractionApi["focus"];
  blur: ResttyRuntimeInteractionApi["blur"];
  updateSize: ResttyRuntimeInteractionApi["updateSize"];
  getBackend: ResttyRuntimeRenderApi["getBackend"];
  getSearchUiStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
  setSearchUiStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
  setShaderStages: ResttyRuntimeRenderApi["setShaderStages"];
  getShaderStages: ResttyRuntimeRenderApi["getShaderStages"];
};

/**
 * Thin wrapper around a managed pane that delegates calls to the
 * underlying runtime. Resolves the pane lazily so it stays valid across
 * layout changes.
 */
export class ResttyPaneHandle implements ResttyPaneApi {
  private readonly resolvePane: () => ResttyManagedPane;
  private readonly searchUiOps: PaneSearchUiHandleOps;

  constructor(resolvePane: () => ResttyManagedPane, searchUiOps: PaneSearchUiHandleOps) {
    this.resolvePane = resolvePane;
    this.searchUiOps = searchUiOps;
  }

  get id(): number {
    return this.resolvePane().id;
  }

  setRenderer(value: "auto" | "webgpu" | "webgl2"): void {
    this.resolvePane().setRenderer(value);
  }

  setPaused(value: boolean): void {
    this.resolvePane().setPaused(value);
  }

  togglePause(): void {
    this.resolvePane().togglePause();
  }

  setFontSize(value: number): void {
    this.resolvePane().setFontSize(value);
  }

  setLigatures(value: boolean): void {
    this.resolvePane().setLigatures(value);
  }

  setFontHinting(value: boolean): void {
    this.resolvePane().setFontHinting(value);
  }

  setFontHintTarget(value: ResttyFontHintTarget): void {
    this.resolvePane().setFontHintTarget(value);
  }

  setFontSources(sources: ResttyFontSource[]): Promise<void> {
    return this.resolvePane().setFontSources(sources);
  }

  applyTheme(theme: GhosttyTheme, sourceLabel?: string): void {
    this.resolvePane().applyTheme(theme, sourceLabel);
  }

  resetTheme(): void {
    this.resolvePane().resetTheme();
  }

  sendInput(text: string, source?: string): void {
    this.resolvePane().sendInput(text, source);
  }

  sendKeyInput(text: string, source?: string): void {
    this.resolvePane().sendKeyInput(text, source);
  }

  clearScreen(): void {
    this.resolvePane().clearScreen();
  }

  connectPty(url = ""): void {
    this.resolvePane().connectPty(url);
  }

  disconnectPty(): void {
    this.resolvePane().disconnectPty();
  }

  isPtyConnected(): boolean {
    return this.resolvePane().isPtyConnected();
  }

  setMouseMode(value: MouseMode): void {
    this.resolvePane().setMouseMode(value);
  }

  getMouseStatus(): ReturnType<InputHandler["getMouseStatus"]> {
    return this.resolvePane().getMouseStatus();
  }

  copySelectionToClipboard(): Promise<boolean> {
    return this.resolvePane().copySelectionToClipboard();
  }

  pasteFromClipboard(): Promise<boolean> {
    return this.resolvePane().pasteFromClipboard();
  }

  selectWordAtClientPoint(clientX: number, clientY: number): boolean {
    return this.resolvePane().selectWordAtClientPoint(clientX, clientY);
  }

  setSearchQuery(query: string): void {
    this.resolvePane().setSearchQuery(query);
  }

  clearSearch(): void {
    this.resolvePane().clearSearch();
  }

  searchNext(): void {
    this.resolvePane().searchNext();
  }

  searchPrevious(): void {
    this.resolvePane().searchPrevious();
  }

  getSearchState(): ResttySearchState {
    return this.resolvePane().getSearchState();
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
    this.resolvePane().resize(cols, rows);
  }

  focus(): void {
    this.resolvePane().focus();
  }

  blur(): void {
    this.resolvePane().blur();
  }

  updateSize(force?: boolean): void {
    this.resolvePane().updateSize(force);
  }

  getBackend(): string {
    return this.resolvePane().getBackend();
  }

  getSearchUiStyleOptions(): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>> {
    return this.searchUiOps.getStyleOptions();
  }

  setSearchUiStyleOptions(options: ResttyManagedPaneSearchUiStyleOptions): void {
    this.searchUiOps.setStyleOptions(options);
  }

  setShaderStages(stages: ResttyShaderStage[]): void {
    this.resolvePane().setShaderStages(stages);
  }

  getShaderStages(): ResttyShaderStage[] {
    return this.resolvePane().getShaderStages();
  }
}

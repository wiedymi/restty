import type { GhosttyTheme } from "../theme";
import type { InputHandler } from "../input";
import {
  createResttyAppPaneManager,
  type CreateResttyAppPaneManagerOptions,
  type ResttyPaneAppOptionsInput,
  type ResttyManagedAppPane,
} from "./pane-app-manager";
import type { ResttyPaneManager, ResttyPaneSplitDirection } from "./panes";
import type { ResttyFontSource } from "./types";

export type ResttyOptions = Omit<CreateResttyAppPaneManagerOptions, "appOptions"> & {
  appOptions?: CreateResttyAppPaneManagerOptions["appOptions"];
  fontSources?: ResttyPaneAppOptionsInput["fontSources"];
  createInitialPane?: boolean | { focus?: boolean };
};

export class Restty {
  readonly paneManager: ResttyPaneManager<ResttyManagedAppPane>;
  private fontSources: ResttyFontSource[] | undefined;

  constructor(options: ResttyOptions) {
    const { createInitialPane = true, appOptions, fontSources, ...paneManagerOptions } = options;
    this.fontSources = fontSources ? [...fontSources] : undefined;
    const mergedAppOptions: CreateResttyAppPaneManagerOptions["appOptions"] = (context) => {
      const resolved = typeof appOptions === "function" ? appOptions(context) : (appOptions ?? {});
      if (!this.fontSources) return resolved;
      return {
        ...resolved,
        fontSources: this.fontSources,
      };
    };

    this.paneManager = createResttyAppPaneManager({
      ...paneManagerOptions,
      appOptions: mergedAppOptions,
    });

    if (createInitialPane) {
      const focus =
        typeof createInitialPane === "object" ? (createInitialPane.focus ?? true) : true;
      this.paneManager.createInitialPane({ focus });
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

  createInitialPane(options?: { focus?: boolean }): ResttyManagedAppPane {
    return this.paneManager.createInitialPane(options);
  }

  splitActivePane(direction: ResttyPaneSplitDirection): ResttyManagedAppPane | null {
    return this.paneManager.splitActivePane(direction);
  }

  splitPane(id: number, direction: ResttyPaneSplitDirection): ResttyManagedAppPane | null {
    return this.paneManager.splitPane(id, direction);
  }

  closePane(id: number): boolean {
    return this.paneManager.closePane(id);
  }

  setActivePane(id: number, options?: { focus?: boolean }): void {
    this.paneManager.setActivePane(id, options);
  }

  markPaneFocused(id: number, options?: { focus?: boolean }): void {
    this.paneManager.markPaneFocused(id, options);
  }

  requestLayoutSync(): void {
    this.paneManager.requestLayoutSync();
  }

  hideContextMenu(): void {
    this.paneManager.hideContextMenu();
  }

  destroy(): void {
    this.paneManager.destroy();
  }

  connectPty(url = ""): void {
    this.requireActivePane().app.connectPty(url);
  }

  disconnectPty(): void {
    this.requireActivePane().app.disconnectPty();
  }

  isPtyConnected(): boolean {
    return this.requireActivePane().app.isPtyConnected();
  }

  setRenderer(value: "auto" | "webgpu" | "webgl2"): void {
    this.requireActivePane().app.setRenderer(value);
  }

  setPaused(value: boolean): void {
    this.requireActivePane().app.setPaused(value);
  }

  togglePause(): void {
    this.requireActivePane().app.togglePause();
  }

  setFontSize(value: number): void {
    this.requireActivePane().app.setFontSize(value);
  }

  async setFontSources(sources: ResttyFontSource[]): Promise<void> {
    this.fontSources = sources.length ? [...sources] : undefined;
    const panes = this.getPanes();
    // eslint-disable-next-line unicorn/no-new-array
    const updates: Array<Promise<void>> = new Array(panes.length);
    for (let i = 0; i < panes.length; i += 1) {
      updates[i] = panes[i].app.setFontSources(this.fontSources ?? []);
    }
    await Promise.all(updates);
  }

  applyTheme(theme: GhosttyTheme, sourceLabel?: string): void {
    this.requireActivePane().app.applyTheme(theme, sourceLabel);
  }

  resetTheme(): void {
    this.requireActivePane().app.resetTheme();
  }

  sendInput(text: string, source?: string): void {
    this.requireActivePane().app.sendInput(text, source);
  }

  sendKeyInput(text: string, source?: string): void {
    this.requireActivePane().app.sendKeyInput(text, source);
  }

  clearScreen(): void {
    this.requireActivePane().app.clearScreen();
  }

  setMouseMode(value: string): void {
    this.requireActivePane().app.setMouseMode(value);
  }

  getMouseStatus(): ReturnType<InputHandler["getMouseStatus"]> {
    return this.requireActivePane().app.getMouseStatus();
  }

  copySelectionToClipboard(): Promise<boolean> {
    return this.requireActivePane().app.copySelectionToClipboard();
  }

  pasteFromClipboard(): Promise<boolean> {
    return this.requireActivePane().app.pasteFromClipboard();
  }

  dumpAtlasForCodepoint(cp: number): void {
    this.requireActivePane().app.dumpAtlasForCodepoint(cp);
  }

  updateSize(force?: boolean): void {
    this.requireActivePane().app.updateSize(force);
  }

  getBackend(): string {
    return this.requireActivePane().app.getBackend();
  }

  private requireActivePane(): ResttyManagedAppPane {
    const pane = this.getActivePane();
    if (!pane) {
      throw new Error("Restty has no active pane. Create or focus a pane first.");
    }
    return pane;
  }
}

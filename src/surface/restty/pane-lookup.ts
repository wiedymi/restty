import type { ResttyManagedPane, ResttyManagedPaneManager } from "../panes/managed-pane-types";

export type ResttyPaneLookup = {
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
};

type CreateResttyPaneLookupOptions = {
  paneManager: Pick<
    ResttyManagedPaneManager,
    | "openPaneSearch"
    | "closePaneSearch"
    | "togglePaneSearch"
    | "isPaneSearchOpen"
    | "getSearchUiStyleOptions"
    | "setSearchUiStyleOptions"
  >;
  getPanes: () => ResttyManagedPane[];
  getPaneById: (id: number) => ResttyManagedPane | null;
  getActivePane: () => ResttyManagedPane | null;
  getFocusedPane: () => ResttyManagedPane | null;
};

export function createResttyPaneLookup(options: CreateResttyPaneLookupOptions): ResttyPaneLookup {
  return {
    getPanes: () => options.getPanes(),
    getPaneById: (id) => options.getPaneById(id),
    getActivePane: () => options.getActivePane(),
    getFocusedPane: () => options.getFocusedPane(),
    openPaneSearch: (id, searchOptions) => {
      options.paneManager.openPaneSearch(id, searchOptions);
    },
    closePaneSearch: (id, searchOptions) => {
      options.paneManager.closePaneSearch(id, searchOptions);
    },
    togglePaneSearch: (id, searchOptions) => {
      options.paneManager.togglePaneSearch(id, searchOptions);
    },
    isPaneSearchOpen: (id) => options.paneManager.isPaneSearchOpen(id),
    getSearchUiStyleOptions: () => options.paneManager.getSearchUiStyleOptions(),
    setSearchUiStyleOptions: (searchOptions) => {
      options.paneManager.setSearchUiStyleOptions(searchOptions);
    },
  };
}

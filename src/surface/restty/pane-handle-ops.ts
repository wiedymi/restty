import type {
  ResttyManagedPane,
  ResttyManagedPaneSearchUiStyleOptions,
} from "../panes/managed-pane-types";
import { ResttyPaneHandle } from "./pane-handle";
import type { ResttyPaneSearchUiCloseOptions, ResttyPaneSearchUiOpenOptions } from "../search-ui";

type ResttyPaneLookup = {
  getPanes: () => ResttyManagedPane[];
  getPaneById: (id: number) => ResttyManagedPane | null;
  getActivePane: () => ResttyManagedPane | null;
  getFocusedPane: () => ResttyManagedPane | null;
  openPaneSearch: (id: number, options?: ResttyPaneSearchUiOpenOptions) => void;
  closePaneSearch: (id: number, options?: ResttyPaneSearchUiCloseOptions) => void;
  togglePaneSearch: (
    id: number,
    options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions,
  ) => void;
  isPaneSearchOpen: (id: number) => boolean;
  getSearchUiStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
  setSearchUiStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
};

export function requirePaneById(
  getPaneById: (id: number) => ResttyManagedPane | null,
  id: number,
): ResttyManagedPane {
  const pane = getPaneById(id);
  if (!pane) throw new Error(`Restty pane ${id} does not exist`);
  return pane;
}

export function makePaneHandle(
  lookup: Pick<
    ResttyPaneLookup,
    | "getPaneById"
    | "openPaneSearch"
    | "closePaneSearch"
    | "togglePaneSearch"
    | "isPaneSearchOpen"
    | "getSearchUiStyleOptions"
    | "setSearchUiStyleOptions"
  >,
  id: number,
): ResttyPaneHandle {
  return new ResttyPaneHandle(() => requirePaneById(lookup.getPaneById, id), {
    open: (paneId, options) => {
      lookup.openPaneSearch(paneId, options);
    },
    close: (paneId, options) => {
      lookup.closePaneSearch(paneId, options);
    },
    toggle: (paneId, options) => {
      lookup.togglePaneSearch(paneId, options);
    },
    isOpen: (paneId) => lookup.isPaneSearchOpen(paneId),
    getStyleOptions: () => lookup.getSearchUiStyleOptions(),
    setStyleOptions: (options) => {
      lookup.setSearchUiStyleOptions(options);
    },
  });
}

export function requireActivePaneHandle(
  lookup: Pick<
    ResttyPaneLookup,
    | "getActivePane"
    | "getPaneById"
    | "openPaneSearch"
    | "closePaneSearch"
    | "togglePaneSearch"
    | "isPaneSearchOpen"
    | "getSearchUiStyleOptions"
    | "setSearchUiStyleOptions"
  >,
): ResttyPaneHandle {
  const pane = lookup.getActivePane();
  if (!pane) {
    throw new Error("Restty has no active pane. Create or focus a pane first.");
  }
  return makePaneHandle(lookup, pane.id);
}

export function panes(
  lookup: Pick<
    ResttyPaneLookup,
    | "getPanes"
    | "getPaneById"
    | "openPaneSearch"
    | "closePaneSearch"
    | "togglePaneSearch"
    | "isPaneSearchOpen"
    | "getSearchUiStyleOptions"
    | "setSearchUiStyleOptions"
  >,
): ResttyPaneHandle[] {
  return lookup.getPanes().map((pane) => makePaneHandle(lookup, pane.id));
}

export function pane(
  lookup: Pick<
    ResttyPaneLookup,
    | "getPaneById"
    | "openPaneSearch"
    | "closePaneSearch"
    | "togglePaneSearch"
    | "isPaneSearchOpen"
    | "getSearchUiStyleOptions"
    | "setSearchUiStyleOptions"
  >,
  id: number,
): ResttyPaneHandle | null {
  if (!lookup.getPaneById(id)) return null;
  return makePaneHandle(lookup, id);
}

export function activePane(
  lookup: Pick<
    ResttyPaneLookup,
    | "getActivePane"
    | "getPaneById"
    | "openPaneSearch"
    | "closePaneSearch"
    | "togglePaneSearch"
    | "isPaneSearchOpen"
    | "getSearchUiStyleOptions"
    | "setSearchUiStyleOptions"
  >,
): ResttyPaneHandle | null {
  const active = lookup.getActivePane();
  if (!active) return null;
  return makePaneHandle(lookup, active.id);
}

export function focusedPane(
  lookup: Pick<
    ResttyPaneLookup,
    | "getFocusedPane"
    | "getPaneById"
    | "openPaneSearch"
    | "closePaneSearch"
    | "togglePaneSearch"
    | "isPaneSearchOpen"
    | "getSearchUiStyleOptions"
    | "setSearchUiStyleOptions"
  >,
): ResttyPaneHandle | null {
  const focused = lookup.getFocusedPane();
  if (!focused) return null;
  return makePaneHandle(lookup, focused.id);
}

export function forEachPane(
  lookup: Pick<
    ResttyPaneLookup,
    | "getPanes"
    | "getPaneById"
    | "openPaneSearch"
    | "closePaneSearch"
    | "togglePaneSearch"
    | "isPaneSearchOpen"
    | "getSearchUiStyleOptions"
    | "setSearchUiStyleOptions"
  >,
  visitor: (pane: ResttyPaneHandle) => void,
): void {
  const all = lookup.getPanes();
  for (let i = 0; i < all.length; i += 1) {
    visitor(makePaneHandle(lookup, all[i].id));
  }
}

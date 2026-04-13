import type {
  ResttyManagedPaneManager,
  ResttyManagedPane,
  ResttyManagedPaneStyleOptions,
  ResttyManagedPaneSearchUiStyleOptions,
} from "../panes/managed-pane-types";
import type { ResttyPaneManager, ResttyPaneSplitDirection } from "../panes-types";
import { ResttyPaneHandle } from "../restty-pane-handle";
import type { ResttyLifecycleHookPayload, ResttyPluginEvents } from "../plugins/types";
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

type ResttyLifecycleEmitter = {
  runLifecycleHooks: (payload: ResttyLifecycleHookPayload) => void;
  emitPluginEvent: <E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ) => void;
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

export function createInitialPane(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
  hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">,
  options?: { focus?: boolean },
): ResttyManagedPane {
  hooks.runLifecycleHooks({ phase: "before", action: "create-initial-pane" });
  const pane = paneManager.createInitialPane(options);
  hooks.runLifecycleHooks({
    phase: "after",
    action: "create-initial-pane",
    paneId: pane.id,
    ok: true,
  });
  return pane;
}

export function splitActivePane(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
  lookup: Pick<ResttyPaneLookup, "getActivePane">,
  hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">,
  direction: ResttyPaneSplitDirection,
): ResttyManagedPane | null {
  const sourcePaneId = lookup.getActivePane()?.id ?? null;
  hooks.runLifecycleHooks({
    phase: "before",
    action: "split-active-pane",
    paneId: sourcePaneId,
    direction,
  });
  const pane = paneManager.splitActivePane(direction);
  hooks.runLifecycleHooks({
    phase: "after",
    action: "split-active-pane",
    sourcePaneId: sourcePaneId ?? undefined,
    createdPaneId: pane?.id ?? null,
    direction,
    ok: !!pane,
  });
  return pane;
}

export function splitPane(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
  hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">,
  id: number,
  direction: ResttyPaneSplitDirection,
): ResttyManagedPane | null {
  hooks.runLifecycleHooks({
    phase: "before",
    action: "split-pane",
    paneId: id,
    direction,
  });
  const pane = paneManager.splitPane(id, direction);
  hooks.runLifecycleHooks({
    phase: "after",
    action: "split-pane",
    sourcePaneId: id,
    createdPaneId: pane?.id ?? null,
    direction,
    ok: !!pane,
  });
  return pane;
}

export function closePane(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
  hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">,
  id: number,
): boolean {
  hooks.runLifecycleHooks({ phase: "before", action: "close-pane", paneId: id });
  const ok = paneManager.closePane(id);
  hooks.runLifecycleHooks({
    phase: "after",
    action: "close-pane",
    paneId: id,
    ok,
  });
  return ok;
}

export function setActivePane(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
  lookup: Pick<ResttyPaneLookup, "getActivePane">,
  hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">,
  id: number,
  options?: { focus?: boolean },
): void {
  hooks.runLifecycleHooks({
    phase: "before",
    action: "set-active-pane",
    paneId: id,
  });
  paneManager.setActivePane(id, options);
  const activePaneId = lookup.getActivePane()?.id ?? null;
  hooks.runLifecycleHooks({
    phase: "after",
    action: "set-active-pane",
    paneId: activePaneId,
    ok: activePaneId === id,
  });
}

export function markPaneFocused(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
  lookup: Pick<ResttyPaneLookup, "getFocusedPane">,
  hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">,
  id: number,
  options?: { focus?: boolean },
): void {
  hooks.runLifecycleHooks({
    phase: "before",
    action: "mark-pane-focused",
    paneId: id,
  });
  paneManager.markPaneFocused(id, options);
  const focusedPaneId = lookup.getFocusedPane()?.id ?? null;
  hooks.runLifecycleHooks({
    phase: "after",
    action: "mark-pane-focused",
    paneId: focusedPaneId,
    ok: focusedPaneId === id,
  });
}

export function connectPty(
  lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">,
  hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">,
  url = "",
): void {
  const pane = requireActivePaneHandle(lookup);
  hooks.runLifecycleHooks({
    phase: "before",
    action: "connect-pty",
    paneId: pane.id,
  });
  pane.connectPty(url);
  hooks.runLifecycleHooks({
    phase: "after",
    action: "connect-pty",
    paneId: pane.id,
    ok: true,
  });
}

export function disconnectPty(
  lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">,
  hooks: Pick<ResttyLifecycleEmitter, "runLifecycleHooks">,
): void {
  const pane = requireActivePaneHandle(lookup);
  hooks.runLifecycleHooks({
    phase: "before",
    action: "disconnect-pty",
    paneId: pane.id,
  });
  pane.disconnectPty();
  hooks.runLifecycleHooks({
    phase: "after",
    action: "disconnect-pty",
    paneId: pane.id,
    ok: true,
  });
}

export function resize(
  lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">,
  hooks: ResttyLifecycleEmitter,
  cols: number,
  rows: number,
): void {
  const pane = requireActivePaneHandle(lookup);
  hooks.runLifecycleHooks({
    phase: "before",
    action: "resize",
    paneId: pane.id,
    cols,
    rows,
  });
  pane.resize(cols, rows);
  hooks.runLifecycleHooks({
    phase: "after",
    action: "resize",
    paneId: pane.id,
    cols,
    rows,
    ok: true,
  });
  hooks.emitPluginEvent("pane:resized", { paneId: pane.id, cols, rows });
}

export function focus(
  lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">,
  hooks: ResttyLifecycleEmitter,
): void {
  const pane = requireActivePaneHandle(lookup);
  hooks.runLifecycleHooks({
    phase: "before",
    action: "focus",
    paneId: pane.id,
  });
  pane.focus();
  hooks.runLifecycleHooks({
    phase: "after",
    action: "focus",
    paneId: pane.id,
    ok: true,
  });
  hooks.emitPluginEvent("pane:focused", { paneId: pane.id });
}

export function blur(
  lookup: Pick<ResttyPaneLookup, "getActivePane" | "getPaneById">,
  hooks: ResttyLifecycleEmitter,
): void {
  const pane = requireActivePaneHandle(lookup);
  hooks.runLifecycleHooks({
    phase: "before",
    action: "blur",
    paneId: pane.id,
  });
  pane.blur();
  hooks.runLifecycleHooks({
    phase: "after",
    action: "blur",
    paneId: pane.id,
    ok: true,
  });
  hooks.emitPluginEvent("pane:blurred", { paneId: pane.id });
}

export function getPaneStyleOptions(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
): Readonly<Required<ResttyManagedPaneStyleOptions>> {
  return paneManager.getStyleOptions();
}

export function setPaneStyleOptions(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
  options: ResttyManagedPaneStyleOptions,
): void {
  paneManager.setStyleOptions(options);
}

export function getSearchUiStyleOptions(
  paneManager: Pick<ResttyManagedPaneManager, "getSearchUiStyleOptions">,
): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>> {
  return paneManager.getSearchUiStyleOptions();
}

export function setSearchUiStyleOptions(
  paneManager: Pick<ResttyManagedPaneManager, "setSearchUiStyleOptions">,
  options: ResttyManagedPaneSearchUiStyleOptions,
): void {
  paneManager.setSearchUiStyleOptions(options);
}

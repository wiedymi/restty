import type { ResttyManagedPane } from "../panes/managed-pane-types";
import type { ResttyPaneManager, ResttyPaneSplitDirection } from "../panes/types";
import type { ResttyLifecycleHookPayload } from "../plugins/context.types";
import type { ResttyPluginEvents } from "../plugins/types";
import { requireActivePaneHandle } from "./pane-handle-ops";

type ResttyPaneLookup = {
  getPaneById: (id: number) => ResttyManagedPane | null;
  getActivePane: () => ResttyManagedPane | null;
  getFocusedPane: () => ResttyManagedPane | null;
  openPaneSearch: (id: number) => void;
  closePaneSearch: (id: number) => void;
  togglePaneSearch: (id: number) => void;
  isPaneSearchOpen: (id: number) => boolean;
  getSearchUiStyleOptions: () => Readonly<object>;
  setSearchUiStyleOptions: (options: object) => void;
};

type ResttyLifecycleEmitter = {
  runLifecycleHooks: (payload: ResttyLifecycleHookPayload) => void;
  emitPluginEvent: <E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ) => void;
};

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

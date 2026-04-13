import type { ResttyWasm, SearchStatus, SearchViewportMatch } from "../../wasm";
import type { ResttySearchState } from "../core/models";
import type { ResttyAppCallbacks } from "../core/resources";
import type { ResttyRuntimeEvent } from "../core/runtime-events";

type CreateRuntimeSearchOptions = {
  callbacks?: ResttyAppCallbacks;
  cleanupFns: Array<() => void>;
  emitRuntimeEvent?: (event: Extract<ResttyRuntimeEvent, { type: "search-state" }>) => void;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  markNeedsRender: () => void;
};

type RuntimeSearch = {
  setQuery: (query: string) => void;
  clear: () => void;
  next: () => void;
  previous: () => void;
  getState: () => ResttySearchState;
  getViewportMatches: () => SearchViewportMatch[];
  markDirty: () => void;
  handleWasmReset: () => void;
};

const SEARCH_STEP_BUDGET = 64;

function sortViewportMatches(matches: SearchViewportMatch[]): SearchViewportMatch[] {
  if (matches.length < 2) return matches;
  matches.sort(
    (a, b) =>
      a.row - b.row ||
      a.startCol - b.startCol ||
      a.endCol - b.endCol ||
      Number(b.selected) - Number(a.selected),
  );
  return matches;
}

export function createRuntimeSearch(options: CreateRuntimeSearchOptions): RuntimeSearch {
  let rafId = 0;
  let pendingSync = false;
  let viewportDirty = false;
  let lastGeneration = 0;
  let viewportMatches: SearchViewportMatch[] = [];
  let state: ResttySearchState = {
    query: "",
    active: false,
    pending: false,
    complete: false,
    total: 0,
    selectedIndex: null,
  };

  const emitState = (next: ResttySearchState) => {
    if (
      state.query === next.query &&
      state.active === next.active &&
      state.pending === next.pending &&
      state.complete === next.complete &&
      state.total === next.total &&
      state.selectedIndex === next.selectedIndex
    ) {
      return;
    }
    state = next;
    options.callbacks?.onSearchState?.(next);
    options.emitRuntimeEvent?.({ type: "search-state", state: next });
  };

  const getWasmContext = (): { wasm: ResttyWasm; handle: number } | null => {
    if (!options.getWasmReady()) return null;
    const wasm = options.getWasm();
    const handle = options.getWasmHandle();
    if (!wasm || !handle) return null;
    return { wasm, handle };
  };

  const updateFromWasm = (status: SearchStatus, matches?: SearchViewportMatch[]) => {
    if (matches) {
      viewportMatches = sortViewportMatches(matches);
    }
    emitState({
      query: state.query,
      active: status.active,
      pending: status.pending,
      complete: status.complete,
      total: status.totalMatches,
      selectedIndex: status.selectedIndex,
    });
    if (status.generation !== lastGeneration || matches) {
      lastGeneration = status.generation;
      options.markNeedsRender();
    }
  };

  const syncNow = () => {
    const ctx = getWasmContext();
    if (!ctx) return false;
    const { wasm, handle } = ctx;
    if (pendingSync) {
      if (state.query) {
        wasm.setSearchQuery(handle, state.query);
      } else {
        wasm.clearSearch(handle);
      }
      pendingSync = false;
      viewportDirty = Boolean(state.query);
    }
    if (state.query && (state.pending || viewportDirty)) {
      wasm.stepSearch(handle, viewportDirty && !state.pending ? 1 : SEARCH_STEP_BUDGET);
      viewportDirty = false;
    }
    const status = wasm.getSearchStatus(handle);
    const matches = status.active ? wasm.getSearchViewportMatches(handle) : [];
    updateFromWasm(status, matches);
    return true;
  };

  const runFrame = () => {
    rafId = 0;
    const synced = syncNow();
    if (synced && state.active && (state.pending || viewportDirty || pendingSync)) {
      schedule();
    }
  };

  const schedule = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(runFrame);
  };

  const resetLocal = () => {
    viewportMatches = [];
    lastGeneration = 0;
    emitState({
      query: "",
      active: false,
      pending: false,
      complete: false,
      total: 0,
      selectedIndex: null,
    });
    options.markNeedsRender();
  };

  const clear = () => {
    pendingSync = true;
    viewportDirty = false;
    emitState({
      query: "",
      active: false,
      pending: false,
      complete: false,
      total: 0,
      selectedIndex: null,
    });
    viewportMatches = [];
    schedule();
  };

  const setQuery = (query: string) => {
    const nextQuery = query ?? "";
    pendingSync = true;
    viewportDirty = Boolean(nextQuery);
    emitState({
      query: nextQuery,
      active: nextQuery.length > 0,
      pending: nextQuery.length > 0,
      complete: false,
      total: 0,
      selectedIndex: null,
    });
    viewportMatches = [];
    schedule();
  };

  const navigate = (direction: "next" | "previous") => {
    const ctx = getWasmContext();
    if (!ctx || !state.active) return;
    if (direction === "next") {
      ctx.wasm.searchNext(ctx.handle);
    } else {
      ctx.wasm.searchPrevious(ctx.handle);
    }
    ctx.wasm.renderUpdate(ctx.handle);
    const status = ctx.wasm.getSearchStatus(ctx.handle);
    const matches = status.active ? ctx.wasm.getSearchViewportMatches(ctx.handle) : [];
    updateFromWasm(status, matches);
    if (status.pending) {
      schedule();
    }
  };

  const markDirty = () => {
    if (!state.active) return;
    viewportDirty = true;
    schedule();
  };

  const handleWasmReset = () => {
    if (!state.query) {
      resetLocal();
      return;
    }
    pendingSync = true;
    viewportDirty = true;
    emitState({
      ...state,
      active: true,
      pending: true,
      complete: false,
      total: 0,
      selectedIndex: null,
    });
    schedule();
  };

  options.cleanupFns.push(() => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  });

  return {
    setQuery,
    clear,
    next: () => navigate("next"),
    previous: () => navigate("previous"),
    getState: () => ({ ...state }),
    getViewportMatches: () => viewportMatches,
    markDirty,
    handleWasmReset,
  };
}

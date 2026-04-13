import { afterEach, beforeEach, expect, test } from "bun:test";
import { createRuntimeSearch } from "../src/runtime/create-runtime/search-runtime";
import type { ResttySearchState } from "../src/runtime/types";
import type { SearchStatus, SearchViewportMatch } from "../src/wasm";

type FrameCallback = (time: number) => void;

const originalRaf = globalThis.requestAnimationFrame;
const originalCancelRaf = globalThis.cancelAnimationFrame;

let nextFrameId = 1;
let queuedFrames = new Map<number, FrameCallback>();

function flushAnimationFrames() {
  while (queuedFrames.size > 0) {
    const entries = [...queuedFrames.entries()];
    queuedFrames = new Map();
    for (const [, callback] of entries) {
      callback(performance.now());
    }
  }
}

beforeEach(() => {
  nextFrameId = 1;
  queuedFrames = new Map();
  globalThis.requestAnimationFrame = ((callback: FrameCallback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    queuedFrames.set(id, callback);
    return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => {
    queuedFrames.delete(id);
  }) as typeof cancelAnimationFrame;
});

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancelRaf;
});

test("createRuntimeSearch syncs query state, viewport matches, and navigation", () => {
  const states: ResttySearchState[] = [];
  const runtimeEvents: ResttySearchState[] = [];
  let markNeedsRenderCount = 0;
  let setQueryArg = "";
  let stepBudget = -1;
  let nextCalls = 0;
  let previousCalls = 0;
  let renderUpdateCalls = 0;

  const status: SearchStatus = {
    active: false,
    pending: false,
    complete: false,
    generation: 0,
    totalMatches: 0,
    selectedIndex: null,
  };
  let viewportMatches: SearchViewportMatch[] = [];

  const wasm = {
    setSearchQuery: (_handle: number, query: string) => {
      setQueryArg = query;
      status.active = true;
      status.pending = true;
      status.complete = false;
      status.totalMatches = 0;
      status.selectedIndex = null;
      status.generation += 1;
    },
    clearSearch: () => {
      status.active = false;
      status.pending = false;
      status.complete = false;
      status.totalMatches = 0;
      status.selectedIndex = null;
      status.generation += 1;
      viewportMatches = [];
    },
    stepSearch: (_handle: number, budget: number) => {
      stepBudget = budget;
      status.pending = false;
      status.complete = true;
      status.totalMatches = 2;
      status.selectedIndex = 1;
      status.generation += 1;
      viewportMatches = [
        { row: 1, startCol: 2, endCol: 5, selected: false },
        { row: 3, startCol: 0, endCol: 2, selected: true },
      ];
    },
    searchNext: () => {
      nextCalls += 1;
      status.selectedIndex = 0;
      status.generation += 1;
      viewportMatches = [
        { row: 1, startCol: 2, endCol: 5, selected: true },
        { row: 3, startCol: 0, endCol: 2, selected: false },
      ];
    },
    searchPrevious: () => {
      previousCalls += 1;
      status.selectedIndex = 1;
      status.generation += 1;
      viewportMatches = [
        { row: 1, startCol: 2, endCol: 5, selected: false },
        { row: 3, startCol: 0, endCol: 2, selected: true },
      ];
    },
    renderUpdate: () => {
      renderUpdateCalls += 1;
    },
    getSearchStatus: () => ({ ...status }),
    getSearchViewportMatches: () => viewportMatches.map((match) => ({ ...match })),
  };

  const search = createRuntimeSearch({
    callbacks: {
      onSearchState: (state) => {
        states.push(state);
      },
    },
    cleanupFns: [],
    emitRuntimeEvent: (event) => {
      runtimeEvents.push(event.state);
    },
    getWasmReady: () => true,
    getWasm: () => wasm as never,
    getWasmHandle: () => 7,
    markNeedsRender: () => {
      markNeedsRenderCount += 1;
    },
  });

  search.setQuery("needle");
  expect(search.getState()).toEqual({
    query: "needle",
    active: true,
    pending: true,
    complete: false,
    total: 0,
    selectedIndex: null,
  });

  flushAnimationFrames();

  expect(setQueryArg).toBe("needle");
  expect(stepBudget).toBe(64);
  expect(search.getState()).toEqual({
    query: "needle",
    active: true,
    pending: false,
    complete: true,
    total: 2,
    selectedIndex: 1,
  });
  expect(search.getViewportMatches()).toEqual([
    { row: 1, startCol: 2, endCol: 5, selected: false },
    { row: 3, startCol: 0, endCol: 2, selected: true },
  ]);

  search.next();
  expect(nextCalls).toBe(1);
  expect(renderUpdateCalls).toBe(1);
  expect(search.getState().selectedIndex).toBe(0);
  expect(search.getViewportMatches()[0]?.selected).toBe(true);

  search.previous();
  expect(previousCalls).toBe(1);
  expect(renderUpdateCalls).toBe(2);
  expect(search.getState().selectedIndex).toBe(1);
  expect(search.getViewportMatches()[1]?.selected).toBe(true);

  search.clear();
  flushAnimationFrames();
  expect(search.getState()).toEqual({
    query: "",
    active: false,
    pending: false,
    complete: false,
    total: 0,
    selectedIndex: null,
  });
  expect(search.getViewportMatches()).toEqual([]);
  expect(markNeedsRenderCount).toBeGreaterThan(0);
  expect(states.at(-1)).toEqual(search.getState());
  expect(runtimeEvents).toEqual(states);
});

test("createRuntimeSearch replays an active query after wasm reset", () => {
  const status: SearchStatus = {
    active: false,
    pending: false,
    complete: false,
    generation: 0,
    totalMatches: 0,
    selectedIndex: null,
  };
  let setQueryCalls = 0;

  const wasm = {
    setSearchQuery: () => {
      setQueryCalls += 1;
      status.active = true;
      status.pending = false;
      status.complete = true;
      status.totalMatches = 1;
      status.selectedIndex = 0;
      status.generation += 1;
    },
    clearSearch: () => {},
    stepSearch: () => {},
    searchNext: () => {},
    searchPrevious: () => {},
    renderUpdate: () => {},
    getSearchStatus: () => ({ ...status }),
    getSearchViewportMatches: () => [{ row: 0, startCol: 0, endCol: 1, selected: true }],
  };

  const search = createRuntimeSearch({
    cleanupFns: [],
    getWasmReady: () => true,
    getWasm: () => wasm as never,
    getWasmHandle: () => 3,
    markNeedsRender: () => {},
  });

  search.setQuery("persist");
  flushAnimationFrames();
  expect(setQueryCalls).toBe(1);

  search.handleWasmReset();
  flushAnimationFrames();
  expect(setQueryCalls).toBe(2);
  expect(search.getState()).toEqual({
    query: "persist",
    active: true,
    pending: false,
    complete: true,
    total: 1,
    selectedIndex: 0,
  });
});

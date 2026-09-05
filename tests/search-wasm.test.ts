import { beforeAll, expect, test } from "bun:test";
import { loadResttyWasm } from "../src/wasm/runtime/restty-wasm";

let wasm: Awaited<ReturnType<typeof loadResttyWasm>>;

beforeAll(async () => {
  wasm = await loadResttyWasm();
});

function completeSearch(handle: number, budget = 64): void {
  for (let i = 0; i < 1024; i += 1) {
    const status = wasm.getSearchStatus(handle);
    if (status.complete) return;
    wasm.stepSearch(handle, budget);
  }
  throw new Error("search did not complete within budget");
}

test("wasm search exposes total matches and selected viewport spans", () => {
  const handle = wasm.create(12, 3, 1_000_000);
  expect(handle).toBeGreaterThan(0);

  try {
    wasm.write(handle, "alpha\r\nbeta needle\r\ngamma needle\r\ndelta\r\n");
    wasm.renderUpdate(handle);

    wasm.setSearchQuery(handle, "needle");
    completeSearch(handle);

    expect(wasm.getSearchStatus(handle)).toEqual({
      active: true,
      pending: false,
      complete: true,
      generation: expect.any(Number),
      totalMatches: 2,
      selectedIndex: null,
    });
    expect(wasm.getSearchViewportMatches(handle)).toEqual([
      {
        row: 0,
        startCol: 6,
        endCol: 12,
        selected: false,
      },
    ]);

    wasm.searchNext(handle);
    wasm.renderUpdate(handle);
    expect(wasm.getSearchStatus(handle).selectedIndex).toBe(0);
    expect(wasm.getSearchViewportMatches(handle)).toEqual([
      {
        row: 0,
        startCol: 6,
        endCol: 12,
        selected: true,
      },
    ]);

    wasm.searchPrevious(handle);
    wasm.renderUpdate(handle);
    expect(wasm.getSearchStatus(handle).selectedIndex).toBe(1);
    expect(wasm.getSearchViewportMatches(handle)).toEqual([
      {
        row: 0,
        startCol: 5,
        endCol: 11,
        selected: true,
      },
      {
        row: 1,
        startCol: 6,
        endCol: 12,
        selected: false,
      },
    ]);
  } finally {
    wasm.destroy(handle);
  }
});

test("wasm search clear resets status and viewport highlights", () => {
  const handle = wasm.create(12, 3, 1_000_000);
  expect(handle).toBeGreaterThan(0);

  try {
    wasm.write(handle, "one needle\r\ntwo\r\n");
    wasm.renderUpdate(handle);
    wasm.setSearchQuery(handle, "needle");
    completeSearch(handle);

    expect(wasm.getSearchStatus(handle).active).toBe(true);
    expect(wasm.getSearchViewportMatches(handle).length).toBeGreaterThan(0);

    wasm.clearSearch(handle);

    expect(wasm.getSearchStatus(handle)).toEqual({
      active: false,
      pending: false,
      complete: false,
      generation: 0,
      totalMatches: 0,
      selectedIndex: null,
    });
    expect(wasm.getSearchViewportMatches(handle)).toEqual([]);
  } finally {
    wasm.destroy(handle);
  }
});

test("search follows new output, resize, and alternate screen changes", () => {
  const handle = wasm.create(20, 4, 1_000_000);
  try {
    wasm.write(handle, "primary needle\r\n");
    wasm.setSearchQuery(handle, "needle");
    completeSearch(handle);
    expect(wasm.getSearchStatus(handle).totalMatches).toBe(1);
    wasm.write(handle, "new needle\r\n");
    wasm.stepSearch(handle, 64);
    completeSearch(handle);
    expect(wasm.getSearchStatus(handle).totalMatches).toBe(2);
    wasm.resize(handle, 10, 4);
    wasm.stepSearch(handle, 64);
    completeSearch(handle);
    expect(wasm.getSearchStatus(handle).totalMatches).toBe(2);
    wasm.write(handle, "\x1b[?1049hother needle");
    wasm.stepSearch(handle, 64);
    completeSearch(handle);
    expect(wasm.getSearchStatus(handle).totalMatches).toBe(1);
    wasm.write(handle, "\x1b[?1049l");
    wasm.stepSearch(handle, 64);
    completeSearch(handle);
    expect(wasm.getSearchStatus(handle).totalMatches).toBe(2);
  } finally {
    wasm.destroy(handle);
  }
});

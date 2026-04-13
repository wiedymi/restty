import { describe, expect, test } from "bun:test";
import type { ResttySearchState } from "../src/runtime/types";
import { ResttyPaneHandle } from "../src/surface/restty-pane-handle";
import { ResttyActivePaneApi } from "../src/surface/restty/active-pane-api";

class TestActivePaneApi extends ResttyActivePaneApi {
  constructor(private readonly handle: ResttyPaneHandle) {
    super();
  }

  protected requireActivePaneHandle(): ResttyPaneHandle {
    return this.handle;
  }
}

describe("ResttyPaneHandle", () => {
  test("delegates font tuning methods to the underlying pane app", async () => {
    const calls: Array<[string, unknown]> = [];
    const fontSources = [{ type: "url" as const, url: "https://example.com/font.woff2" }];
    const pane = {
      id: 1,
      app: {
        setLigatures: (value: boolean) => void calls.push(["setLigatures", value]),
        setFontHinting: (value: boolean) => void calls.push(["setFontHinting", value]),
        setFontHintTarget: (value: string) => void calls.push(["setFontHintTarget", value]),
        setFontSources: async (sources: unknown[]) => void calls.push(["setFontSources", sources]),
      },
    } as any;

    const handle = new ResttyPaneHandle(() => pane, {
      open: () => undefined,
      close: () => undefined,
      toggle: () => undefined,
      isOpen: () => false,
      getStyleOptions: () => ({}),
      setStyleOptions: () => undefined,
    });

    handle.setLigatures(true);
    handle.setFontHinting(false);
    handle.setFontHintTarget("light");
    await handle.setFontSources(fontSources);

    expect(calls).toEqual([
      ["setLigatures", true],
      ["setFontHinting", false],
      ["setFontHintTarget", "light"],
      ["setFontSources", fontSources],
    ]);
  });
});

describe("ResttyActivePaneApi", () => {
  test("delegates the pane-scoped terminal convenience methods", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const fontSources = [{ type: "buffer" as const, data: new Uint8Array([1, 2, 3]) }];
    const shaderStages = [{ id: "fx/test", shader: { wgsl: "fn resttyStage() {}" } }];
    const searchState: ResttySearchState = {
      query: "foo",
      active: true,
      pending: false,
      complete: true,
      total: 2,
      selectedIndex: 1,
    };
    const handle = {
      setLigatures: (value: boolean) => void calls.push(["setLigatures", [value]]),
      setFontHinting: (value: boolean) => void calls.push(["setFontHinting", [value]]),
      setFontHintTarget: (value: string) => void calls.push(["setFontHintTarget", [value]]),
      setFontSources: async (sources: unknown[]) => void calls.push(["setFontSources", [sources]]),
      connectPty: (url = "") => void calls.push(["connectPty", [url]]),
      disconnectPty: () => void calls.push(["disconnectPty", []]),
      selectWordAtClientPoint: (x: number, y: number) => {
        calls.push(["selectWordAtClientPoint", [x, y]]);
        return true;
      },
      setSearchQuery: (query: string) => void calls.push(["setSearchQuery", [query]]),
      clearSearch: () => void calls.push(["clearSearch", []]),
      searchNext: () => void calls.push(["searchNext", []]),
      searchPrevious: () => void calls.push(["searchPrevious", []]),
      getSearchState: () => searchState,
      setShaderStages: (stages: unknown[]) => void calls.push(["setShaderStages", [stages]]),
      getShaderStages: () => shaderStages,
    } as unknown as ResttyPaneHandle;

    const api = new TestActivePaneApi(handle);

    api.setLigatures(true);
    api.setFontHinting(false);
    api.setFontHintTarget("normal");
    await api.setFontSources(fontSources);
    api.connectPty("ws://localhost:8787/pty");
    api.disconnectPty();
    expect(api.selectWordAtClientPoint(10, 12)).toBe(true);
    api.setSearchQuery("foo");
    api.clearSearch();
    api.searchNext();
    api.searchPrevious();
    expect(api.getSearchState()).toEqual(searchState);
    api.setShaderStages(shaderStages);
    expect(api.getShaderStages()).toEqual(shaderStages);

    expect(calls).toEqual([
      ["setLigatures", [true]],
      ["setFontHinting", [false]],
      ["setFontHintTarget", ["normal"]],
      ["setFontSources", [fontSources]],
      ["connectPty", ["ws://localhost:8787/pty"]],
      ["disconnectPty", []],
      ["selectWordAtClientPoint", [10, 12]],
      ["setSearchQuery", ["foo"]],
      ["clearSearch", []],
      ["searchNext", []],
      ["searchPrevious", []],
      ["setShaderStages", [shaderStages]],
    ]);
  });
});

import { describe, expect, test } from "bun:test";
import type { ResttySearchState } from "../src/runtime/types";
import { ResttyPaneHandle } from "../src/surface/restty/pane-handle";
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
  test("delegates font tuning methods through the pane contract", async () => {
    const calls: Array<[string, unknown]> = [];
    const fonts = [{ url: "https://example.com/font.woff2" }];
    const pane = {
      id: 1,
      setLigatures: (value: boolean) => void calls.push(["setLigatures", value]),
      setFontHinting: (value: boolean) => void calls.push(["setFontHinting", value]),
      setFontHintTarget: (value: string) => void calls.push(["setFontHintTarget", value]),
      setFonts: async (value: unknown[]) => void calls.push(["setFonts", value]),
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
    await handle.setFonts(fonts);

    expect(calls).toEqual([
      ["setLigatures", true],
      ["setFontHinting", false],
      ["setFontHintTarget", "light"],
      ["setFonts", fonts],
    ]);
  });

  test("delegates pane action and search methods through the pane contract", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const searchState: ResttySearchState = {
      query: "foo",
      active: true,
      pending: false,
      complete: true,
      total: 2,
      selectedIndex: 1,
    };
    const pane = {
      id: 2,
      togglePause: () => void calls.push(["togglePause", []]),
      clearScreen: () => void calls.push(["clearScreen", []]),
      connectPty: (url = "") => void calls.push(["connectPty", [url]]),
      disconnectPty: () => void calls.push(["disconnectPty", []]),
      isPtyConnected: () => {
        calls.push(["isPtyConnected", []]);
        return true;
      },
      copySelectionToClipboard: async () => {
        calls.push(["copySelectionToClipboard", []]);
        return true;
      },
      pasteFromClipboard: async () => {
        calls.push(["pasteFromClipboard", []]);
        return false;
      },
      setSearchQuery: (query: string) => void calls.push(["setSearchQuery", [query]]),
      clearSearch: () => void calls.push(["clearSearch", []]),
      searchNext: () => void calls.push(["searchNext", []]),
      searchPrevious: () => void calls.push(["searchPrevious", []]),
      getSearchState: () => {
        calls.push(["getSearchState", []]);
        return searchState;
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

    handle.togglePause();
    handle.clearScreen();
    handle.connectPty("ws://localhost:8787/pty");
    handle.disconnectPty();
    expect(handle.isPtyConnected()).toBe(true);
    expect(await handle.copySelectionToClipboard()).toBe(true);
    expect(await handle.pasteFromClipboard()).toBe(false);
    handle.setSearchQuery("foo");
    handle.clearSearch();
    handle.searchNext();
    handle.searchPrevious();
    expect(handle.getSearchState()).toEqual(searchState);

    expect(calls).toEqual([
      ["togglePause", []],
      ["clearScreen", []],
      ["connectPty", ["ws://localhost:8787/pty"]],
      ["disconnectPty", []],
      ["isPtyConnected", []],
      ["copySelectionToClipboard", []],
      ["pasteFromClipboard", []],
      ["setSearchQuery", ["foo"]],
      ["clearSearch", []],
      ["searchNext", []],
      ["searchPrevious", []],
      ["getSearchState", []],
    ]);
  });

  test("delegates terminal, io, interaction, and render methods through the pane contract", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const shaderStages = [{ id: "fx/test", shader: { wgsl: "fn resttyStage() {}" } }];
    const pane = {
      id: 3,
      setRenderer: (value: string) => void calls.push(["setRenderer", [value]]),
      setPaused: (value: boolean) => void calls.push(["setPaused", [value]]),
      setFontSize: (value: number) => void calls.push(["setFontSize", [value]]),
      applyTheme: (theme: unknown, sourceLabel?: string) =>
        void calls.push(["applyTheme", [theme, sourceLabel]]),
      resetTheme: () => void calls.push(["resetTheme", []]),
      sendInput: (text: string, source?: string) => void calls.push(["sendInput", [text, source]]),
      sendKeyInput: (text: string, source?: string) =>
        void calls.push(["sendKeyInput", [text, source]]),
      setMouseMode: (value: string) => void calls.push(["setMouseMode", [value]]),
      getMouseStatus: () => {
        calls.push(["getMouseStatus", []]);
        return { mode: "drag" };
      },
      selectWordAtClientPoint: (x: number, y: number) => {
        calls.push(["selectWordAtClientPoint", [x, y]]);
        return true;
      },
      resize: (cols: number, rows: number) => void calls.push(["resize", [cols, rows]]),
      focus: () => void calls.push(["focus", []]),
      blur: () => void calls.push(["blur", []]),
      updateSize: (force?: boolean) => void calls.push(["updateSize", [force]]),
      getBackend: () => {
        calls.push(["getBackend", []]);
        return "webgpu";
      },
      setShaderStages: (stages: unknown[]) => void calls.push(["setShaderStages", [stages]]),
      getShaderStages: () => {
        calls.push(["getShaderStages", []]);
        return shaderStages;
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

    const theme = { background: "#000" };
    handle.setRenderer("webgpu");
    handle.setPaused(true);
    handle.setFontSize(18);
    handle.applyTheme(theme as never, "builtin");
    handle.resetTheme();
    handle.sendInput("ls\n", "test");
    handle.sendKeyInput("\u0003", "test");
    handle.setMouseMode("drag" as never);
    expect(handle.getMouseStatus()).toEqual({ mode: "drag" });
    expect(handle.selectWordAtClientPoint(10, 12)).toBe(true);
    handle.resize(80, 24);
    handle.focus();
    handle.blur();
    handle.updateSize(true);
    expect(handle.getBackend()).toBe("webgpu");
    handle.setShaderStages(shaderStages as never);
    expect(handle.getShaderStages()).toEqual(shaderStages);

    expect(calls).toEqual([
      ["setRenderer", ["webgpu"]],
      ["setPaused", [true]],
      ["setFontSize", [18]],
      ["applyTheme", [theme, "builtin"]],
      ["resetTheme", []],
      ["sendInput", ["ls\n", "test"]],
      ["sendKeyInput", ["\u0003", "test"]],
      ["setMouseMode", ["drag"]],
      ["getMouseStatus", []],
      ["selectWordAtClientPoint", [10, 12]],
      ["resize", [80, 24]],
      ["focus", []],
      ["blur", []],
      ["updateSize", [true]],
      ["getBackend", []],
      ["setShaderStages", [shaderStages]],
      ["getShaderStages", []],
    ]);
  });
});

describe("ResttyActivePaneApi", () => {
  test("delegates the pane-scoped terminal convenience methods", async () => {
    const calls: Array<[string, unknown[]]> = [];
    const fonts = [{ data: new Uint8Array([1, 2, 3]) }];
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
      setFonts: async (value: unknown[]) => void calls.push(["setFonts", [value]]),
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
    await api.setFonts(fonts);
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
      ["setFonts", [fonts]],
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

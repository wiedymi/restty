import { expect, test } from "bun:test";
import { createRuntimeEventHub } from "../src/runtime/core/runtime-events";
import {
  createRuntimeApi,
  type RuntimeApiSharedState,
} from "../src/runtime/create-runtime/runtime-api";

test("runtime api exposes search controls on the public Restty runtime", () => {
  const sharedState: RuntimeApiSharedState = {
    wasm: null,
    wasmExports: null,
    wasmHandle: 1,
    wasmReady: true,
    activeState: null,
    needsRender: false,
    lastRenderTime: 0,
    currentContextType: null,
    isFocused: false,
    lastKeydownSeq: "",
    lastKeydownSeqAt: 0,
  };

  const calls: string[] = [];
  const runtime = createRuntimeApi({
    runtimeEvents: createRuntimeEventHub(),
    session: {} as never,
    ptyTransport: {
      isConnected: () => false,
      connect: () => undefined,
      disconnect: () => undefined,
      sendInput: () => undefined,
      resize: () => undefined,
    } as never,
    inputHandler: {
      encodeKeyEvent: () => "",
      isSynchronizedOutput: () => false,
      setMouseMode: () => undefined,
      getMouseStatus: () => "auto",
    } as never,
    ptyInputRuntime: {
      setPtyStatus: () => undefined,
      updateMouseStatus: () => undefined,
      scheduleSyncOutputReset: () => undefined,
      cancelSyncOutputReset: () => undefined,
      connectPty: () => undefined,
      disconnectPty: () => undefined,
      sendKeyInput: () => undefined,
      sendPasteText: () => undefined,
      sendPastePayloadFromDataTransfer: () => false,
      getCprPosition: () => ({ row: 1, col: 1 }),
    } as never,
    interaction: {
      selectionState: { active: false, dragging: false },
      linkState: { hoverId: 0, hoverUri: "" },
      imeState: { composing: false, preedit: "", selectionStart: 0, selectionEnd: 0 },
      clearSelection: () => undefined,
      updateLinkHover: () => undefined,
    } as never,
    lifecycleThemeSizeRuntime: {
      cancelScheduledSizeUpdate: () => undefined,
      getActiveTheme: () => null,
    },
    cleanupFns: [],
    cleanupCanvasFns: [],
    imeInput: null,
    attachWindowEvents: false,
    isMacPlatform: false,
    readState: () => sharedState,
    writeState: (patch) => Object.assign(sharedState, patch),
    runBeforeInputHook: (text) => text,
    runBeforeRenderOutputHook: (text) => text,
    getSelectionText: () => "",
    initialPreferredRenderer: "auto",
    CURSOR_BLINK_MS: 600,
    RESIZE_ACTIVE_MS: 180,
    TARGET_RENDER_FPS: 60,
    BACKGROUND_RENDER_FPS: 15,
    KITTY_FLAG_REPORT_EVENTS: 1 << 1,
    resizeState: { lastAt: 0 },
    tickWebGPU: () => undefined,
    tickWebGL: () => undefined,
    updateGrid: () => undefined,
    gridState: { cols: 80, rows: 24 },
    getCanvas: () => ({ width: 800, height: 480 }) as HTMLCanvasElement,
    applyTheme: () => undefined,
    ensureFont: async () => undefined,
    updateSize: () => undefined,
    replaceCanvas: () => undefined,
    rebuildWebGPUShaderStages: () => undefined,
    rebuildWebGLShaderStages: () => undefined,
    setShaderStagesDirty: () => undefined,
    clearWebGPUShaderStages: () => undefined,
    destroyWebGPUStageTargets: () => undefined,
    clearWebGLShaderStages: () => undefined,
    destroyWebGLStageTargets: () => undefined,
    markSearchDirty: () => undefined,
    handleSearchWasmReset: () => undefined,
  });

  const expectedState = {
    query: "foo",
    active: true,
    pending: true,
    complete: false,
    total: 2,
    selectedIndex: 1,
  } as const;

  const publicRuntime = runtime.createPublicApi({
    setFontSize: () => undefined,
    setFontHinting: () => undefined,
    setFontHintTarget: () => undefined,
    setFontSources: async () => undefined,
    resetTheme: () => undefined,
    setSearchQuery: (query: string) => {
      calls.push(`set:${query}`);
    },
    clearSearch: () => {
      calls.push("clear");
    },
    searchNext: () => {
      calls.push("next");
    },
    searchPrevious: () => {
      calls.push("prev");
    },
    getSearchState: () => expectedState,
    resize: () => undefined,
    focus: () => undefined,
    blur: () => undefined,
    updateSize: () => undefined,
    setShaderStages: () => undefined,
    getShaderStages: () => [],
  });

  publicRuntime.search.setQuery("foo");
  publicRuntime.search.next();
  publicRuntime.search.previous();
  publicRuntime.search.clear();

  expect(calls).toEqual(["set:foo", "next", "prev", "clear"]);
  expect(publicRuntime.search.getState()).toEqual(expectedState);
});

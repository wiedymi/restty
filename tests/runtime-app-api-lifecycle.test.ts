import { afterEach, beforeEach, expect, mock, test } from "bun:test";

mock.module("../src/renderer", () => ({
  initWebGPU: async () => null,
  initWebGL: () => null,
}));

const { createRuntimeAppApi } = await import("../src/runtime/create-runtime/runtime-app-api");

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

beforeEach(() => {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: () => 1,
  });
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
});

afterEach(() => {
  if (originalRequestAnimationFrame) {
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    });
  } else {
    delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
  }

  if (originalCancelAnimationFrame) {
    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalCancelAnimationFrame,
    });
  } else {
    delete (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
  }
});

function createTestRuntimeApp(options: { ensureFont?: () => Promise<void> } = {}) {
  const sharedState = {
    wasm: null,
    wasmExports: null,
    wasmHandle: 0,
    wasmReady: false,
    activeState: null,
    needsRender: false,
    lastRenderTime: 0,
    currentContextType: null,
    isFocused: false,
    lastKeydownSeq: "",
    lastKeydownSeqAt: 0,
  };

  const wasm = {
    exports: {},
    create: () => 1,
    destroy: () => undefined,
    setPixelSize: () => undefined,
    renderUpdate: () => undefined,
    write: () => undefined,
    drainOutput: () => "",
  };

  const runtime = createRuntimeAppApi({
    session: {
      getWasm: async () => wasm as never,
      getWebGPUCore: async () => null,
    } as never,
    ptyTransport: {
      isConnected: () => false,
      connect: () => undefined,
      disconnect: () => undefined,
      sendInput: () => false,
      resize: () => false,
      destroy: () => undefined,
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
      selectWordAtClientPoint: () => false,
    } as never,
    lifecycleThemeSizeRuntime: {
      cancelScheduledSizeUpdate: () => undefined,
      getActiveTheme: () => null,
    },
    cleanupFns: [],
    cleanupCanvasFns: [],
    callbacks: undefined,
    fpsEl: null,
    backendEl: null,
    inputDebugEl: null,
    imeInput: null,
    attachWindowEvents: false,
    isMacPlatform: false,
    textEncoder: new TextEncoder(),
    readState: () => sharedState,
    writeState: (patch: Record<string, unknown>) => Object.assign(sharedState, patch),
    appendLog: () => undefined,
    shouldSuppressWasmLog: () => false,
    runBeforeInputHook: (text: string) => text,
    runBeforeRenderOutputHook: (text: string) => text,
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
    ensureFont: options.ensureFont ?? (async () => undefined),
    updateSize: () => undefined,
    log: () => undefined,
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

  return {
    sharedState,
    app: runtime.createPublicApi({
      setFontSize: () => undefined,
      setLigatures: () => undefined,
      setFontHinting: () => undefined,
      setFontHintTarget: () => undefined,
      setFontSources: async () => undefined,
      resetTheme: () => undefined,
      setSearchQuery: () => undefined,
      clearSearch: () => undefined,
      searchNext: () => undefined,
      searchPrevious: () => undefined,
      getSearchState: () => ({
        query: "",
        active: false,
        pending: false,
        complete: true,
        total: 0,
        selectedIndex: null,
      }),
      resize: () => undefined,
      focus: () => undefined,
      blur: () => undefined,
      updateSize: () => undefined,
      setShaderStages: () => undefined,
      getShaderStages: () => [],
    }),
  };
}

test("runtime app api lifecycle state flows from created to ready to destroyed", async () => {
  const { app, sharedState } = createTestRuntimeApp();

  expect(app.getLifecycleState()).toBe("created");

  const initPromise = app.init();
  expect(app.getLifecycleState()).toBe("initializing");

  await initPromise;
  expect(app.getLifecycleState()).toBe("ready");

  app.destroy();
  expect(app.getLifecycleState()).toBe("destroyed");
  expect(sharedState.wasmHandle).toBe(0);
});

test("runtime app api lifecycle state stays destroyed when init finishes late", async () => {
  let resolveFont!: () => void;
  const { app, sharedState } = createTestRuntimeApp({
    ensureFont: () =>
      new Promise<void>((resolve) => {
        resolveFont = resolve;
      }),
  });

  const initPromise = app.init();
  expect(app.getLifecycleState()).toBe("initializing");

  app.destroy();
  expect(app.getLifecycleState()).toBe("destroyed");

  resolveFont();
  await initPromise;

  expect(app.getLifecycleState()).toBe("destroyed");
  expect(sharedState.wasmHandle).toBe(0);
});

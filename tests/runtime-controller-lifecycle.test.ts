import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { createRuntimeEventHub } from "../src/runtime/core/runtime-events";

mock.module("../src/renderer", () => ({
  initWebGPU: async () => null,
  initWebGL: () => null,
}));

const { createRuntimeController } =
  await import("../src/runtime/create-runtime/runtime-controller");

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

function createTestRuntime(options: { ensureFont?: () => Promise<void> } = {}) {
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

  const runtimeController = createRuntimeController({
    runtimeEvents: createRuntimeEventHub(),
    runtime: {
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
    },
    state: {
      readState: () => sharedState,
      writeState: (patch: Record<string, unknown>) => Object.assign(sharedState, patch),
      resizeState: { lastAt: 0 },
      gridState: { cols: 80, rows: 24 },
      getCanvas: () => ({ width: 800, height: 480 }) as HTMLCanvasElement,
    },
    platform: {
      imeInput: null,
      attachWindowEvents: false,
      isMacPlatform: false,
      KITTY_FLAG_REPORT_EVENTS: 1 << 1,
    },
    hooks: {
      runBeforeInputHook: (text: string) => text,
      runBeforeRenderOutputHook: (text: string) => text,
      getSelectionText: () => "",
      markSearchDirty: () => undefined,
      handleSearchWasmReset: () => undefined,
    },
    render: {
      initialPreferredRenderer: "auto",
      CURSOR_BLINK_MS: 600,
      RESIZE_ACTIVE_MS: 180,
      TARGET_RENDER_FPS: 60,
      BACKGROUND_RENDER_FPS: 15,
      tickWebGPU: () => undefined,
      tickWebGL: () => undefined,
    },
    lifecycle: {
      cleanupFns: [],
      cleanupCanvasFns: [],
      updateGrid: () => undefined,
      applyTheme: () => undefined,
      ensureFont: options.ensureFont ?? (async () => undefined),
      updateSize: () => undefined,
      replaceCanvas: () => undefined,
      rebuildWebGPUShaderStages: () => undefined,
      rebuildWebGLShaderStages: () => undefined,
      setShaderStagesDirty: () => undefined,
      clearWebGPUShaderStages: () => undefined,
      destroyWebGPUStageTargets: () => undefined,
      clearWebGLShaderStages: () => undefined,
      destroyWebGLStageTargets: () => undefined,
    },
  });

  return {
    sharedState,
    publicRuntime: runtimeController.createPublicApi({
      terminal: {
        setFontSize: () => undefined,
        setLigatures: () => undefined,
        setFontHinting: () => undefined,
        setFontHintTarget: () => undefined,
        setFonts: async () => undefined,
        resetTheme: () => undefined,
      },
      search: {
        setQuery: () => undefined,
        clear: () => undefined,
        next: () => undefined,
        previous: () => undefined,
        getState: () => ({
          query: "",
          active: false,
          pending: false,
          complete: true,
          total: 0,
          selectedIndex: null,
        }),
      },
      interaction: {
        resize: () => undefined,
        focus: () => undefined,
        blur: () => undefined,
        updateSize: () => undefined,
      },
      render: {
        setShaderStages: () => undefined,
        getShaderStages: () => [],
      },
    }),
  };
}

test("runtime controller lifecycle state flows from created to ready to destroyed", async () => {
  const { publicRuntime, sharedState } = createTestRuntime();
  const states: string[] = [];
  const backends: string[] = [];

  const dispose = publicRuntime.events.subscribe((event) => {
    if (event.type === "state") states.push(event.state);
    if (event.type === "backend") backends.push(event.backend);
  });

  expect(publicRuntime.lifecycle.state()).toBe("created");

  const initPromise = publicRuntime.lifecycle.init();
  expect(publicRuntime.lifecycle.state()).toBe("initializing");

  await initPromise;
  expect(publicRuntime.lifecycle.state()).toBe("ready");

  publicRuntime.lifecycle.destroy();
  expect(publicRuntime.lifecycle.state()).toBe("destroyed");
  expect(sharedState.wasmHandle).toBe(0);
  expect(states).toEqual(["created", "initializing", "ready", "destroyed"]);
  expect(backends).toEqual(["none"]);
  dispose();
});

test("runtime controller lifecycle state stays destroyed when init finishes late", async () => {
  let resolveFont!: () => void;
  const { publicRuntime, sharedState } = createTestRuntime({
    ensureFont: () =>
      new Promise<void>((resolve) => {
        resolveFont = resolve;
      }),
  });
  const states: string[] = [];

  const dispose = publicRuntime.events.subscribe((event) => {
    if (event.type === "state") states.push(event.state);
  });

  const initPromise = publicRuntime.lifecycle.init();
  expect(publicRuntime.lifecycle.state()).toBe("initializing");

  publicRuntime.lifecycle.destroy();
  expect(publicRuntime.lifecycle.state()).toBe("destroyed");

  resolveFont();
  await initPromise;

  expect(publicRuntime.lifecycle.state()).toBe("destroyed");
  expect(sharedState.wasmHandle).toBe(0);
  expect(states).toEqual(["created", "initializing", "destroyed"]);
  dispose();
});

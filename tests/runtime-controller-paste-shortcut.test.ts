import { expect, test } from "bun:test";
import { createRuntimeEventHub } from "../src/runtime/core/runtime-events";
import {
  createRuntimeController,
  type RuntimeControllerSharedState,
} from "../src/runtime/create-runtime/runtime-controller";

type Listener = (event: KeyboardEvent) => void;

class FakeWindow {
  private readonly listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== "function") return;
    const next = this.listeners.get(type) ?? [];
    next.push(listener as Listener);
    this.listeners.set(type, next);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== "function") return;
    const current = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      current.filter((entry) => entry !== listener),
    );
  }

  dispatch(type: string, event: KeyboardEvent): void {
    const current = this.listeners.get(type) ?? [];
    for (const listener of current) listener(event);
  }
}

type Harness = {
  fakeWindow: FakeWindow;
  canvas: object;
  setActiveElement: (value: unknown) => void;
  readClipboardCalls: () => number;
  keyWrites: () => string[];
  pasteWrites: () => string[];
  restoreGlobals: () => void;
};

function createHarness(
  imeInput: HTMLTextAreaElement | null,
  options: { encodedPasteKeySeq?: string } = {},
): Harness {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  const fakeWindow = new FakeWindow();
  const canvas = {};
  const fakeDocument = {
    activeElement: canvas,
    visibilityState: "visible",
  };
  let clipboardReadCount = 0;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: fakeDocument,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: {
      platform: "MacIntel",
      clipboard: {
        async readText(): Promise<string> {
          clipboardReadCount += 1;
          return "paste payload";
        },
      },
    },
  });

  const sharedState: RuntimeControllerSharedState = {
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

  const writes: string[] = [];
  const keyWrites: string[] = [];

  createRuntimeController({
    runtimeEvents: createRuntimeEventHub(),
    runtime: {
      session: {} as never,
      ptyTransport: {
        isConnected: () => false,
        connect: () => undefined,
        disconnect: () => undefined,
        sendInput: () => undefined,
        resize: () => undefined,
      } as never,
      inputHandler: {
        encodeKeyEvent: () => options.encodedPasteKeySeq ?? "",
        isSynchronizedOutput: () => false,
      } as never,
      ptyInputRuntime: {
        setPtyStatus: () => undefined,
        updateMouseStatus: () => undefined,
        scheduleSyncOutputReset: () => undefined,
        cancelSyncOutputReset: () => undefined,
        connectPty: () => undefined,
        disconnectPty: () => undefined,
        sendKeyInput: (text: string) => {
          keyWrites.push(text);
        },
        sendPasteText: (text: string) => {
          writes.push(text);
        },
        sendPastePayloadFromDataTransfer: () => false,
        getCprPosition: () => ({ row: 1, col: 1 }),
      },
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
    },
    state: {
      readState: () => sharedState,
      writeState: (patch) => Object.assign(sharedState, patch),
      resizeState: { lastAt: 0 },
      gridState: { cols: 80, rows: 24 },
      getCanvas: () => canvas as HTMLCanvasElement,
    },
    platform: {
      imeInput,
      attachWindowEvents: true,
      isMacPlatform: true,
      KITTY_FLAG_REPORT_EVENTS: 1 << 1,
    },
    hooks: {
      runBeforeInputHook: (text) => text,
      runBeforeRenderOutputHook: (text) => text,
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
    },
  });

  const restoreGlobals = () => {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      delete (globalThis as { document?: unknown }).document;
    }
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  };

  return {
    fakeWindow,
    canvas,
    setActiveElement: (value) => {
      fakeDocument.activeElement = value;
    },
    readClipboardCalls: () => clipboardReadCount,
    keyWrites: () => keyWrites,
    pasteWrites: () => writes,
    restoreGlobals,
  };
}

function createKeyEvent(
  target: object,
  overrides: Partial<KeyboardEvent> = {},
): KeyboardEvent & { prevented: boolean } {
  return {
    key: "v",
    code: "KeyV",
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    type: "keydown",
    target,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
    ...overrides,
  } as unknown as KeyboardEvent & { prevented: boolean };
}

test("Cmd+V with IME input uses native paste path without clipboard permission read", async () => {
  let focusCalls = 0;
  const imeInput = {
    focus: () => {
      focusCalls += 1;
    },
  } as unknown as HTMLTextAreaElement;
  const harness = createHarness(imeInput);

  try {
    harness.setActiveElement(harness.canvas);
    const event = createKeyEvent(harness.canvas);
    harness.fakeWindow.dispatch("keydown", event);
    await Promise.resolve();

    expect(event.prevented).toBe(false);
    expect(focusCalls).toBeGreaterThanOrEqual(1);
    expect(harness.readClipboardCalls()).toBe(0);
    expect(harness.pasteWrites()).toEqual([]);
  } finally {
    harness.restoreGlobals();
  }
});

test("Cmd+V without IME input forwards paste shortcut as key without clipboard.readText fallback", async () => {
  const harness = createHarness(null, { encodedPasteKeySeq: "\x16" });

  try {
    harness.setActiveElement(harness.canvas);
    const event = createKeyEvent(harness.canvas);
    harness.fakeWindow.dispatch("keydown", event);
    await Promise.resolve();

    expect(event.prevented).toBe(true);
    expect(harness.readClipboardCalls()).toBe(0);
    expect(harness.keyWrites()).toEqual(["\x16"]);
    expect(harness.pasteWrites()).toEqual([]);
  } finally {
    harness.restoreGlobals();
  }
});

test("macOS Ctrl+V with IME input is forwarded as key input for TUI bindings", async () => {
  const imeInput = {
    focus: () => undefined,
  } as unknown as HTMLTextAreaElement;
  const harness = createHarness(imeInput, { encodedPasteKeySeq: "\x16" });

  try {
    harness.setActiveElement(harness.canvas);
    const event = createKeyEvent(harness.canvas, { metaKey: false, ctrlKey: true });
    harness.fakeWindow.dispatch("keydown", event);
    await Promise.resolve();

    expect(event.prevented).toBe(true);
    expect(harness.readClipboardCalls()).toBe(0);
    expect(harness.keyWrites()).toEqual(["\x16"]);
    expect(harness.pasteWrites()).toEqual([]);
  } finally {
    harness.restoreGlobals();
  }
});

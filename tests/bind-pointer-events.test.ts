import { expect, test } from "bun:test";
import type { InputHandler } from "../src/input";
import { bindPointerEvents } from "../src/runtime/create-runtime/interaction-runtime/bind-pointer-events";

type Listener = EventListenerOrEventListenerObject;

class FakeCanvas {
  style: Record<string, string> = {};
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener | null): void {
    if (!listener) return;
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set<Listener>();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener | null): void {
    if (!listener) return;
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Event): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      if (typeof listener === "function") {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    }
  }

  setPointerCapture(): void {}

  releasePointerCapture(): void {}
}

function createInputHandlerStub(options: {
  sendMouseEvent: (kind: "down" | "up" | "move" | "wheel") => boolean;
  mouseActive?: boolean;
  altScreen?: boolean;
}): InputHandler {
  return {
    sequences: {
      enter: "\r",
      backspace: "\x7f",
      delete: "\x1b[3~",
      tab: "\t",
      shiftTab: "\x1b[Z",
      escape: "\x1b",
    },
    encodeKeyEvent: () => "",
    encodeBeforeInput: () => "",
    mapKeyForPty: (seq: string) => seq,
    filterOutput: (output: string) => output,
    setReplySink: () => {},
    setCursorProvider: () => {},
    setPositionToCell: () => {},
    setPositionToPixel: () => {},
    setWindowOpHandler: () => {},
    setMouseMode: () => {},
    getMouseStatus: () => ({
      mode: "auto",
      active: options.mouseActive ?? true,
      detail: "sgr",
      enabled: true,
    }),
    isMouseActive: () => options.mouseActive ?? true,
    isBracketedPaste: () => false,
    isFocusReporting: () => false,
    isAltScreen: () => options.altScreen ?? true,
    isSynchronizedOutput: () => false,
    isPromptClickEventsEnabled: () => false,
    encodePromptClickEvent: () => "",
    sendMouseEvent: (kind) => options.sendMouseEvent(kind),
  };
}

function createPointerEvent(
  overrides: Partial<PointerEvent> = {},
): { event: PointerEvent; prevented: () => boolean } {
  let prevented = false;
  const event = {
    button: 0,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    pointerType: "mouse",
    pointerId: 1,
    clientX: 12,
    clientY: 8,
    preventDefault: () => {
      prevented = true;
    },
    ...overrides,
  } as PointerEvent;
  return { event, prevented: () => prevented };
}

function createMouseEvent(
  overrides: Partial<MouseEvent> = {},
): { event: MouseEvent; prevented: () => boolean } {
  let prevented = false;
  const event = {
    shiftKey: false,
    preventDefault: () => {
      prevented = true;
    },
    ...overrides,
  } as MouseEvent;
  return { event, prevented: () => prevented };
}

function createWheelEvent(
  overrides: Partial<WheelEvent> = {},
): { event: WheelEvent; prevented: () => boolean } {
  let prevented = false;
  const event = {
    shiftKey: false,
    deltaY: 40,
    deltaMode: 0,
    preventDefault: () => {
      prevented = true;
    },
    ...overrides,
  } as WheelEvent;
  return { event, prevented: () => prevented };
}

test("bindPointerEvents routes primary click to app mouse when mouse reporting is active", () => {
  const mouseKinds: string[] = [];
  const canvas = new FakeCanvas();
  const desktopSelectionState = {
    pendingPointerId: null,
    pendingCell: null,
    startedWithActiveSelection: false,
    lastPrimaryClickAt: 0,
    lastPrimaryClickCell: null,
    lastPrimaryClickCount: 0,
  };

  bindPointerEvents({
    canvas: canvas as unknown as HTMLCanvasElement,
    bindOptions: {
      inputHandler: createInputHandlerStub({
        sendMouseEvent: (kind) => {
          mouseKinds.push(kind);
          return true;
        },
      }),
      sendKeyInput: () => {},
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    selectionState: { active: false, dragging: false, anchor: null, focus: null },
    touchSelectionState: {
      pendingPointerId: null,
      activePointerId: null,
      panPointerId: null,
      pendingCell: null,
      pendingStartedAt: 0,
      pendingStartX: 0,
      pendingStartY: 0,
      panLastY: 0,
      pendingTimer: 0,
    },
    desktopSelectionState,
    linkState: { hoverId: 0, hoverUri: "" },
    cleanupCanvasFns: [],
    isTouchPointer: (event) => event.pointerType === "touch",
    clearPendingTouchSelection: () => {},
    clearPendingDesktopSelection: () => {
      desktopSelectionState.pendingPointerId = null;
      desktopSelectionState.pendingCell = null;
      desktopSelectionState.startedWithActiveSelection = false;
    },
    tryActivatePendingTouchSelection: () => false,
    beginSelectionDrag: () => {},
    normalizeSelectionCell: (cell) => cell,
    positionToCell: () => ({ row: 0, col: 0 }),
    scrollViewportByLines: () => {},
    clearSelection: () => {},
    updateCanvasCursor: () => {},
    markNeedsRender: () => {},
    updateLinkHover: () => {},
    getGridState: () => ({ cols: 80, rows: 24, cellW: 10, cellH: 20 }),
    getWasmReady: () => true,
    getWasmHandle: () => 1,
  });

  const down = createPointerEvent();
  canvas.emit("pointerdown", down.event as unknown as Event);
  expect(mouseKinds).toEqual(["down"]);
  expect(down.prevented()).toBe(true);
  expect(desktopSelectionState.pendingPointerId).toBeNull();

  const up = createPointerEvent();
  canvas.emit("pointerup", up.event as unknown as Event);
  expect(mouseKinds).toEqual(["down", "up"]);
  expect(up.prevented()).toBe(true);
});

test("bindPointerEvents keeps Shift+click as local selection bypass", () => {
  const mouseKinds: string[] = [];
  const canvas = new FakeCanvas();
  const desktopSelectionState = {
    pendingPointerId: null as number | null,
    pendingCell: null as { row: number; col: number } | null,
    startedWithActiveSelection: false,
    lastPrimaryClickAt: 0,
    lastPrimaryClickCell: null as { row: number; col: number } | null,
  };

  bindPointerEvents({
    canvas: canvas as unknown as HTMLCanvasElement,
    bindOptions: {
      inputHandler: createInputHandlerStub({
        sendMouseEvent: (kind) => {
          mouseKinds.push(kind);
          return true;
        },
      }),
      sendKeyInput: () => {},
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    selectionState: { active: false, dragging: false, anchor: null, focus: null },
    touchSelectionState: {
      pendingPointerId: null,
      activePointerId: null,
      panPointerId: null,
      pendingCell: null,
      pendingStartedAt: 0,
      pendingStartX: 0,
      pendingStartY: 0,
      panLastY: 0,
      pendingTimer: 0,
    },
    desktopSelectionState,
    linkState: { hoverId: 0, hoverUri: "" },
    cleanupCanvasFns: [],
    isTouchPointer: (event) => event.pointerType === "touch",
    clearPendingTouchSelection: () => {},
    clearPendingDesktopSelection: () => {
      desktopSelectionState.pendingPointerId = null;
      desktopSelectionState.pendingCell = null;
      desktopSelectionState.startedWithActiveSelection = false;
    },
    tryActivatePendingTouchSelection: () => false,
    beginSelectionDrag: () => {},
    normalizeSelectionCell: (cell) => cell,
    positionToCell: () => ({ row: 1, col: 1 }),
    scrollViewportByLines: () => {},
    clearSelection: () => {},
    updateCanvasCursor: () => {},
    markNeedsRender: () => {},
    updateLinkHover: () => {},
    getGridState: () => ({ cols: 80, rows: 24, cellW: 10, cellH: 20 }),
    getWasmReady: () => true,
    getWasmHandle: () => 1,
  });

  const down = createPointerEvent({ shiftKey: true, pointerId: 7 });
  canvas.emit("pointerdown", down.event as unknown as Event);
  expect(mouseKinds).toEqual([]);
  expect(down.prevented()).toBe(true);
  expect(desktopSelectionState.pendingPointerId).toBe(7);
});

test("bindPointerEvents routes mouse when reporting is active even outside alt-screen", () => {
  const mouseKinds: string[] = [];
  const canvas = new FakeCanvas();

  bindPointerEvents({
    canvas: canvas as unknown as HTMLCanvasElement,
    bindOptions: {
      inputHandler: createInputHandlerStub({
        altScreen: false,
        sendMouseEvent: (kind) => {
          mouseKinds.push(kind);
          return true;
        },
      }),
      sendKeyInput: () => {},
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    selectionState: { active: false, dragging: false, anchor: null, focus: null },
    touchSelectionState: {
      pendingPointerId: null,
      activePointerId: null,
      panPointerId: null,
      pendingCell: null,
      pendingStartedAt: 0,
      pendingStartX: 0,
      pendingStartY: 0,
      panLastY: 0,
      pendingTimer: 0,
    },
    desktopSelectionState: {
      pendingPointerId: null,
      pendingCell: null,
      startedWithActiveSelection: false,
      lastPrimaryClickAt: 0,
      lastPrimaryClickCell: null,
    },
    linkState: { hoverId: 0, hoverUri: "" },
    cleanupCanvasFns: [],
    isTouchPointer: (event) => event.pointerType === "touch",
    clearPendingTouchSelection: () => {},
    clearPendingDesktopSelection: () => {},
    tryActivatePendingTouchSelection: () => false,
    beginSelectionDrag: () => {},
    normalizeSelectionCell: (cell) => cell,
    positionToCell: () => ({ row: 0, col: 0 }),
    scrollViewportByLines: () => {},
    clearSelection: () => {},
    updateCanvasCursor: () => {},
    markNeedsRender: () => {},
    updateLinkHover: () => {},
    getGridState: () => ({ cols: 80, rows: 24, cellW: 10, cellH: 20 }),
    getWasmReady: () => true,
    getWasmHandle: () => 1,
  });

  const down = createPointerEvent();
  canvas.emit("pointerdown", down.event as unknown as Event);
  expect(mouseKinds).toEqual(["down"]);
  expect(down.prevented()).toBe(true);
});

test("bindPointerEvents keeps Shift+contextmenu as local bypass", () => {
  const canvas = new FakeCanvas();

  bindPointerEvents({
    canvas: canvas as unknown as HTMLCanvasElement,
    bindOptions: {
      inputHandler: createInputHandlerStub({
        sendMouseEvent: () => true,
      }),
      sendKeyInput: () => {},
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    selectionState: { active: false, dragging: false, anchor: null, focus: null },
    touchSelectionState: {
      pendingPointerId: null,
      activePointerId: null,
      panPointerId: null,
      pendingCell: null,
      pendingStartedAt: 0,
      pendingStartX: 0,
      pendingStartY: 0,
      panLastY: 0,
      pendingTimer: 0,
    },
    desktopSelectionState: {
      pendingPointerId: null,
      pendingCell: null,
      startedWithActiveSelection: false,
      lastPrimaryClickAt: 0,
      lastPrimaryClickCell: null,
    },
    linkState: { hoverId: 0, hoverUri: "" },
    cleanupCanvasFns: [],
    isTouchPointer: (event) => event.pointerType === "touch",
    clearPendingTouchSelection: () => {},
    clearPendingDesktopSelection: () => {},
    tryActivatePendingTouchSelection: () => false,
    beginSelectionDrag: () => {},
    normalizeSelectionCell: (cell) => cell,
    positionToCell: () => ({ row: 0, col: 0 }),
    scrollViewportByLines: () => {},
    clearSelection: () => {},
    updateCanvasCursor: () => {},
    markNeedsRender: () => {},
    updateLinkHover: () => {},
    getGridState: () => ({ cols: 80, rows: 24, cellW: 10, cellH: 20 }),
    getWasmReady: () => true,
    getWasmHandle: () => 1,
  });

  const normalContextMenu = createMouseEvent();
  canvas.emit("contextmenu", normalContextMenu.event as unknown as Event);
  expect(normalContextMenu.prevented()).toBe(true);

  const shiftContextMenu = createMouseEvent({ shiftKey: true });
  canvas.emit("contextmenu", shiftContextMenu.event as unknown as Event);
  expect(shiftContextMenu.prevented()).toBe(false);
});

test("bindPointerEvents routes wheel through native-host scroll handler", () => {
  const canvas = new FakeCanvas();
  let wheelCalls = 0;

  bindPointerEvents({
    canvas: canvas as unknown as HTMLCanvasElement,
    bindOptions: {
      inputHandler: createInputHandlerStub({
        mouseActive: false,
        sendMouseEvent: () => false,
      }),
      sendKeyInput: () => {},
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    selectionState: { active: false, dragging: false, anchor: null, focus: null },
    touchSelectionState: {
      pendingPointerId: null,
      activePointerId: null,
      panPointerId: null,
      pendingCell: null,
      pendingStartedAt: 0,
      pendingStartX: 0,
      pendingStartY: 0,
      panLastY: 0,
      pendingTimer: 0,
    },
    desktopSelectionState: {
      pendingPointerId: null,
      pendingCell: null,
      startedWithActiveSelection: false,
      lastPrimaryClickAt: 0,
      lastPrimaryClickCell: null,
    },
    linkState: { hoverId: 0, hoverUri: "" },
    cleanupCanvasFns: [],
    isTouchPointer: (event) => event.pointerType === "touch",
    clearPendingTouchSelection: () => {},
    clearPendingDesktopSelection: () => {},
    tryActivatePendingTouchSelection: () => false,
    beginSelectionDrag: () => {},
    normalizeSelectionCell: (cell) => cell,
    positionToCell: () => ({ row: 0, col: 0 }),
    scrollViewportByLines: () => {
      throw new Error("line scroll path should not run");
    },
    scrollViewportByWheel: () => {
      wheelCalls += 1;
    },
    clearSelection: () => {},
    updateCanvasCursor: () => {},
    markNeedsRender: () => {},
    updateLinkHover: () => {},
    getGridState: () => ({ cols: 80, rows: 24, cellW: 10, cellH: 20 }),
    getWasmReady: () => true,
    getWasmHandle: () => 1,
  });

  const wheel = createWheelEvent();
  canvas.emit("wheel", wheel.event as unknown as Event);
  expect(wheelCalls).toBe(1);
  expect(wheel.prevented()).toBe(true);
});

test("bindPointerEvents uses two nearby primary clicks to trigger word selection", () => {
  const canvas = new FakeCanvas();
  const selectedCells: Array<{ row: number; col: number }> = [];
  const desktopSelectionState = {
    pendingPointerId: null as number | null,
    pendingCell: null as { row: number; col: number } | null,
    startedWithActiveSelection: false,
  };

  bindPointerEvents({
    canvas: canvas as unknown as HTMLCanvasElement,
    bindOptions: {
      inputHandler: createInputHandlerStub({
        mouseActive: false,
        sendMouseEvent: () => false,
      }),
      sendKeyInput: () => {},
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    selectionState: { active: false, dragging: false, anchor: null, focus: null },
    touchSelectionState: {
      pendingPointerId: null,
      activePointerId: null,
      panPointerId: null,
      pendingCell: null,
      pendingStartedAt: 0,
      pendingStartX: 0,
      pendingStartY: 0,
      panLastY: 0,
      pendingTimer: 0,
    },
    desktopSelectionState,
    linkState: { hoverId: 0, hoverUri: "" },
    cleanupCanvasFns: [],
    isTouchPointer: (event) => event.pointerType === "touch",
    clearPendingTouchSelection: () => {},
    clearPendingDesktopSelection: () => {
      desktopSelectionState.pendingPointerId = null;
      desktopSelectionState.pendingCell = null;
      desktopSelectionState.startedWithActiveSelection = false;
    },
    tryActivatePendingTouchSelection: () => false,
    beginSelectionDrag: () => {},
    selectWordAtCell: (cell) => {
      selectedCells.push(cell);
      return true;
    },
    normalizeSelectionCell: (cell) => cell,
    positionToCell: () => ({ row: 2, col: 9 }),
    scrollViewportByLines: () => {},
    clearSelection: () => {},
    updateCanvasCursor: () => {},
    markNeedsRender: () => {},
    updateLinkHover: () => {},
    getGridState: () => ({ cols: 80, rows: 24, cellW: 10, cellH: 20 }),
    getWasmReady: () => true,
    getWasmHandle: () => 1,
  });

  const firstUp = createPointerEvent({ button: 0, pointerId: 4 });
  canvas.emit("pointerup", firstUp.event as unknown as Event);

  const secondUp = createPointerEvent({ button: 0, pointerId: 4 });
  canvas.emit("pointerup", secondUp.event as unknown as Event);

  expect(secondUp.prevented()).toBe(true);
  expect(selectedCells).toEqual([{ row: 2, col: 9 }]);
  expect(desktopSelectionState.pendingPointerId).toBeNull();
  expect(desktopSelectionState.pendingCell).toBeNull();
});

test("bindPointerEvents triggers line selection on triple-click", () => {
  const canvas = new FakeCanvas();
  const wordCells: Array<{ row: number; col: number }> = [];
  const lineCells: Array<{ row: number; col: number }> = [];
  const selectionState = { active: false, dragging: false, anchor: null, focus: null };
  const desktopSelectionState = {
    pendingPointerId: null as number | null,
    pendingCell: null as { row: number; col: number } | null,
    startedWithActiveSelection: false,
    lastPrimaryClickAt: 0,
    lastPrimaryClickCell: null as { row: number; col: number } | null,
    lastPrimaryClickCount: 0,
  };

  bindPointerEvents({
    canvas: canvas as unknown as HTMLCanvasElement,
    bindOptions: {
      inputHandler: createInputHandlerStub({
        mouseActive: false,
        sendMouseEvent: () => false,
      }),
      sendKeyInput: () => {},
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: () => {},
    },
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    selectionState,
    touchSelectionState: {
      pendingPointerId: null,
      activePointerId: null,
      panPointerId: null,
      pendingCell: null,
      pendingStartedAt: 0,
      pendingStartX: 0,
      pendingStartY: 0,
      panLastY: 0,
      pendingTimer: 0,
    },
    desktopSelectionState,
    linkState: { hoverId: 0, hoverUri: "" },
    cleanupCanvasFns: [],
    isTouchPointer: (event) => event.pointerType === "touch",
    clearPendingTouchSelection: () => {},
    clearPendingDesktopSelection: () => {
      desktopSelectionState.pendingPointerId = null;
      desktopSelectionState.pendingCell = null;
      desktopSelectionState.startedWithActiveSelection = false;
    },
    tryActivatePendingTouchSelection: () => false,
    beginSelectionDrag: () => {},
    selectWordAtCell: (cell) => {
      wordCells.push(cell);
      selectionState.active = true;
      return true;
    },
    selectLineAtCell: (cell) => {
      lineCells.push(cell);
      selectionState.active = true;
      return true;
    },
    normalizeSelectionCell: (cell) => cell,
    positionToCell: () => ({ row: 1, col: 5 }),
    scrollViewportByLines: () => {},
    clearSelection: () => {
      selectionState.active = false;
    },
    updateCanvasCursor: () => {},
    markNeedsRender: () => {},
    updateLinkHover: () => {},
    getGridState: () => ({ cols: 80, rows: 24, cellW: 10, cellH: 20 }),
    getWasmReady: () => true,
    getWasmHandle: () => 1,
  });

  // First click: single click (tracked)
  canvas.emit("pointerup", createPointerEvent({ button: 0 }).event as unknown as Event);
  expect(wordCells).toEqual([]);
  expect(lineCells).toEqual([]);

  // Second click: double-click → word selection
  const second = createPointerEvent({ button: 0 });
  canvas.emit("pointerup", second.event as unknown as Event);
  expect(second.prevented()).toBe(true);
  expect(wordCells).toEqual([{ row: 1, col: 5 }]);

  // Third click: triple-click → line selection
  const third = createPointerEvent({ button: 0 });
  canvas.emit("pointerup", third.event as unknown as Event);
  expect(third.prevented()).toBe(true);
  expect(lineCells).toEqual([{ row: 1, col: 5 }]);
});

test("bindPointerEvents opens hovered links on Cmd/Ctrl+click only", () => {
  const canvas = new FakeCanvas();
  const openedUrls: string[] = [];

  bindPointerEvents({
    canvas: canvas as unknown as HTMLCanvasElement,
    bindOptions: {
      inputHandler: createInputHandlerStub({
        mouseActive: false,
        sendMouseEvent: () => false,
      }),
      sendKeyInput: () => {},
      sendPasteText: () => {},
      sendPastePayloadFromDataTransfer: () => false,
      getLastKeydownSeq: () => "",
      getLastKeydownSeqAt: () => 0,
      keydownBeforeinputDedupeMs: 80,
      openLink: (url) => {
        openedUrls.push(url);
      },
    },
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    selectionState: { active: false, dragging: false, anchor: null, focus: null },
    touchSelectionState: {
      pendingPointerId: null,
      activePointerId: null,
      panPointerId: null,
      pendingCell: null,
      pendingStartedAt: 0,
      pendingStartX: 0,
      pendingStartY: 0,
      panLastY: 0,
      pendingTimer: 0,
    },
    desktopSelectionState: {
      pendingPointerId: null,
      pendingCell: null,
      startedWithActiveSelection: false,
      lastPrimaryClickAt: 0,
      lastPrimaryClickCell: null,
    },
    linkState: { hoverId: 1, hoverUri: "https://example.com" },
    cleanupCanvasFns: [],
    isTouchPointer: (event) => event.pointerType === "touch",
    clearPendingTouchSelection: () => {},
    clearPendingDesktopSelection: () => {},
    tryActivatePendingTouchSelection: () => false,
    beginSelectionDrag: () => {},
    normalizeSelectionCell: (cell) => cell,
    positionToCell: () => ({ row: 0, col: 0 }),
    scrollViewportByLines: () => {},
    clearSelection: () => {},
    updateCanvasCursor: () => {},
    markNeedsRender: () => {},
    updateLinkHover: () => {},
    getGridState: () => ({ cols: 80, rows: 24, cellW: 10, cellH: 20 }),
    getWasmReady: () => true,
    getWasmHandle: () => 1,
  });

  const plainUp = createPointerEvent({ button: 0 });
  canvas.emit("pointerup", plainUp.event as unknown as Event);
  expect(openedUrls).toEqual([]);

  const cmdUp = createPointerEvent({ button: 0, metaKey: true });
  canvas.emit("pointerup", cmdUp.event as unknown as Event);
  expect(openedUrls).toEqual(["https://example.com"]);
});

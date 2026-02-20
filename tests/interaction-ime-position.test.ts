import { expect, test } from "bun:test";
import { createRuntimeInteraction } from "../src/runtime/create-runtime/interaction-runtime";

class FakeCanvas {
  style: Record<string, string> = {};
  parentElement: HTMLElement | null = null;
  width: number;
  height: number;
  private readonly rect: DOMRect;

  constructor(options?: {
    width?: number;
    height?: number;
    rect?: { left: number; top: number; width: number; height: number };
  }) {
    this.width = options?.width ?? 660;
    this.height = options?.height ?? 360;
    this.rect = {
      left: options?.rect?.left ?? 100,
      top: options?.rect?.top ?? 200,
      width: options?.rect?.width ?? 330,
      height: options?.rect?.height ?? 180,
    } as DOMRect;
  }

  getBoundingClientRect(): DOMRect {
    return this.rect;
  }

  setPointerCapture(): void {}
}

test("updateImePosition anchors IME input using rendered cell metrics", () => {
  const canvas = new FakeCanvas();
  const imeInput = { style: {} } as HTMLTextAreaElement;

  const interaction = createRuntimeInteraction({
    attachCanvasEvents: false,
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    showOverlayScrollbar: false,
    imeInput,
    cleanupCanvasFns: [],
    getCanvas: () => canvas as unknown as HTMLCanvasElement,
    getCurrentDpr: () => 2,
    getGridState: () => ({ cols: 3, rows: 3, cellW: 200, cellH: 200 }),
    getLastRenderState: () => null,
    getWasmReady: () => false,
    getWasm: () => null,
    getWasmHandle: () => 0,
    getWasmExports: () => null,
    updateLinkHover: () => {},
    markNeedsRender: () => {},
  });

  interaction.updateImePosition({ row: 1, col: 2 }, 200, 200);

  expect(imeInput.style.transform).toBe("none");
  expect(imeInput.style.left).toBe("300px");
  expect(imeInput.style.top).toBe("300px");
});

test("positionToCell uses canvas-to-css scale when DPR differs from rendered scale", () => {
  const canvas = new FakeCanvas();

  const interaction = createRuntimeInteraction({
    attachCanvasEvents: false,
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    showOverlayScrollbar: false,
    imeInput: null,
    cleanupCanvasFns: [],
    getCanvas: () => canvas as unknown as HTMLCanvasElement,
    getCurrentDpr: () => 1,
    getGridState: () => ({ cols: 3, rows: 3, cellW: 200, cellH: 200 }),
    getLastRenderState: () => null,
    getWasmReady: () => false,
    getWasm: () => null,
    getWasmHandle: () => 0,
    getWasmExports: () => null,
    updateLinkHover: () => {},
    markNeedsRender: () => {},
  });

  const cell = interaction.positionToCell({ clientX: 210, clientY: 320 });
  expect(cell).toEqual({ row: 1, col: 1 });
});

test("positionToPixel uses canvas-to-css scale when DPR differs from rendered scale", () => {
  const canvas = new FakeCanvas();

  const interaction = createRuntimeInteraction({
    attachCanvasEvents: false,
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    showOverlayScrollbar: false,
    imeInput: null,
    cleanupCanvasFns: [],
    getCanvas: () => canvas as unknown as HTMLCanvasElement,
    getCurrentDpr: () => 1,
    getGridState: () => ({ cols: 3, rows: 3, cellW: 200, cellH: 200 }),
    getLastRenderState: () => null,
    getWasmReady: () => false,
    getWasm: () => null,
    getWasmHandle: () => 0,
    getWasmExports: () => null,
    updateLinkHover: () => {},
    markNeedsRender: () => {},
  });

  const pixel = interaction.positionToPixel({ clientX: 210, clientY: 320 });
  expect(pixel).toEqual({ x: 221, y: 241 });
});

test("positionToCell respects backing-store width when grid width is floored by cell size", () => {
  const canvas = new FakeCanvas({
    width: 1000,
    height: 600,
    rect: { left: 0, top: 0, width: 500, height: 300 },
  });

  const interaction = createRuntimeInteraction({
    attachCanvasEvents: false,
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    showOverlayScrollbar: false,
    imeInput: null,
    cleanupCanvasFns: [],
    getCanvas: () => canvas as unknown as HTMLCanvasElement,
    getCurrentDpr: () => 2,
    getGridState: () => ({ cols: 142, rows: 60, cellW: 7, cellH: 10 }),
    getLastRenderState: () => null,
    getWasmReady: () => false,
    getWasm: () => null,
    getWasmHandle: () => 0,
    getWasmExports: () => null,
    updateLinkHover: () => {},
    markNeedsRender: () => {},
  });

  const cell = interaction.positionToCell({ clientX: 350, clientY: 1 });
  expect(cell).toEqual({ row: 0, col: 100 });
});

test("updateCanvasCursor uses pointer while hovering link without active selection", () => {
  const canvas = new FakeCanvas();

  const interaction = createRuntimeInteraction({
    attachCanvasEvents: false,
    touchSelectionMode: "off",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
    showOverlayScrollbar: false,
    imeInput: null,
    cleanupCanvasFns: [],
    getCanvas: () => canvas as unknown as HTMLCanvasElement,
    getCurrentDpr: () => 2,
    getGridState: () => ({ cols: 3, rows: 3, cellW: 200, cellH: 200 }),
    getLastRenderState: () => null,
    getWasmReady: () => false,
    getWasm: () => null,
    getWasmHandle: () => 0,
    getWasmExports: () => null,
    updateLinkHover: () => {},
    markNeedsRender: () => {},
  });

  interaction.updateCanvasCursor();
  expect(canvas.style.cursor).toBe("text");

  interaction.linkState.hoverId = 1;
  interaction.updateCanvasCursor();
  expect(canvas.style.cursor).toBe("pointer");

  interaction.selectionState.active = true;
  interaction.updateCanvasCursor();
  expect(canvas.style.cursor).toBe("text");
});

import {
  createSelectionState,
  normalizeSelectionCell as normalizeGridSelectionCell,
  positionToCell as mapClientPositionToCell,
} from "../../../selection";
import { resolveDesktopWordSelectionRange } from "./desktop-word-selection";
import { bindImeEvents } from "./bind-ime-events";
import { bindPointerEvents } from "./bind-pointer-events";
import { createScrollbarRuntime } from "./scrollbar-runtime";
import type {
  BindCanvasEventsOptions,
  CreateRuntimeInteractionOptions,
  RuntimeInteraction,
} from "./runtime.types";
import type {
  RuntimeCell,
  RuntimeDesktopSelectionState,
  RuntimeImeState,
  RuntimeLinkState,
  RuntimeScrollbarState,
  RuntimeTouchSelectionState,
} from "./state.types";

export type {
  BindCanvasEventsOptions,
  CreateRuntimeInteractionOptions,
  RuntimeInteraction,
} from "./runtime.types";
export type { RuntimeCell } from "./state.types";

export function createRuntimeInteraction(
  options: CreateRuntimeInteractionOptions,
): RuntimeInteraction {
  const {
    attachCanvasEvents,
    touchSelectionMode,
    touchSelectionLongPressMs,
    touchSelectionMoveThresholdPx,
    imeInput,
    cleanupCanvasFns,
    getCanvas,
    getCurrentDpr,
    getGridState,
    getLastRenderState,
    getWasmReady,
    getWasm,
    getWasmHandle,
    getWasmExports,
    updateLinkHover,
    markNeedsRender,
    markSearchDirty,
  } = options;

  const selectionState = createSelectionState();

  const touchSelectionState: RuntimeTouchSelectionState = {
    pendingPointerId: null,
    activePointerId: null,
    panPointerId: null,
    pendingCell: null,
    pendingStartedAt: 0,
    pendingStartX: 0,
    pendingStartY: 0,
    panLastY: 0,
    pendingTimer: 0,
  };

  const desktopSelectionState: RuntimeDesktopSelectionState = {
    pendingPointerId: null,
    pendingCell: null,
    startedWithActiveSelection: false,
    lastPrimaryClickAt: 0,
    lastPrimaryClickCell: null,
    lastPrimaryClickCount: 0,
  };

  const linkState: RuntimeLinkState = {
    hoverId: 0,
    hoverUri: "",
  };

  const scrollbarState: RuntimeScrollbarState = {
    lastInputAt: 0,
    lastTotal: 0,
    lastOffset: 0,
    lastLen: 0,
  };

  const imeState: RuntimeImeState = {
    composing: false,
    preedit: "",
    selectionStart: 0,
    selectionEnd: 0,
  };

  const updateCanvasCursor = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const showPointer =
      linkState.hoverId !== 0 && !selectionState.active && !selectionState.dragging;
    canvas.style.cursor = showPointer ? "pointer" : "text";
  };

  const isTouchPointer = (event: PointerEvent) => {
    return event.pointerType === "touch";
  };

  const clearPendingTouchSelection = () => {
    if (touchSelectionState.pendingTimer) {
      clearTimeout(touchSelectionState.pendingTimer);
      touchSelectionState.pendingTimer = 0;
    }
    touchSelectionState.pendingPointerId = null;
    touchSelectionState.pendingCell = null;
    touchSelectionState.pendingStartedAt = 0;
  };

  const clearPendingDesktopSelection = () => {
    desktopSelectionState.pendingPointerId = null;
    desktopSelectionState.pendingCell = null;
    desktopSelectionState.startedWithActiveSelection = false;
  };

  const beginSelectionDrag = (cell: RuntimeCell, pointerId: number) => {
    clearPendingDesktopSelection();
    selectionState.active = true;
    selectionState.dragging = true;
    selectionState.anchor = cell;
    selectionState.focus = cell;
    touchSelectionState.activePointerId = pointerId;
    touchSelectionState.panPointerId = null;
    getCanvas().setPointerCapture?.(pointerId);
    updateCanvasCursor();
    markNeedsRender();
  };

  const tryActivatePendingTouchSelection = (pointerId: number) => {
    if (touchSelectionMode !== "long-press") return false;
    if (touchSelectionState.pendingPointerId !== pointerId || !touchSelectionState.pendingCell) {
      return false;
    }
    if (performance.now() - touchSelectionState.pendingStartedAt < touchSelectionLongPressMs) {
      return false;
    }
    const pendingCell = touchSelectionState.pendingCell;
    clearPendingTouchSelection();
    beginSelectionDrag(pendingCell, pointerId);
    return true;
  };

  const scrollbarRuntime = createScrollbarRuntime({
    scrollbarState,
    selectionState,
    linkState,
    getCanvas,
    getGridState,
    getWasmReady,
    getWasm,
    getWasmHandle,
    getWasmExports,
    updateLinkHover: () => updateLinkHover(null),
    markNeedsRender,
    markSearchDirty,
  });
  cleanupCanvasFns.push(() => {
    scrollbarRuntime.destroy();
  });

  const positionToCell = (event: { clientX: number; clientY: number }) => {
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const { cellW, cellH, cols, rows } = getGridState();
    return mapClientPositionToCell(
      event.clientX,
      event.clientY,
      rect,
      getCurrentDpr(),
      cellW || 1,
      cellH || 1,
      cols || 1,
      rows || 1,
      canvas.width,
      canvas.height,
    );
  };

  const positionToPixel = (event: { clientX: number; clientY: number }) => {
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const fallbackScale = getCurrentDpr() || 1;
    const scaleX = rect.width > 0 ? canvas.width / rect.width : fallbackScale;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : fallbackScale;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return {
      x: Math.max(1, Math.round(x + 1)),
      y: Math.max(1, Math.round(y + 1)),
    };
  };

  const normalizeSelectionCell = (cell: RuntimeCell) => {
    const renderState = getLastRenderState();
    const { rows, cols } = getGridState();
    return normalizeGridSelectionCell(
      cell,
      renderState?.rows ?? rows ?? 0,
      renderState?.cols ?? cols ?? 0,
      renderState?.wide,
    );
  };

  const getCurrentRenderState = () => {
    const renderState = getLastRenderState();
    if (renderState) return renderState;
    if (!getWasmReady()) return null;
    const wasm = getWasm();
    const wasmHandle = getWasmHandle();
    if (!wasm || !wasmHandle) return null;
    return wasm.getRenderState(wasmHandle);
  };

  const clearSelection = () => {
    clearPendingDesktopSelection();
    selectionState.active = false;
    selectionState.dragging = false;
    selectionState.anchor = null;
    selectionState.focus = null;
    touchSelectionState.activePointerId = null;
    updateCanvasCursor();
    markNeedsRender();
  };

  const selectWordAtCell = (cell: RuntimeCell): boolean => {
    const range = resolveDesktopWordSelectionRange(getCurrentRenderState(), cell);
    if (!range || range.end <= range.start) return false;

    clearPendingDesktopSelection();
    selectionState.active = true;
    selectionState.dragging = false;
    selectionState.anchor = { row: cell.row, col: range.start };
    selectionState.focus = { row: cell.row, col: range.end - 1 };
    updateLinkHover(null);
    updateCanvasCursor();
    markNeedsRender();
    return true;
  };

  const selectLineAtCell = (cell: RuntimeCell): boolean => {
    const renderState = getCurrentRenderState();
    if (!renderState) return false;
    if (cell.row < 0 || cell.row >= renderState.rows || renderState.cols <= 0) return false;

    clearPendingDesktopSelection();
    selectionState.active = true;
    selectionState.dragging = false;
    selectionState.anchor = { row: cell.row, col: 0 };
    selectionState.focus = { row: cell.row, col: renderState.cols - 1 };
    updateLinkHover(null);
    updateCanvasCursor();
    markNeedsRender();
    return true;
  };

  const selectWordAtClientPoint = (clientX: number, clientY: number): boolean => {
    const cell = normalizeSelectionCell(positionToCell({ clientX, clientY }));
    return selectWordAtCell(cell);
  };

  const setPreedit = (text: string, updateInput = false) => {
    imeState.preedit = text || "";
    if (imeInput && updateInput) {
      imeInput.value = imeState.preedit;
    }
    markNeedsRender();
  };

  const updateImePosition = (
    cursor: { row: number; col: number } | null | undefined,
    cellW: number,
    cellH: number,
  ) => {
    if (!imeInput || !cursor) return;
    const canvas = getCanvas();
    const rect = canvas.getBoundingClientRect();
    const { cols, rows } = getGridState();
    const fallbackScale = getCurrentDpr() || 1;
    const scaleX = rect.width > 0 ? canvas.width / rect.width : fallbackScale;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : fallbackScale;
    const cssCellW = cellW > 0 ? cellW / Math.max(1e-6, scaleX) : cols > 0 ? rect.width / cols : 1;
    const cssCellH = cellH > 0 ? cellH / Math.max(1e-6, scaleY) : rows > 0 ? rect.height / rows : 1;
    const x = rect.left + cursor.col * cssCellW;
    const y = rect.top + cursor.row * cssCellH;
    imeInput.style.transform = "none";
    imeInput.style.left = `${x}px`;
    imeInput.style.top = `${y}px`;
  };

  const syncImeSelection = () => {
    if (!imeInput) return;
    const start = imeInput.selectionStart ?? 0;
    const end = imeInput.selectionEnd ?? start;
    imeState.selectionStart = Math.max(0, Math.min(start, imeInput.value.length));
    imeState.selectionEnd = Math.max(imeState.selectionStart, Math.min(end, imeInput.value.length));
  };

  const bindCanvasEvents = (bindOptions: BindCanvasEventsOptions) => {
    if (!attachCanvasEvents) return;

    const canvas = getCanvas();
    bindPointerEvents({
      canvas,
      bindOptions,
      touchSelectionMode,
      touchSelectionLongPressMs,
      touchSelectionMoveThresholdPx,
      selectionState,
      touchSelectionState,
      desktopSelectionState,
      linkState,
      cleanupCanvasFns,
      isTouchPointer,
      clearPendingTouchSelection,
      clearPendingDesktopSelection,
      tryActivatePendingTouchSelection,
      beginSelectionDrag,
      selectWordAtCell,
      selectLineAtCell,
      scrollViewportByWheel: scrollbarRuntime.scrollViewportByWheel,
      normalizeSelectionCell,
      positionToCell,
      scrollViewportByLines: scrollbarRuntime.scrollViewportByLines,
      clearSelection,
      updateCanvasCursor,
      markNeedsRender,
      updateLinkHover,
      getGridState,
      getWasmReady,
      getWasmHandle,
    });

    if (imeInput) {
      bindImeEvents({
        bindOptions,
        imeInput,
        imeState,
        cleanupCanvasFns,
        getWasmReady,
        getWasmHandle,
        setPreedit,
        syncImeSelection,
      });
    }
  };

  return {
    selectionState,
    linkState,
    scrollbarState,
    imeState,
    updateCanvasCursor,
    updateLinkHover,
    positionToCell,
    positionToPixel,
    selectWordAtClientPoint,
    clearSelection,
    updateImePosition,
    syncScrollbar: scrollbarRuntime.syncScrollbar,
    bindCanvasEvents,
  };
}

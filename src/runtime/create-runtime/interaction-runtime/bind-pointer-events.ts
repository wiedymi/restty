import { createPointerAuxHandlers } from "./bind-pointer-aux-handlers";
import { createPointerUpHandler } from "./bind-pointer-up-handler";
import type { BindCanvasEventsOptions } from "./runtime.types";
import type {
  RuntimeCell,
  RuntimeDesktopSelectionState,
  RuntimeGridState,
  RuntimeLinkState,
  RuntimeSelectionState,
  RuntimeTouchSelectionState,
} from "./state.types";

const SELECTION_DRAG_AUTOSCROLL_EDGE_PX = 1;
const SELECTION_DRAG_AUTOSCROLL_INTERVAL_MS = 15;

export type BindPointerEventsOptions = {
  canvas: HTMLCanvasElement;
  bindOptions: BindCanvasEventsOptions;
  touchSelectionMode: "off" | "drag" | "long-press";
  touchSelectionLongPressMs: number;
  touchSelectionMoveThresholdPx: number;
  selectionState: RuntimeSelectionState;
  touchSelectionState: RuntimeTouchSelectionState;
  desktopSelectionState: RuntimeDesktopSelectionState;
  linkState: RuntimeLinkState;
  cleanupCanvasFns: Array<() => void>;
  isTouchPointer: (event: PointerEvent) => boolean;
  clearPendingTouchSelection: () => void;
  clearPendingDesktopSelection: () => void;
  tryActivatePendingTouchSelection: (pointerId: number) => boolean;
  beginSelectionDrag: (cell: RuntimeCell, pointerId: number) => void;
  selectWordAtCell?: (cell: RuntimeCell) => boolean;
  selectLineAtCell?: (cell: RuntimeCell) => boolean;
  scrollViewportByWheel?: (event: WheelEvent) => void;
  normalizeSelectionCell: (cell: RuntimeCell) => RuntimeCell;
  positionToCell: (event: { clientX: number; clientY: number }) => RuntimeCell;
  scrollViewportByLines: (lines: number) => void;
  clearSelection: () => void;
  updateCanvasCursor: () => void;
  markNeedsRender: () => void;
  updateLinkHover: (cell: RuntimeCell | null) => void;
  getGridState: () => RuntimeGridState;
  getWasmReady: () => boolean;
  getWasmHandle: () => number;
};

export function bindPointerEvents(options: BindPointerEventsOptions) {
  const {
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
    selectWordAtCell = () => false,
    selectLineAtCell = () => false,
    scrollViewportByWheel = () => {},
    normalizeSelectionCell,
    positionToCell,
    scrollViewportByLines,
    clearSelection,
    updateCanvasCursor,
    markNeedsRender,
    updateLinkHover,
    getGridState,
    getWasmReady,
    getWasmHandle,
  } = options;

  const { inputHandler, sendKeyInput, openLink } = bindOptions;
  let selectionAutoScrollTimer: ReturnType<typeof setInterval> | null = null;
  let selectionAutoScrollDirection: -1 | 0 | 1 = 0;
  let selectionAutoScrollClientX = 0;
  let selectionAutoScrollClientY = 0;

  const shouldRoutePointerToAppMouse = (shiftKey: boolean) => {
    if (shiftKey) return false;
    return inputHandler.isMouseActive();
  };

  const stopSelectionAutoScroll = () => {
    if (selectionAutoScrollTimer) {
      clearInterval(selectionAutoScrollTimer);
      selectionAutoScrollTimer = null;
    }
    selectionAutoScrollDirection = 0;
  };

  const selectionAutoScrollDirectionFor = (event: { clientY: number }): -1 | 0 | 1 => {
    if (!selectionState.dragging || !getWasmReady() || !getWasmHandle()) return 0;
    const { cellH } = getGridState();
    if (!cellH) return 0;

    const rect = canvas.getBoundingClientRect();
    if (rect.height <= 0) return 0;
    if (event.clientY <= rect.top + SELECTION_DRAG_AUTOSCROLL_EDGE_PX) return -1;
    if (event.clientY >= rect.bottom - SELECTION_DRAG_AUTOSCROLL_EDGE_PX) return 1;
    return 0;
  };

  const tickSelectionAutoScroll = () => {
    if (!selectionState.dragging || !selectionAutoScrollDirection) {
      stopSelectionAutoScroll();
      return;
    }

    scrollViewportByLines(selectionAutoScrollDirection);
    selectionState.focus = normalizeSelectionCell(
      positionToCell({
        clientX: selectionAutoScrollClientX,
        clientY: selectionAutoScrollClientY,
      }),
    );
    updateLinkHover(null);
    updateCanvasCursor();
    markNeedsRender();
  };

  const syncSelectionAutoScroll = (event: PointerEvent) => {
    selectionAutoScrollClientX = event.clientX;
    selectionAutoScrollClientY = event.clientY;
    selectionAutoScrollDirection = selectionAutoScrollDirectionFor(event);

    if (!selectionAutoScrollDirection) {
      stopSelectionAutoScroll();
      return;
    }

    tickSelectionAutoScroll();
    if (!selectionAutoScrollTimer && selectionAutoScrollDirection) {
      selectionAutoScrollTimer = setInterval(
        tickSelectionAutoScroll,
        SELECTION_DRAG_AUTOSCROLL_INTERVAL_MS,
      );
    }
  };

  canvas.style.touchAction =
    touchSelectionMode === "long-press" || touchSelectionMode === "drag"
      ? "none"
      : "pan-y pinch-zoom";

  const onPointerDown = (event: PointerEvent) => {
    if (
      shouldRoutePointerToAppMouse(event.shiftKey) &&
      inputHandler.sendMouseEvent("down", event)
    ) {
      clearPendingDesktopSelection();
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      return;
    }

    if (isTouchPointer(event)) {
      if (event.button !== 0) return;
      const cell = normalizeSelectionCell(positionToCell(event));
      touchSelectionState.activePointerId = null;
      touchSelectionState.panPointerId = null;

      if (touchSelectionMode === "off") return;
      if (touchSelectionMode === "drag") {
        event.preventDefault();
        beginSelectionDrag(cell, event.pointerId);
        return;
      }

      clearPendingTouchSelection();
      touchSelectionState.pendingPointerId = event.pointerId;
      touchSelectionState.pendingCell = cell;
      touchSelectionState.pendingStartedAt = performance.now();
      touchSelectionState.pendingStartX = event.clientX;
      touchSelectionState.pendingStartY = event.clientY;
      touchSelectionState.panPointerId = event.pointerId;
      touchSelectionState.panLastY = event.clientY;
      touchSelectionState.pendingTimer = setTimeout(() => {
        tryActivatePendingTouchSelection(event.pointerId);
      }, touchSelectionLongPressMs);
      return;
    }

    if (event.button !== 0) return;
    event.preventDefault();
    const cell = normalizeSelectionCell(positionToCell(event));
    updateLinkHover(cell);
    desktopSelectionState.pendingPointerId = event.pointerId;
    desktopSelectionState.pendingCell = cell;
    desktopSelectionState.startedWithActiveSelection = selectionState.active;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (isTouchPointer(event)) {
      if (touchSelectionState.pendingPointerId === event.pointerId) {
        const dx = event.clientX - touchSelectionState.pendingStartX;
        const dy = event.clientY - touchSelectionState.pendingStartY;
        if (dx * dx + dy * dy >= touchSelectionMoveThresholdPx * touchSelectionMoveThresholdPx) {
          clearPendingTouchSelection();
        } else {
          tryActivatePendingTouchSelection(event.pointerId);
        }
        if (touchSelectionState.pendingPointerId === event.pointerId) {
          if (
            touchSelectionMode === "long-press" &&
            touchSelectionState.panPointerId === event.pointerId
          ) {
            const deltaPx = touchSelectionState.panLastY - event.clientY;
            touchSelectionState.panLastY = event.clientY;
            scrollViewportByLines((deltaPx / Math.max(1, getGridState().cellH)) * 1.5);
            event.preventDefault();
          }
          return;
        }
      }
      if (selectionState.dragging && touchSelectionState.activePointerId === event.pointerId) {
        const cell = normalizeSelectionCell(positionToCell(event));
        event.preventDefault();
        selectionState.focus = cell;
        syncSelectionAutoScroll(event);
        updateLinkHover(null);
        updateCanvasCursor();
        markNeedsRender();
        return;
      }
      if (
        touchSelectionMode === "long-press" &&
        touchSelectionState.panPointerId === event.pointerId
      ) {
        const deltaPx = touchSelectionState.panLastY - event.clientY;
        touchSelectionState.panLastY = event.clientY;
        scrollViewportByLines((deltaPx / Math.max(1, getGridState().cellH)) * 1.5);
        event.preventDefault();
      }
      return;
    }

    const cell = normalizeSelectionCell(positionToCell(event));
    if (
      desktopSelectionState.pendingPointerId === event.pointerId &&
      desktopSelectionState.pendingCell
    ) {
      const anchor = desktopSelectionState.pendingCell;
      if (anchor.row !== cell.row || anchor.col !== cell.col) {
        beginSelectionDrag(anchor, event.pointerId);
        selectionState.focus = cell;
        syncSelectionAutoScroll(event);
        updateLinkHover(null);
        updateCanvasCursor();
        markNeedsRender();
        return;
      }
      updateLinkHover(cell);
      return;
    }

    if (selectionState.dragging) {
      event.preventDefault();
      selectionState.focus = cell;
      syncSelectionAutoScroll(event);
      updateLinkHover(null);
      updateCanvasCursor();
      markNeedsRender();
      return;
    }

    if (
      shouldRoutePointerToAppMouse(event.shiftKey) &&
      inputHandler.sendMouseEvent("move", event)
    ) {
      event.preventDefault();
      return;
    }

    updateLinkHover(cell);
  };

  const basePointerUp = createPointerUpHandler({
    inputHandler,
    sendKeyInput,
    openLink,
    isTouchPointer,
    touchSelectionState,
    selectionState,
    normalizeSelectionCell,
    positionToCell,
    clearPendingTouchSelection,
    clearPendingDesktopSelection,
    desktopSelectionState,
    clearSelection,
    selectWordAtCell,
    selectLineAtCell,
    updateCanvasCursor,
    markNeedsRender,
    shouldRoutePointerToAppMouse,
    linkState,
    updateLinkHover,
  });
  const onPointerUp = (event: PointerEvent) => {
    stopSelectionAutoScroll();
    basePointerUp(event);
  };

  const auxHandlers = createPointerAuxHandlers({
    inputHandler,
    shouldRoutePointerToAppMouse,
    scrollViewportByWheel,
    getWasmReady,
    getWasmHandle,
    getGridState,
    updateLinkHover,
    clearPendingDesktopSelection,
    clearPendingTouchSelection,
    isTouchPointer,
    selectionState,
    touchSelectionState,
    desktopSelectionState,
    updateCanvasCursor,
    markNeedsRender,
  });
  const onPointerCancel = (event: PointerEvent) => {
    stopSelectionAutoScroll();
    auxHandlers.onPointerCancel(event);
  };
  const { onWheel, onContextMenu, onPointerLeave } = auxHandlers;

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);

  cleanupCanvasFns.push(() => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("contextmenu", onContextMenu);
    stopSelectionAutoScroll();
    clearPendingTouchSelection();
  });
}

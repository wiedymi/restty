import type { InputHandler } from "../../../input";
import type {
  RuntimeCell,
  RuntimeDesktopSelectionState,
  RuntimeGridState,
  RuntimeSelectionState,
  RuntimeTouchSelectionState,
} from "./state.types";

type CreatePointerAuxHandlersOptions = {
  inputHandler: InputHandler;
  shouldRoutePointerToAppMouse: (shiftKey: boolean) => boolean;
  scrollViewportByWheel?: (event: WheelEvent) => void;
  getWasmReady: () => boolean;
  getWasmHandle: () => number;
  getGridState: () => RuntimeGridState;
  updateLinkHover: (cell: RuntimeCell | null) => void;
  clearPendingDesktopSelection: () => void;
  clearPendingTouchSelection: () => void;
  isTouchPointer: (event: PointerEvent) => boolean;
  selectionState: RuntimeSelectionState;
  touchSelectionState: RuntimeTouchSelectionState;
  desktopSelectionState: RuntimeDesktopSelectionState;
  updateCanvasCursor: () => void;
  markNeedsRender: () => void;
};

export type PointerAuxHandlers = {
  onPointerCancel: (event: PointerEvent) => void;
  onWheel: (event: WheelEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
  onPointerLeave: () => void;
};

export function createPointerAuxHandlers(
  options: CreatePointerAuxHandlersOptions,
): PointerAuxHandlers {
  const {
    inputHandler,
    shouldRoutePointerToAppMouse,
    scrollViewportByWheel = () => {},
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
  } = options;

  const onPointerCancel = (event: PointerEvent) => {
    if (desktopSelectionState.pendingPointerId === event.pointerId) {
      clearPendingDesktopSelection();
    }
    if (isTouchPointer(event)) {
      if (touchSelectionState.pendingPointerId === event.pointerId) {
        clearPendingTouchSelection();
      }
      if (touchSelectionState.panPointerId === event.pointerId) {
        touchSelectionState.panPointerId = null;
      }
      if (touchSelectionState.activePointerId === event.pointerId) {
        touchSelectionState.activePointerId = null;
        if (selectionState.dragging) {
          selectionState.dragging = false;
          updateCanvasCursor();
          markNeedsRender();
        }
      }
    }
  };

  const onWheel = (event: WheelEvent) => {
    if (shouldRoutePointerToAppMouse(event.shiftKey)) {
      if (inputHandler.sendMouseEvent("wheel", event)) {
        event.preventDefault();
        return;
      }
    }
    if (!getWasmReady() || !getWasmHandle() || !getGridState().cellH) return;
    scrollViewportByWheel(event);
    event.preventDefault();
  };

  const onContextMenu = (event: MouseEvent) => {
    if (shouldRoutePointerToAppMouse(event.shiftKey)) event.preventDefault();
  };

  const onPointerLeave = () => {
    updateLinkHover(null);
  };

  return {
    onPointerCancel,
    onWheel,
    onContextMenu,
    onPointerLeave,
  };
}

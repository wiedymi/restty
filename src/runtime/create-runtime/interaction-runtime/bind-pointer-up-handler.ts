import type { InputHandler } from "../../../input";
import type {
  RuntimeCell,
  RuntimeDesktopSelectionState,
  RuntimeLinkState,
  RuntimeSelectionState,
  RuntimeTouchSelectionState,
} from "./types";

type CreatePointerUpHandlerOptions = {
  inputHandler: InputHandler;
  sendKeyInput: (text: string) => void;
  openLink: (url: string) => void;
  isTouchPointer: (event: PointerEvent) => boolean;
  touchSelectionState: RuntimeTouchSelectionState;
  selectionState: RuntimeSelectionState;
  normalizeSelectionCell: (cell: RuntimeCell) => RuntimeCell;
  positionToCell: (event: { clientX: number; clientY: number }) => RuntimeCell;
  clearPendingTouchSelection: () => void;
  clearPendingDesktopSelection: () => void;
  desktopSelectionState: RuntimeDesktopSelectionState;
  clearSelection: () => void;
  selectWordAtCell?: (cell: RuntimeCell) => boolean;
  selectLineAtCell?: (cell: RuntimeCell) => boolean;
  updateCanvasCursor: () => void;
  markNeedsRender: () => void;
  shouldRoutePointerToAppMouse: (shiftKey: boolean) => boolean;
  linkState: RuntimeLinkState;
  updateLinkHover: (cell: RuntimeCell | null) => void;
};

export function createPointerUpHandler(options: CreatePointerUpHandlerOptions) {
  const {
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
    selectWordAtCell = () => false,
    selectLineAtCell = () => false,
    updateCanvasCursor,
    markNeedsRender,
    shouldRoutePointerToAppMouse,
    linkState,
    updateLinkHover,
  } = options;

  return (event: PointerEvent) => {
    if (isTouchPointer(event)) {
      if (touchSelectionState.pendingPointerId === event.pointerId) {
        clearPendingTouchSelection();
        touchSelectionState.activePointerId = null;
        touchSelectionState.panPointerId = null;
        return;
      }
      if (selectionState.dragging && touchSelectionState.activePointerId === event.pointerId) {
        const cell = normalizeSelectionCell(positionToCell(event));
        event.preventDefault();
        selectionState.dragging = false;
        selectionState.focus = cell;
        touchSelectionState.activePointerId = null;
        if (
          selectionState.anchor &&
          selectionState.focus &&
          selectionState.anchor.row === selectionState.focus.row &&
          selectionState.anchor.col === selectionState.focus.col
        ) {
          clearSelection();
        } else {
          updateCanvasCursor();
          markNeedsRender();
        }
        return;
      }
      if (touchSelectionState.panPointerId === event.pointerId) {
        touchSelectionState.panPointerId = null;
      }
      return;
    }

    const cell = normalizeSelectionCell(positionToCell(event));
    const isPlainPrimaryClick =
      event.button === 0 &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey;

    // --- Multi-click detection (before clearing selection) ---
    if (isPlainPrimaryClick && !selectionState.dragging) {
      const lastAt = desktopSelectionState.lastPrimaryClickAt;
      const lastCell = desktopSelectionState.lastPrimaryClickCell;
      const lastCount = desktopSelectionState.lastPrimaryClickCount || 0;
      const now = performance.now();
      const sameCell = lastCell?.row === cell.row && lastCell?.col === cell.col;
      const withinTimeout = sameCell && now - lastAt <= 700;
      const clickCount = withinTimeout ? lastCount + 1 : 1;

      if (clickCount >= 3 && selectLineAtCell(cell)) {
        if (desktopSelectionState.pendingPointerId === event.pointerId) clearPendingDesktopSelection();
        desktopSelectionState.lastPrimaryClickAt = now;
        desktopSelectionState.lastPrimaryClickCell = { row: cell.row, col: cell.col };
        desktopSelectionState.lastPrimaryClickCount = clickCount;
        event.preventDefault();
        return;
      }

      if (clickCount >= 2 && selectWordAtCell(cell)) {
        if (desktopSelectionState.pendingPointerId === event.pointerId) clearPendingDesktopSelection();
        desktopSelectionState.lastPrimaryClickAt = now;
        desktopSelectionState.lastPrimaryClickCell = { row: cell.row, col: cell.col };
        desktopSelectionState.lastPrimaryClickCount = clickCount;
        event.preventDefault();
        return;
      }
    }

    // --- Single click flow ---
    const clearSelectionFromClick =
      desktopSelectionState.pendingPointerId === event.pointerId &&
      desktopSelectionState.startedWithActiveSelection &&
      !selectionState.dragging;
    if (desktopSelectionState.pendingPointerId === event.pointerId) {
      clearPendingDesktopSelection();
    }
    if (clearSelectionFromClick) clearSelection();
    if (selectionState.dragging) {
      event.preventDefault();
      selectionState.dragging = false;
      selectionState.focus = cell;
      if (
        selectionState.anchor &&
        selectionState.focus &&
        selectionState.anchor.row === selectionState.focus.row &&
        selectionState.anchor.col === selectionState.focus.col
      ) {
        clearSelection();
      } else {
        updateCanvasCursor();
        markNeedsRender();
      }
    } else {
      if (
        shouldRoutePointerToAppMouse(event.shiftKey) &&
        inputHandler.sendMouseEvent("up", event)
      ) {
        event.preventDefault();
        return;
      }
      updateLinkHover(cell);
    }
    // Single click tracking
    if (!selectionState.active && isPlainPrimaryClick) {
      const now = performance.now();
      desktopSelectionState.lastPrimaryClickAt = now;
      desktopSelectionState.lastPrimaryClickCell = { row: cell.row, col: cell.col };
      desktopSelectionState.lastPrimaryClickCount = 1;
    } else if (event.button === 0) {
      desktopSelectionState.lastPrimaryClickAt = 0;
      desktopSelectionState.lastPrimaryClickCell = null;
      desktopSelectionState.lastPrimaryClickCount = 0;
    }
    if (
      !selectionState.active &&
      event.button === 0 &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      inputHandler.isPromptClickEventsEnabled()
    ) {
      const seq = inputHandler.encodePromptClickEvent(cell);
      if (seq) {
        event.preventDefault();
        sendKeyInput(seq);
        return;
      }
    }
    if (
      !selectionState.active &&
      event.button === 0 &&
      linkState.hoverUri &&
      (event.metaKey || event.ctrlKey)
    ) {
      openLink(linkState.hoverUri);
    }
  };
}

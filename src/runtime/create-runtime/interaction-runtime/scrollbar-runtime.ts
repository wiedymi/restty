import { clamp } from "../../../grid";
import { createNativeScrollbarHost } from "../native-scrollbar-host";
import type { CreateScrollbarRuntimeOptions, ScrollbarRuntime } from "./state.types";

export function createScrollbarRuntime(options: CreateScrollbarRuntimeOptions): ScrollbarRuntime {
  const {
    scrollbarState,
    selectionState,
    linkState,
    getCanvas,
    getGridState,
    getWasmReady,
    getWasm,
    getWasmHandle,
    getWasmExports,
    updateLinkHover,
    markNeedsRender,
    markSearchDirty,
  } = options;

  let scrollRemainder = 0;
  let pendingPrecisionScrollPx = 0;
  const hasCoarsePointer =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(any-pointer: coarse)").matches;
  const hasTouchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const nativeScrollHost =
    !hasCoarsePointer && !hasTouchPoints && typeof document !== "undefined"
      ? createNativeScrollbarHost({
          canvas: getCanvas(),
          getGridState,
          noteScrollActivity: () => {
            scrollbarState.lastInputAt = performance.now();
          },
          setViewportScrollOffset: (nextOffset) => {
            setViewportScrollOffset(nextOffset);
          },
        })
      : null;

  const getViewportScrollOffset = () => {
    const wasmHandle = getWasmHandle();
    const wasmExports = getWasmExports();
    if (!wasmHandle || !wasmExports?.restty_scrollbar_offset) return 0;
    return wasmExports.restty_scrollbar_offset(wasmHandle) || 0;
  };

  const shiftSelectionByRows = (deltaRows: number) => {
    if (!deltaRows) return;
    if (!selectionState.active && !selectionState.dragging) return;
    if (!selectionState.anchor || !selectionState.focus) return;
    const { rows } = getGridState();
    const maxAbs = Math.max(1024, (rows || 24) * 128);
    selectionState.anchor = {
      row: clamp(selectionState.anchor.row + deltaRows, -maxAbs, maxAbs),
      col: selectionState.anchor.col,
    };
    selectionState.focus = {
      row: clamp(selectionState.focus.row + deltaRows, -maxAbs, maxAbs),
      col: selectionState.focus.col,
    };
    markNeedsRender();
  };

  const noteScrollActivity = () => {
    scrollbarState.lastInputAt = performance.now();
    nativeScrollHost?.flash();
  };

  const scrollViewportByLines = (lines: number) => {
    const wasm = getWasm();
    const wasmHandle = getWasmHandle();
    const { cellH } = getGridState();
    if (!getWasmReady() || !wasm || !wasmHandle || !cellH) return;
    scrollRemainder += lines;
    const delta = Math.trunc(scrollRemainder);
    scrollRemainder -= delta;
    if (!delta) return;
    const beforeOffset = getViewportScrollOffset();
    wasm.scrollViewport(wasmHandle, delta);
    const afterOffset = getViewportScrollOffset();
    shiftSelectionByRows(beforeOffset - afterOffset);
    if (linkState.hoverId) updateLinkHover(null);
    wasm.renderUpdate(wasmHandle);
    markSearchDirty?.();
    markNeedsRender();
    noteScrollActivity();
  };

  const scrollViewportByWheel = (event: WheelEvent) => {
    const { cellH, rows } = getGridState();
    if (!cellH) return;

    const isPrecision = event.deltaMode === 0;
    if (isPrecision) {
      const precisionMultiplier = 2;
      const adjustedPx = event.deltaY * precisionMultiplier;
      const pendingPx = pendingPrecisionScrollPx + adjustedPx;
      if (Math.abs(pendingPx) < cellH) {
        pendingPrecisionScrollPx = pendingPx;
        noteScrollActivity();
        return;
      }

      const amount = pendingPx / cellH;
      pendingPrecisionScrollPx = pendingPx - Math.trunc(amount) * cellH;
      if (amount) {
        scrollViewportByLines(Math.trunc(amount));
      }
      return;
    }

    pendingPrecisionScrollPx = 0;
    if (event.deltaMode === 1) {
      const discreteMultiplier = 3;
      const yoff = event.deltaY > 0 ? Math.max(event.deltaY, 1) : Math.min(event.deltaY, -1);
      scrollViewportByLines(yoff * discreteMultiplier);
      return;
    }

    const pageLines = rows > 0 ? rows : 24;
    scrollViewportByLines(event.deltaY * pageLines);
  };

  const setViewportScrollOffset = (nextOffset: number) => {
    const wasm = getWasm();
    const wasmHandle = getWasmHandle();
    const wasmExports = getWasmExports();
    if (!getWasmReady() || !wasm || !wasmHandle || !wasmExports?.restty_scrollbar_total) return;
    const total = wasmExports.restty_scrollbar_total(wasmHandle) || 0;
    const len = wasmExports.restty_scrollbar_len ? wasmExports.restty_scrollbar_len(wasmHandle) : 0;
    const current = wasmExports.restty_scrollbar_offset
      ? wasmExports.restty_scrollbar_offset(wasmHandle)
      : 0;
    const maxOffset = Math.max(0, total - len);
    const clamped = clamp(Math.round(nextOffset), 0, maxOffset);
    const delta = clamped - current;
    if (!delta) return;
    const beforeOffset = getViewportScrollOffset();
    wasm.scrollViewport(wasmHandle, delta);
    const afterOffset = getViewportScrollOffset();
    shiftSelectionByRows(beforeOffset - afterOffset);
    if (linkState.hoverId) updateLinkHover(null);
    wasm.renderUpdate(wasmHandle);
    markSearchDirty?.();
    markNeedsRender();
    noteScrollActivity();
  };

  return {
    destroy: () => {
      nativeScrollHost?.destroy();
    },
    noteScrollActivity,
    scrollViewportByLines,
    scrollViewportByWheel,
    syncScrollbar: (total, offset, len) => {
      nativeScrollHost?.sync(total, offset, len);
    },
  };
}

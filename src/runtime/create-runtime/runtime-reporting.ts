import {
  selectionForRow as selectionRangeForRow,
  getSelectionText as extractSelectionText,
} from "../../selection";
import type { CursorInfo, RenderState } from "../../wasm";
import type { RuntimeReportingOptions } from "./runtime-reporting.types";

export function createRuntimeReporting(options: RuntimeReportingOptions) {
  let lastReportedTermCols = -1;
  let lastReportedTermRows = -1;
  let lastReportedCursorCol = -1;
  let lastReportedCursorRow = -1;
  let lastResolvedCursor: { col: number; row: number; wideTail: boolean } | null = null;

  function selectionForRow(row: number, cols: number) {
    return selectionRangeForRow(options.selectionState, row, cols);
  }

  function getCellText(render: RenderState, idx: number): string {
    const cp = render.codepoints[idx];
    if (!cp) return " ";
    let text = String.fromCodePoint(cp);
    if (render.graphemeLen && render.graphemeOffset && render.graphemeBuffer) {
      const extra = render.graphemeLen[idx] ?? 0;
      if (extra > 0) {
        const start = render.graphemeOffset[idx] ?? 0;
        const cps = [cp];
        for (let j = 0; j < extra; j += 1) {
          const extraCp = render.graphemeBuffer[start + j];
          if (extraCp) cps.push(extraCp);
        }
        text = String.fromCodePoint(...cps);
      }
    }
    return text;
  }

  function getSelectionText(): string {
    const lastRenderState = options.getLastRenderState();
    if (!lastRenderState) return "";
    const { rows, cols } = lastRenderState;
    const state = options.selectionState;
    if (!state.active || !state.anchor || !state.focus || !rows || !cols) return "";
    const forward =
      state.anchor.row < state.focus.row ||
      (state.anchor.row === state.focus.row && state.anchor.col <= state.focus.col);
    const start = forward ? state.anchor : state.focus;
    const end = forward ? state.focus : state.anchor;
    if (![start.row, start.col, end.row, end.col].every(Number.isSafeInteger)) return "";
    if (start.row >= 0 && end.row < rows) {
      return extractSelectionText(state, rows, cols, (idx) => getCellText(lastRenderState, idx));
    }

    const wasm = options.getWasm();
    const handle = options.getWasmHandle();
    const exports = options.getWasmExports();
    if (
      !options.getWasmReady() ||
      !wasm ||
      !handle ||
      !exports?.restty_scroll_viewport ||
      !exports.restty_scrollbar_offset ||
      !exports.restty_scrollbar_total
    ) {
      return "";
    }
    const getOffset = () => exports.restty_scrollbar_offset!(handle);
    const originalOffset = getOffset();
    const total = exports.restty_scrollbar_total(handle);
    const firstRow = originalOffset + start.row;
    const lastRow = originalOffset + end.row;
    if (lastRow < 0 || firstRow >= total) return "";
    const selection = {
      ...state,
      anchor: { row: Math.max(0, firstRow), col: firstRow < 0 ? 0 : start.col },
      focus: { row: Math.min(total - 1, lastRow), col: lastRow >= total ? cols - 1 : end.col },
    };
    // Scroll deltas cross the WASM ABI as signed 32-bit integers.
    const moveTo = (target: number) => {
      let offset = getOffset();
      while (offset !== target) {
        const delta = Math.max(-0x7fffffff, Math.min(0x7fffffff, target - offset));
        wasm.scrollViewport(handle, delta);
        const next = getOffset();
        if (next !== offset + delta) throw new Error("Cannot read selected scrollback rows");
        offset = next;
      }
    };
    let render = lastRenderState;
    let offset = originalOffset;
    try {
      return extractSelectionText(selection, total, cols, (idx) => {
        const row = Math.floor(idx / cols);
        if (row < offset || row >= offset + rows) {
          moveTo(Math.min(row, Math.max(0, total - rows)));
          offset = getOffset();
          wasm.renderUpdate(handle);
          render = wasm.getRenderState(handle);
        }
        return getCellText(render, idx - offset * cols);
      });
    } finally {
      // Render views share WASM memory. Restore their contents as well as the viewport.
      moveTo(originalOffset);
      wasm.renderUpdate(handle);
    }
  }

  function getRenderState(): RenderState | null {
    const wasmReady = options.getWasmReady();
    const wasm = options.getWasm();
    const wasmHandle = options.getWasmHandle();
    if (!wasmReady || !wasm || !wasmHandle) return null;
    return wasm.getRenderState(wasmHandle);
  }

  function resolveCursorPosition(cursor: CursorInfo | null) {
    if (!cursor) return lastResolvedCursor;
    if (cursor.visible === 0 && lastResolvedCursor) {
      return lastResolvedCursor;
    }
    let col = Number(cursor.col);
    let row = Number(cursor.row);
    if (!Number.isFinite(col)) col = 0;
    if (!Number.isFinite(row)) row = 0;
    const render = options.getLastRenderState();
    const cols = render?.cols ?? 0;
    const rows = render?.rows ?? 0;
    const inBounds = (valueCol: number, valueRow: number): boolean => {
      if (!Number.isFinite(valueCol) || !Number.isFinite(valueRow)) return false;
      if (cols <= 0 || rows <= 0) return true;
      return valueCol >= 0 && valueRow >= 0 && valueCol < cols && valueRow < rows;
    };
    const wasmExports = options.getWasmExports();
    const wasmHandle = options.getWasmHandle();
    const getActiveCursor = (): { col: number; row: number } | null => {
      if (
        !wasmExports?.restty_active_cursor_x ||
        !wasmExports?.restty_active_cursor_y ||
        !wasmHandle
      ) {
        return null;
      }
      const activeCol = wasmExports.restty_active_cursor_x(wasmHandle);
      const activeRow = wasmExports.restty_active_cursor_y(wasmHandle);
      if (!inBounds(activeCol, activeRow)) return null;
      return { col: activeCol, row: activeRow };
    };
    if (cursor.visible === 0 && !lastResolvedCursor) {
      const active = getActiveCursor();
      if (active) {
        lastResolvedCursor = {
          col: active.col,
          row: active.row,
          wideTail: cursor.wideTail === 1,
        };
        return lastResolvedCursor;
      }
    }
    const activeFallback = !inBounds(col, row) ? getActiveCursor() : null;
    if (activeFallback) {
      col = activeFallback.col;
      row = activeFallback.row;
    }
    if (cols > 0 && rows > 0) {
      col = Math.max(0, Math.min(cols - 1, Math.floor(col)));
      row = Math.max(0, Math.min(rows - 1, Math.floor(row)));
    } else {
      col = Math.max(0, Math.floor(col));
      row = Math.max(0, Math.floor(row));
    }
    lastResolvedCursor = { col, row, wideTail: cursor.wideTail === 1 };
    return lastResolvedCursor;
  }

  function resolveCursorStyle(
    cursor: CursorInfo | null,
    opts: { focused: boolean; preedit: boolean; blinkVisible: boolean },
  ): number | null {
    if (!cursor) return null;
    const visible = cursor.visible !== 0;
    if (!visible || opts.preedit) return null;
    if (!opts.focused) return 3;
    if (cursor.blinking && !opts.blinkVisible) return null;
    return cursor.style ?? 0;
  }

  function reportTermSize(cols: number, rows: number): void {
    if (cols === lastReportedTermCols && rows === lastReportedTermRows) return;
    lastReportedTermCols = cols;
    lastReportedTermRows = rows;
    options.emitRuntimeEvent?.({ type: "term-size", cols, rows });
  }

  function reportCursor(cursorPos: { col: number; row: number } | null): void {
    if (!cursorPos) return;
    const { col, row } = cursorPos;
    if (col !== lastReportedCursorCol || row !== lastReportedCursorRow) {
      lastReportedCursorCol = col;
      lastReportedCursorRow = row;
    }
    options.setCursorForCpr({ row: row + 1, col: col + 1 });
  }

  return {
    selectionForRow,
    getSelectionText,
    getRenderState,
    resolveCursorPosition,
    resolveCursorStyle,
    reportTermSize,
    reportCursor,
  };
}

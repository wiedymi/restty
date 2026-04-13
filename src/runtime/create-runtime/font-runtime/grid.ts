import { resetFontEntry } from "../../../fonts";
import { fontHeightUnits } from "../../../grid";
import type { CellMetrics } from "./types";
import type { CreateFontRuntimeGridHelpersOptions } from "./grid.types";

export function createFontRuntimeGridHelpers(options: CreateFontRuntimeGridHelpersOptions) {
  const {
    fontState,
    fontConfig,
    gridState,
    getCanvas,
    getCurrentDpr,
    getActiveState,
    getWasmReady,
    getWasm,
    getWasmHandle,
    ptyTransport,
    setNeedsRender,
    markSearchDirty,
    shapeClusterWithFont,
  } = options;

  function computeCellMetrics(): CellMetrics | null {
    const primary = fontState.fonts[0];
    if (!primary) return null;
    const fontSizePx = Math.max(1, Math.round(fontConfig.sizePx * getCurrentDpr()));
    const scale = primary.font.scaleForSize(fontSizePx, fontState.sizeMode);
    const glyphId = primary.font.glyphIdForChar("M");
    const advanceUnits =
      glyphId !== undefined && glyphId !== null
        ? primary.font.advanceWidth(glyphId)
        : shapeClusterWithFont(primary, "M").advance;
    const cellW = Math.max(1, Math.round(advanceUnits * scale));
    const lineHeight = fontHeightUnits(primary.font) * scale;
    const cellH = Math.max(1, Math.round(lineHeight));
    const baselineOffset = primary.font.ascender * scale;
    const yPad = Math.max(0, (cellH - lineHeight) * 0.5);
    return { cellW, cellH, fontSizePx, scale, lineHeight, baselineOffset, yPad };
  }

  function commitTerminalResize(cols: number, rows: number): void {
    const wasmReady = getWasmReady();
    const wasm = getWasm();
    const wasmHandle = getWasmHandle();
    const canvas = getCanvas();
    if (wasmReady && wasm && wasmHandle) {
      wasm.resize(wasmHandle, cols, rows);
      wasm.renderUpdate(wasmHandle);
      markSearchDirty?.();
    }
    if (ptyTransport.isConnected()) {
      ptyTransport.resize(cols, rows, {
        widthPx: canvas.width,
        heightPx: canvas.height,
        cellW: gridState.cellW,
        cellH: gridState.cellH,
      });
    }
    setNeedsRender();
  }

  function updateGrid(): void {
    if (!fontState.fonts.length) return;
    const metrics = computeCellMetrics();
    if (!metrics) return;
    const canvas = getCanvas();
    const cols = Math.max(1, Math.floor(canvas.width / metrics.cellW));
    const rows = Math.max(1, Math.floor(canvas.height / metrics.cellH));
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) return;
    const gridSizeChanged = cols !== gridState.cols || rows !== gridState.rows;
    const cellSizeChanged = metrics.cellW !== gridState.cellW || metrics.cellH !== gridState.cellH;
    const changed =
      gridSizeChanged || metrics.fontSizePx !== gridState.fontSizePx || cellSizeChanged;

    if (metrics.fontSizePx !== gridState.fontSizePx) {
      for (const entry of fontState.fonts) resetFontEntry(entry);
      const activeState = getActiveState();
      if (activeState && activeState.glyphAtlases) {
        activeState.glyphAtlases = new Map();
      }
    }

    Object.assign(gridState, metrics, { cols, rows });

    const wasmReady = getWasmReady();
    const wasm = getWasm();
    const wasmHandle = getWasmHandle();
    if (wasmReady && wasm && wasmHandle) {
      wasm.setPixelSize(wasmHandle, canvas.width, canvas.height);
    }

    if (changed) {
      commitTerminalResize(cols, rows);
    }
  }

  return {
    computeCellMetrics,
    updateGrid,
  };
}

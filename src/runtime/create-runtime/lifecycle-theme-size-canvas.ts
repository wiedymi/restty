import type { CanvasStateSnapshot, LifecycleThemeSizeDeps } from "./lifecycle-theme-size.types";

export function createLifecycleCanvasHandlers(deps: LifecycleThemeSizeDeps) {
  let sizeRaf = 0;
  let savedCanvasState: CanvasStateSnapshot | null = null;

  function saveCanvasState(): void {
    const canvas = deps.getCanvas();
    savedCanvasState = {
      width: canvas.width,
      height: canvas.height,
      dpr: deps.getCurrentDpr(),
      gridCols: deps.gridState.cols,
      gridRows: deps.gridState.rows,
      cellW: deps.gridState.cellW,
      cellH: deps.gridState.cellH,
      fontSizePx: deps.gridState.fontSizePx,
    };
  }

  function restoreCanvasState(): void {
    if (!savedCanvasState) return;
    const canvas = deps.getCanvas();
    canvas.width = savedCanvasState.width;
    canvas.height = savedCanvasState.height;
    deps.setCurrentDpr(savedCanvasState.dpr);
    deps.gridState.cols = savedCanvasState.gridCols;
    deps.gridState.rows = savedCanvasState.gridRows;
    deps.gridState.cellW = savedCanvasState.cellW;
    deps.gridState.cellH = savedCanvasState.cellH;
    deps.gridState.fontSizePx = savedCanvasState.fontSizePx;
    savedCanvasState = null;
  }

  function replaceCanvas(): void {
    const canvas = deps.getCanvas();
    const parent = canvas.parentElement;
    if (!parent) return;

    saveCanvasState();
    for (const cleanup of deps.cleanupCanvasFns) cleanup();
    deps.cleanupCanvasFns.length = 0;
    deps.clearKittyRenderCaches();
    deps.destroyWebGPUStageTargets();
    const activeState = deps.getActiveState();
    if (activeState && "gl" in activeState) {
      deps.clearWebGLShaderStages(activeState);
      deps.destroyWebGLStageTargets(activeState);
    } else {
      deps.clearWebGLShaderStages();
      deps.destroyWebGLStageTargets();
    }

    const newCanvas = document.createElement("canvas");
    newCanvas.id = canvas.id;
    newCanvas.className = canvas.className;
    parent.replaceChild(newCanvas, canvas);
    deps.setCanvas(newCanvas);
    deps.setIsFocused(
      typeof document !== "undefined" ? document.activeElement === deps.getCanvas() : true,
    );

    restoreCanvasState();
    deps.bindCanvasEvents();
    bindFocusEvents();

    deps.setCurrentContextType(null);
    for (const entry of deps.fontState.fonts) {
      if (entry) {
        entry.atlas = null;
        entry.glyphIds = new Set();
        entry.fontSizePx = 0;
      }
    }
    const nextActiveState = deps.getActiveState();
    if (nextActiveState && nextActiveState.glyphAtlases) {
      nextActiveState.glyphAtlases.clear();
    }
    deps.setShaderStagesDirty(true);
  }

  function updateSize(force = false) {
    const canvas = deps.getCanvas();
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
    const nextHeight = Math.max(1, Math.floor(rect.height * dpr));
    const sizeChanged =
      nextWidth !== canvas.width || nextHeight !== canvas.height || dpr !== deps.getCurrentDpr();
    if (!sizeChanged && !force) return;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    deps.setCurrentDpr(dpr);
    deps.resizeState.dpr = dpr;
    deps.resizeState.active = true;
    deps.resizeState.lastAt = performance.now();
    const metrics = deps.computeCellMetrics();
    if (metrics?.cellW && metrics?.cellH) {
      deps.resizeState.cols = Math.max(1, Math.floor(canvas.width / metrics.cellW));
      deps.resizeState.rows = Math.max(1, Math.floor(canvas.height / metrics.cellH));
    }
    deps.updateGrid();
    deps.markNeedsRender();
    deps.resetLastRenderTime();
  }

  function resize(cols: number, rows: number) {
    const nextCols = Math.max(1, Math.floor(Number(cols)));
    const nextRows = Math.max(1, Math.floor(Number(rows)));
    if (!Number.isFinite(nextCols) || !Number.isFinite(nextRows)) return;

    const dpr = window.devicePixelRatio || 1;
    if (dpr !== deps.getCurrentDpr()) {
      deps.setCurrentDpr(dpr);
    }

    const metrics = deps.computeCellMetrics();
    if (!metrics) return;

    const canvas = deps.getCanvas();
    canvas.width = Math.max(1, nextCols * metrics.cellW);
    canvas.height = Math.max(1, nextRows * metrics.cellH);

    deps.resizeState.dpr = deps.getCurrentDpr();
    deps.resizeState.active = true;
    deps.resizeState.lastAt = performance.now();
    deps.resizeState.cols = nextCols;
    deps.resizeState.rows = nextRows;

    deps.updateGrid();
    deps.markNeedsRender();
    deps.resetLastRenderTime();
  }

  function scheduleSizeUpdate() {
    updateSize();
    if (sizeRaf) return;
    sizeRaf = requestAnimationFrame(() => {
      sizeRaf = 0;
      updateSize();
    });
  }

  function focusTypingInput() {
    const canvas = deps.getCanvas();
    canvas.focus({ preventScroll: true });
    if (!deps.imeInput) return;
    const focusImeInput = () => {
      deps.imeInput?.focus({ preventScroll: true });
    };
    focusImeInput();
    if (typeof document !== "undefined" && document.activeElement !== deps.imeInput) {
      requestAnimationFrame(() => {
        focusImeInput();
        if (document.activeElement !== deps.imeInput) {
          setTimeout(focusImeInput, 0);
        }
      });
    }
  }

  function focus() {
    focusTypingInput();
    const canvas = deps.getCanvas();
    deps.setIsFocused(
      typeof document !== "undefined" && deps.imeInput
        ? document.activeElement === canvas || document.activeElement === deps.imeInput
        : true,
    );
  }

  function blur() {
    const canvas = deps.getCanvas();
    if (deps.imeInput && document.activeElement === deps.imeInput) {
      deps.imeInput.blur();
    }
    if (document.activeElement === canvas) {
      canvas.blur();
    }
    deps.setIsFocused(false);
  }

  function bindFocusEvents() {
    if (!deps.attachCanvasEvents) return;
    const canvas = deps.getCanvas();
    canvas.tabIndex = 0;
    const handleFocus = () => {
      deps.setIsFocused(true);
      focusTypingInput();
      deps.markNeedsRender();
      deps.resetLastRenderTime();
      if (deps.getInputHandler()?.isFocusReporting?.()) {
        deps.sendKeyInput("\x1b[I", "program");
      }
    };
    const handleBlur = () => {
      const stillFocused =
        typeof document !== "undefined" && deps.imeInput
          ? document.activeElement === deps.imeInput
          : false;
      deps.setIsFocused(stillFocused);
      deps.markNeedsRender();
      deps.resetLastRenderTime();
      if (!stillFocused && deps.getInputHandler()?.isFocusReporting?.()) {
        deps.sendKeyInput("\x1b[O", "program");
      }
    };
    const handlePointerFocus = () => {
      focusTypingInput();
    };
    canvas.addEventListener("pointerdown", handlePointerFocus);
    canvas.addEventListener("focus", handleFocus);
    canvas.addEventListener("blur", handleBlur);
    deps.cleanupCanvasFns.push(() => {
      canvas.removeEventListener("pointerdown", handlePointerFocus);
      canvas.removeEventListener("focus", handleFocus);
      canvas.removeEventListener("blur", handleBlur);
    });
  }

  function bindAutoResizeEvents() {
    const hasResizeObserver = deps.autoResize && "ResizeObserver" in window;
    if (deps.attachWindowEvents && deps.autoResize && !hasResizeObserver) {
      window.addEventListener("resize", scheduleSizeUpdate);
      window.addEventListener("load", scheduleSizeUpdate);
      deps.cleanupFns.push(() => {
        window.removeEventListener("resize", scheduleSizeUpdate);
        window.removeEventListener("load", scheduleSizeUpdate);
      });
    }

    if (hasResizeObserver) {
      const ro = new ResizeObserver(() => scheduleSizeUpdate());
      const target = deps.getCanvas().parentElement ?? document.body;
      ro.observe(target);
      deps.cleanupFns.push(() => ro.disconnect());
    }
  }

  function cancelScheduledSizeUpdate() {
    if (!sizeRaf) return;
    cancelAnimationFrame(sizeRaf);
    sizeRaf = 0;
  }

  return {
    replaceCanvas,
    updateSize,
    resize,
    scheduleSizeUpdate,
    focusTypingInput,
    focus,
    blur,
    bindFocusEvents,
    bindAutoResizeEvents,
    cancelScheduledSizeUpdate,
  };
}

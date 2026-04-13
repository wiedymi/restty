import { createLifecycleCanvasHandlers } from "./canvas";
import { createLifecycleThemeHandlers } from "./theme";
import type { LifecycleThemeSizeDeps } from "./types";

export function createRuntimeLifecycleThemeSize(deps: LifecycleThemeSizeDeps) {
  const { applyTheme, resetTheme } = createLifecycleThemeHandlers(deps);
  const {
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
  } = createLifecycleCanvasHandlers(deps);

  return {
    applyTheme,
    resetTheme,
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
    getActiveTheme: deps.getActiveTheme,
  };
}

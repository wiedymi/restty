import { clamp } from "../../grid";
import type { OverlayScrollbarLayout } from "./overlay-scrollbar.types";
import { computeOverlayScrollbarLayout } from "./overlay-scrollbar";
import type {
  NativeScrollbarHost,
  NativeScrollbarHostOptions,
} from "./native-scrollbar-host.types";

const NATIVE_SCROLLBAR_STYLE_MARKER = "data-restty-native-scrollbar";
const MAX_NATIVE_SCROLL_RANGE_PX = 8_000_000;
const FADE_DELAY_MS = 160;
const FADE_DURATION_MS = 520;
const VISIBLE_OPACITY = 0.68;
const MIN_SCROLL_PX_PER_ROW = 8;
const MAX_SCROLL_PX_PER_ROW = 14;

function ensureNativeScrollbarStyles() {
  if (typeof document === "undefined") return;
  if (document.head.querySelector(`[${NATIVE_SCROLLBAR_STYLE_MARKER}]`)) return;
  const style = document.createElement("style");
  style.setAttribute(NATIVE_SCROLLBAR_STYLE_MARKER, "true");
  style.textContent = `
.restty-native-scroll-host {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: none;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.restty-native-scroll-host::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.restty-native-scroll-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.restty-native-scroll-canvas {
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 0;
  flex: none;
  will-change: transform;
}

.restty-native-scroll-spacer {
  width: 1px;
  min-width: 1px;
  pointer-events: none;
}

.restty-native-scroll-chrome {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  overflow: hidden;
}

.restty-native-scroll-thumb {
  position: absolute;
  top: 0;
  left: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(245, 245, 245, 0.75);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
  opacity: 0;
  transition: opacity ${FADE_DURATION_MS}ms ease;
  pointer-events: auto;
  cursor: default;
}
`;
  document.head.append(style);
}

export function createNativeScrollbarHost(
  options: NativeScrollbarHostOptions,
): NativeScrollbarHost {
  const { canvas, getGridState, noteScrollActivity, setViewportScrollOffset } = options;
  if (typeof document === "undefined") {
    return {
      flash: () => {},
      sync: () => {},
      destroy: () => {},
    };
  }

  const parent = canvas.parentElement;
  if (!parent) {
    return {
      flash: () => {},
      sync: () => {},
      destroy: () => {},
    };
  }

  ensureNativeScrollbarStyles();

  const root = document.createElement("div");
  root.className = "restty-native-scroll-root";
  const host = document.createElement("div");
  host.className = "restty-native-scroll-host";
  const spacer = document.createElement("div");
  spacer.className = "restty-native-scroll-spacer";
  const chrome = document.createElement("div");
  chrome.className = "restty-native-scroll-chrome";
  const thumb = document.createElement("div");
  thumb.className = "restty-native-scroll-thumb";
  chrome.append(thumb);

  parent.insertBefore(root, canvas);
  root.append(host, chrome);
  host.append(canvas, spacer);

  canvas.classList.add("restty-native-scroll-canvas");

  let destroyed = false;
  let currentLayout: OverlayScrollbarLayout | null = null;
  let currentDenom = 0;
  let currentScrollRangePx = 0;
  let ignoreNextScroll = false;
  let fadeTimer = 0;
  let dragPointerId: number | null = null;
  let dragGrabRatio = 0.5;

  const resolveScrollPxPerRow = () => {
    const cellH = Math.max(1, Number(getGridState().cellH || 1));
    return clamp(cellH * 0.5, MIN_SCROLL_PX_PER_ROW, MAX_SCROLL_PX_PER_ROW);
  };

  const setThumbVisible = (visible: boolean) => {
    thumb.style.opacity = visible ? `${VISIBLE_OPACITY}` : "0";
  };

  const applyCanvasResidual = (offset: number) => {
    if (!currentDenom || currentScrollRangePx <= 0) {
      canvas.style.transform = "translate3d(0, 0, 0)";
      return;
    }
    const logicalScrollTop = (offset / currentDenom) * currentScrollRangePx;
    const residual = host.scrollTop - logicalScrollTop;
    canvas.style.transform = `translate3d(0, ${-residual}px, 0)`;
  };

  const scheduleThumbFade = () => {
    if (fadeTimer) {
      clearTimeout(fadeTimer);
      fadeTimer = 0;
    }
    setThumbVisible(true);
    fadeTimer = window.setTimeout(() => {
      fadeTimer = 0;
      if (dragPointerId === null) {
        setThumbVisible(false);
      }
    }, FADE_DELAY_MS);
  };

  const applyScrollTopToViewport = () => {
    if (!currentDenom || currentScrollRangePx <= 0) return;
    const ratio = clamp(host.scrollTop / currentScrollRangePx, 0, 1);
    const nextOffset = Math.round(ratio * currentDenom);
    applyCanvasResidual(nextOffset);
    setViewportScrollOffset(nextOffset);
  };

  const onHostScroll = () => {
    if (ignoreNextScroll) {
      ignoreNextScroll = false;
      return;
    }
    noteScrollActivity();
    scheduleThumbFade();
    applyScrollTopToViewport();
  };

  const onHostWheel = (event: WheelEvent) => {
    if (!currentScrollRangePx) return;
    const maxScrollTop = Math.max(0, host.scrollHeight - host.clientHeight);
    const atTop = host.scrollTop <= 0;
    const atBottom = host.scrollTop >= maxScrollTop;
    if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
      event.preventDefault();
    }
  };

  const pointerYToScrollTop = (clientY: number) => {
    if (!currentLayout || currentScrollRangePx <= 0) return 0;
    const rect = root.getBoundingClientRect();
    const localY = clientY - rect.top;
    const thumbTop = localY - currentLayout.thumbH * dragGrabRatio;
    const trackSpan = Math.max(1, currentLayout.trackH - currentLayout.thumbH);
    const ratio = clamp((thumbTop - currentLayout.trackY) / trackSpan, 0, 1);
    return ratio * currentScrollRangePx;
  };

  const onThumbPointerMove = (event: PointerEvent) => {
    if (dragPointerId !== event.pointerId) return;
    host.scrollTop = pointerYToScrollTop(event.clientY);
    event.preventDefault();
  };

  const endThumbDrag = (pointerId: number | null) => {
    if (pointerId === null || dragPointerId !== pointerId) return;
    dragPointerId = null;
    thumb.releasePointerCapture?.(pointerId);
    scheduleThumbFade();
  };

  const onThumbPointerUp = (event: PointerEvent) => {
    endThumbDrag(event.pointerId);
  };

  const onThumbPointerCancel = (event: PointerEvent) => {
    endThumbDrag(event.pointerId);
  };

  const onThumbPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !currentLayout) return;
    const rect = thumb.getBoundingClientRect();
    dragPointerId = event.pointerId;
    dragGrabRatio = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    thumb.setPointerCapture?.(event.pointerId);
    noteScrollActivity();
    setThumbVisible(true);
    host.scrollTop = pointerYToScrollTop(event.clientY);
    event.preventDefault();
  };

  const onThumbPointerEnter = () => {
    setThumbVisible(true);
  };

  const onThumbPointerLeave = () => {
    if (dragPointerId === null) {
      scheduleThumbFade();
    }
  };

  host.addEventListener("scroll", onHostScroll, { passive: true });
  host.addEventListener("wheel", onHostWheel, { passive: false });
  thumb.addEventListener("pointerdown", onThumbPointerDown);
  thumb.addEventListener("pointermove", onThumbPointerMove);
  thumb.addEventListener("pointerup", onThumbPointerUp);
  thumb.addEventListener("pointercancel", onThumbPointerCancel);
  thumb.addEventListener("pointerenter", onThumbPointerEnter);
  thumb.addEventListener("pointerleave", onThumbPointerLeave);

  return {
    flash: () => {
      if (!currentLayout) return;
      scheduleThumbFade();
    },
    sync: (total, offset, len) => {
      if (destroyed) return;
      const clientWidth = Math.max(1, host.clientWidth || canvas.clientWidth || canvas.width);
      const clientHeight = Math.max(1, host.clientHeight || canvas.clientHeight || canvas.height);

      if (!(total > len && len > 0)) {
        currentLayout = null;
        currentDenom = 0;
        currentScrollRangePx = 0;
        spacer.style.height = "0px";
        chrome.style.display = "none";
        canvas.style.transform = "translate3d(0, 0, 0)";
        if (host.scrollTop !== 0) {
          ignoreNextScroll = true;
          host.scrollTop = 0;
        }
        return;
      }

      currentDenom = Math.max(1, total - len);
      currentScrollRangePx = Math.min(
        MAX_NATIVE_SCROLL_RANGE_PX,
        Math.max(clientHeight, currentDenom * resolveScrollPxPerRow()),
      );
      spacer.style.height = `${currentScrollRangePx}px`;

      const nextScrollTop = Math.round((offset / currentDenom) * currentScrollRangePx);
      if (Math.abs(host.scrollTop - nextScrollTop) > 0.5) {
        ignoreNextScroll = true;
        host.scrollTop = nextScrollTop;
      }
      applyCanvasResidual(offset);

      currentLayout = computeOverlayScrollbarLayout(
        total,
        offset,
        len,
        clientWidth,
        clientHeight,
        1,
      );
      if (!currentLayout) {
        chrome.style.display = "none";
        return;
      }

      chrome.style.display = "block";
      thumb.style.left = `${currentLayout.trackX}px`;
      thumb.style.width = `${currentLayout.width}px`;
      thumb.style.height = `${currentLayout.thumbH}px`;
      thumb.style.transform = `translateY(${currentLayout.thumbY}px)`;
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (fadeTimer) {
        clearTimeout(fadeTimer);
        fadeTimer = 0;
      }
      host.removeEventListener("scroll", onHostScroll);
      host.removeEventListener("wheel", onHostWheel);
      thumb.removeEventListener("pointerdown", onThumbPointerDown);
      thumb.removeEventListener("pointermove", onThumbPointerMove);
      thumb.removeEventListener("pointerup", onThumbPointerUp);
      thumb.removeEventListener("pointercancel", onThumbPointerCancel);
      thumb.removeEventListener("pointerenter", onThumbPointerEnter);
      thumb.removeEventListener("pointerleave", onThumbPointerLeave);
      const currentCanvas = root.querySelector("canvas");
      if (currentCanvas && root.parentElement) {
        currentCanvas.classList.remove("restty-native-scroll-canvas");
        currentCanvas.style.transform = "";
        root.parentElement.replaceChild(currentCanvas, root);
      } else {
        root.remove();
      }
    },
  };
}

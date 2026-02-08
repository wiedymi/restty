import type { ResttyPaneStyleOptions } from "./panes-types";

const RESTTY_PANE_ROOT_CLASS = "restty-pane-root";
const RESTTY_PANE_STYLE_MARKER = "data-restty-pane-styles";
const RESTTY_PANE_STYLE_TEXT = `
.${RESTTY_PANE_ROOT_CLASS} {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.${RESTTY_PANE_ROOT_CLASS} .pane-split {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  gap: 0;
  padding: 0;
  background: var(--restty-pane-split-background, #000);
}

.${RESTTY_PANE_ROOT_CLASS} .pane-split.is-vertical {
  flex-direction: row;
}

.${RESTTY_PANE_ROOT_CLASS} .pane-split.is-horizontal {
  flex-direction: column;
}

.${RESTTY_PANE_ROOT_CLASS} .pane {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  background: var(--restty-pane-background, #000);
  border: 0;
  overflow: hidden;
  opacity: var(--restty-pane-inactive-opacity, 0.9);
  transition: opacity var(--restty-pane-opacity-transition, 140ms) ease-out;
}

.${RESTTY_PANE_ROOT_CLASS} .pane.is-active {
  opacity: var(--restty-pane-active-opacity, 1);
}

.${RESTTY_PANE_ROOT_CLASS} .pane-divider {
  position: relative;
  z-index: 2;
  flex: 0 0 var(--restty-pane-divider-thickness, 1px);
  touch-action: none;
}

.${RESTTY_PANE_ROOT_CLASS} .pane-divider.is-vertical {
  cursor: col-resize;
  background: transparent;
}

.${RESTTY_PANE_ROOT_CLASS} .pane-divider.is-horizontal {
  cursor: row-resize;
  background: transparent;
}

.${RESTTY_PANE_ROOT_CLASS} .pane-divider.is-vertical:hover,
.${RESTTY_PANE_ROOT_CLASS} .pane-divider.is-vertical.is-dragging {
  background:
    radial-gradient(
      100px 46% at 50% 50%,
      rgba(235, 235, 235, 0.92) 0%,
      rgba(200, 200, 200, 0.48) 46%,
      rgba(155, 155, 155, 0.12) 68%,
      rgba(120, 120, 120, 0) 100%
    ),
    rgba(185, 185, 185, 0.24);
}

.${RESTTY_PANE_ROOT_CLASS} .pane-divider.is-horizontal:hover,
.${RESTTY_PANE_ROOT_CLASS} .pane-divider.is-horizontal.is-dragging {
  background:
    radial-gradient(
      46% 100px at 50% 50%,
      rgba(235, 235, 235, 0.92) 0%,
      rgba(200, 200, 200, 0.48) 46%,
      rgba(155, 155, 155, 0.12) 68%,
      rgba(120, 120, 120, 0) 100%
    ),
    rgba(185, 185, 185, 0.24);
}

body.is-resizing-split {
  user-select: none;
}

.${RESTTY_PANE_ROOT_CLASS} .pane-canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
}

.${RESTTY_PANE_ROOT_CLASS} .pane-ime-input {
  position: fixed;
  left: 0;
  top: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.${RESTTY_PANE_ROOT_CLASS} .pane-term-debug {
  display: none;
}

.pane-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  padding: 6px;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  background: #161616;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
}

.pane-context-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #d6d6d6;
  text-align: left;
  cursor: pointer;
}

.pane-context-menu-item:hover {
  background: #252525;
}

.pane-context-menu-item:disabled {
  opacity: 0.4;
  cursor: default;
}

.pane-context-menu-item.is-danger {
  color: #f1a1a1;
}

.pane-context-menu-label {
  font-size: 12px;
}

.pane-context-menu-shortcut {
  font-size: 10px;
  color: #868686;
}

.pane-context-menu-separator {
  height: 1px;
  margin: 6px 4px;
  background: #2a2a2a;
}
`;

/** Default style options for pane layout and appearance. */
export const DEFAULT_RESTTY_PANE_STYLE_OPTIONS: Required<ResttyPaneStyleOptions> = {
  splitBackground: "#000",
  paneBackground: "#000",
  inactivePaneOpacity: 0.9,
  activePaneOpacity: 1,
  opacityTransitionMs: 140,
  dividerThicknessPx: 1,
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeColor(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

/** Validates and normalizes pane style options, clamping numeric values to safe ranges and applying defaults. */
export function normalizePaneStyleOptions(
  options: ResttyPaneStyleOptions,
): Required<ResttyPaneStyleOptions> {
  const inactivePaneOpacity = Number.isFinite(options.inactivePaneOpacity)
    ? clampNumber(Number(options.inactivePaneOpacity), 0, 1)
    : DEFAULT_RESTTY_PANE_STYLE_OPTIONS.inactivePaneOpacity;
  const activePaneOpacity = Number.isFinite(options.activePaneOpacity)
    ? clampNumber(Number(options.activePaneOpacity), 0, 1)
    : DEFAULT_RESTTY_PANE_STYLE_OPTIONS.activePaneOpacity;
  const opacityTransitionMs = Number.isFinite(options.opacityTransitionMs)
    ? clampNumber(Number(options.opacityTransitionMs), 0, 5000)
    : DEFAULT_RESTTY_PANE_STYLE_OPTIONS.opacityTransitionMs;
  const dividerThicknessPx = Number.isFinite(options.dividerThicknessPx)
    ? clampNumber(Number(options.dividerThicknessPx), 1, 32)
    : DEFAULT_RESTTY_PANE_STYLE_OPTIONS.dividerThicknessPx;
  return {
    splitBackground: normalizeColor(
      options.splitBackground,
      DEFAULT_RESTTY_PANE_STYLE_OPTIONS.splitBackground,
    ),
    paneBackground: normalizeColor(
      options.paneBackground,
      DEFAULT_RESTTY_PANE_STYLE_OPTIONS.paneBackground,
    ),
    inactivePaneOpacity,
    activePaneOpacity,
    opacityTransitionMs,
    dividerThicknessPx,
  };
}

/** Injects the pane stylesheet into the document if not already present. */
export function ensureResttyPaneStylesDocument(doc: Document): void {
  if (doc.querySelector(`style[${RESTTY_PANE_STYLE_MARKER}="1"]`)) return;
  const style = doc.createElement("style");
  style.setAttribute(RESTTY_PANE_STYLE_MARKER, "1");
  style.textContent = RESTTY_PANE_STYLE_TEXT;
  doc.head.appendChild(style);
}

/** Applies pane style options to a root element via CSS custom properties. */
export function applyPaneStyleOptionsToRoot(
  root: HTMLElement,
  options: Readonly<Required<ResttyPaneStyleOptions>>,
): void {
  root.classList.add(RESTTY_PANE_ROOT_CLASS);
  root.style.setProperty("--restty-pane-split-background", options.splitBackground);
  root.style.setProperty("--restty-pane-background", options.paneBackground);
  root.style.setProperty("--restty-pane-inactive-opacity", options.inactivePaneOpacity.toFixed(3));
  root.style.setProperty("--restty-pane-active-opacity", options.activePaneOpacity.toFixed(3));
  root.style.setProperty("--restty-pane-opacity-transition", `${options.opacityTransitionMs}ms`);
  root.style.setProperty("--restty-pane-divider-thickness", `${options.dividerThicknessPx}px`);
}

/** Removes pane style class and custom properties from a root element. */
export function clearPaneStyleOptionsFromRoot(root: HTMLElement): void {
  root.classList.remove(RESTTY_PANE_ROOT_CLASS);
  root.style.removeProperty("--restty-pane-split-background");
  root.style.removeProperty("--restty-pane-background");
  root.style.removeProperty("--restty-pane-inactive-opacity");
  root.style.removeProperty("--restty-pane-active-opacity");
  root.style.removeProperty("--restty-pane-opacity-transition");
  root.style.removeProperty("--restty-pane-divider-thickness");
}

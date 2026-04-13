import type { ResttyPaneSearchUiStyleOptions } from "./types";

const ROOT_CLASS = "restty-search-ui-root";
const STYLE_MARKER = "data-restty-pane-search-ui-styles";
const STYLE_TEXT = `
.${ROOT_CLASS} .restty-pane-search {
  position: absolute;
  top: var(--restty-search-ui-top, 10px);
  right: var(--restty-search-ui-right, 10px);
  z-index: var(--restty-search-ui-z-index, 8);
  width: min(var(--restty-search-ui-max-width, 332px), calc(100% - 20px));
  min-width: var(--restty-search-ui-min-width, 232px);
  display: none;
  align-items: center;
  padding: 6px;
  border: 1px solid var(--restty-search-ui-border, #2a2a2a);
  border-radius: var(--restty-search-ui-radius, 8px);
  background: var(--restty-search-ui-background, #161616);
  color: var(--restty-search-ui-text, #d6d6d6);
  backdrop-filter: blur(var(--restty-search-ui-blur, 8px));
  box-shadow: var(--restty-search-ui-shadow, 0 14px 40px rgba(0, 0, 0, 0.45));
}

.${ROOT_CLASS} .restty-pane-search[data-open="1"] {
  display: flex;
}

.${ROOT_CLASS} .restty-pane-search-row {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr) auto auto auto auto auto;
  gap: 4px;
  align-items: center;
}

.${ROOT_CLASS} .restty-pane-search-input,
.${ROOT_CLASS} .restty-pane-search-button {
  min-width: 0;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out,
    color 120ms ease-out,
    transform 120ms ease-out;
}

.${ROOT_CLASS} .restty-pane-search-input {
  padding: 0 10px;
  background: var(--restty-search-ui-input-background, #252525);
  color: var(--restty-search-ui-input-text, #d6d6d6);
  outline: none;
  font-size: 11px;
  letter-spacing: 0.01em;
}

.${ROOT_CLASS} .restty-pane-search-input::placeholder {
  color: var(--restty-search-ui-input-placeholder, #868686);
}

.${ROOT_CLASS} .restty-pane-search-input:focus {
  border-color: #3a3a3a;
}

.${ROOT_CLASS} .restty-pane-search-button {
  padding: 0 8px;
  background: var(--restty-search-ui-button-background, transparent);
  color: var(--restty-search-ui-button-text, #d6d6d6);
  cursor: pointer;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.${ROOT_CLASS} .restty-pane-search-button:hover:not(:disabled) {
  background: var(--restty-search-ui-button-hover, #252525);
}

.${ROOT_CLASS} .restty-pane-search-button:disabled {
  cursor: default;
  opacity: var(--restty-search-ui-button-disabled-opacity, 0.42);
}

.${ROOT_CLASS} .restty-pane-search-button:focus-visible {
  outline: none;
  border-color: #3a3a3a;
}

.${ROOT_CLASS} .restty-pane-search-status {
  min-width: 0;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 6px;
  background: #252525;
  border: 1px solid #2a2a2a;
  font-size: 10px;
  line-height: 1;
  color: var(--restty-search-ui-status, #868686);
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.${ROOT_CLASS} .restty-pane-search-status[data-empty="1"] {
  display: none;
}

.${ROOT_CLASS} .restty-pane-search-status[data-active="1"] {
  color: var(--restty-search-ui-status-active, #d6d6d6);
}

.${ROOT_CLASS} .restty-pane-search-status[data-complete="1"] {
  color: var(--restty-search-ui-status-complete, #868686);
}
`;

const DEFAULT_STYLE_OPTIONS: Required<ResttyPaneSearchUiStyleOptions> = {
  offsetTopPx: 10,
  offsetRightPx: 10,
  minWidthPx: 232,
  maxWidthPx: 332,
  zIndex: 8,
  borderRadiusPx: 8,
  backdropBlurPx: 8,
  panelBackground: "#161616",
  panelBorderColor: "#2a2a2a",
  panelTextColor: "#d6d6d6",
  panelShadow: "0 14px 40px rgba(0, 0, 0, 0.45)",
  inputBackground: "#252525",
  inputTextColor: "#d6d6d6",
  inputPlaceholderColor: "#868686",
  buttonBackground: "transparent",
  buttonTextColor: "#d6d6d6",
  buttonHoverBackground: "#252525",
  buttonDisabledOpacity: 0.42,
  statusTextColor: "#868686",
  statusActiveTextColor: "#d6d6d6",
  statusCompleteTextColor: "#868686",
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeColor(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

export function normalizeSearchUiStyleOptions(
  options: ResttyPaneSearchUiStyleOptions | undefined,
): Required<ResttyPaneSearchUiStyleOptions> {
  return {
    offsetTopPx: Number.isFinite(options?.offsetTopPx)
      ? clampNumber(Number(options?.offsetTopPx), 0, 256)
      : DEFAULT_STYLE_OPTIONS.offsetTopPx,
    offsetRightPx: Number.isFinite(options?.offsetRightPx)
      ? clampNumber(Number(options?.offsetRightPx), 0, 256)
      : DEFAULT_STYLE_OPTIONS.offsetRightPx,
    minWidthPx: Number.isFinite(options?.minWidthPx)
      ? clampNumber(Number(options?.minWidthPx), 160, 800)
      : DEFAULT_STYLE_OPTIONS.minWidthPx,
    maxWidthPx: Number.isFinite(options?.maxWidthPx)
      ? clampNumber(Number(options?.maxWidthPx), 180, 960)
      : DEFAULT_STYLE_OPTIONS.maxWidthPx,
    zIndex: Number.isFinite(options?.zIndex)
      ? clampNumber(Number(options?.zIndex), 1, 9999)
      : DEFAULT_STYLE_OPTIONS.zIndex,
    borderRadiusPx: Number.isFinite(options?.borderRadiusPx)
      ? clampNumber(Number(options?.borderRadiusPx), 0, 48)
      : DEFAULT_STYLE_OPTIONS.borderRadiusPx,
    backdropBlurPx: Number.isFinite(options?.backdropBlurPx)
      ? clampNumber(Number(options?.backdropBlurPx), 0, 48)
      : DEFAULT_STYLE_OPTIONS.backdropBlurPx,
    panelBackground: normalizeColor(
      options?.panelBackground,
      DEFAULT_STYLE_OPTIONS.panelBackground,
    ),
    panelBorderColor: normalizeColor(
      options?.panelBorderColor,
      DEFAULT_STYLE_OPTIONS.panelBorderColor,
    ),
    panelTextColor: normalizeColor(options?.panelTextColor, DEFAULT_STYLE_OPTIONS.panelTextColor),
    panelShadow: normalizeColor(options?.panelShadow, DEFAULT_STYLE_OPTIONS.panelShadow),
    inputBackground: normalizeColor(
      options?.inputBackground,
      DEFAULT_STYLE_OPTIONS.inputBackground,
    ),
    inputTextColor: normalizeColor(options?.inputTextColor, DEFAULT_STYLE_OPTIONS.inputTextColor),
    inputPlaceholderColor: normalizeColor(
      options?.inputPlaceholderColor,
      DEFAULT_STYLE_OPTIONS.inputPlaceholderColor,
    ),
    buttonBackground: normalizeColor(
      options?.buttonBackground,
      DEFAULT_STYLE_OPTIONS.buttonBackground,
    ),
    buttonTextColor: normalizeColor(
      options?.buttonTextColor,
      DEFAULT_STYLE_OPTIONS.buttonTextColor,
    ),
    buttonHoverBackground: normalizeColor(
      options?.buttonHoverBackground,
      DEFAULT_STYLE_OPTIONS.buttonHoverBackground,
    ),
    buttonDisabledOpacity: Number.isFinite(options?.buttonDisabledOpacity)
      ? clampNumber(Number(options?.buttonDisabledOpacity), 0, 1)
      : DEFAULT_STYLE_OPTIONS.buttonDisabledOpacity,
    statusTextColor: normalizeColor(
      options?.statusTextColor,
      DEFAULT_STYLE_OPTIONS.statusTextColor,
    ),
    statusActiveTextColor: normalizeColor(
      options?.statusActiveTextColor,
      DEFAULT_STYLE_OPTIONS.statusActiveTextColor,
    ),
    statusCompleteTextColor: normalizeColor(
      options?.statusCompleteTextColor,
      DEFAULT_STYLE_OPTIONS.statusCompleteTextColor,
    ),
  };
}

export function ensurePaneSearchUiStyles(doc: Document): void {
  if (doc.querySelector(`style[${STYLE_MARKER}="1"]`)) return;
  const style = doc.createElement("style");
  style.setAttribute(STYLE_MARKER, "1");
  style.textContent = STYLE_TEXT;
  doc.head.appendChild(style);
}

export function applySearchUiStyleOptions(
  root: HTMLElement,
  options: Readonly<Required<ResttyPaneSearchUiStyleOptions>>,
): void {
  root.classList.add(ROOT_CLASS);
  root.style.setProperty("--restty-search-ui-top", `${options.offsetTopPx}px`);
  root.style.setProperty("--restty-search-ui-right", `${options.offsetRightPx}px`);
  root.style.setProperty("--restty-search-ui-min-width", `${options.minWidthPx}px`);
  root.style.setProperty("--restty-search-ui-max-width", `${options.maxWidthPx}px`);
  root.style.setProperty("--restty-search-ui-z-index", `${options.zIndex}`);
  root.style.setProperty("--restty-search-ui-radius", `${options.borderRadiusPx}px`);
  root.style.setProperty("--restty-search-ui-blur", `${options.backdropBlurPx}px`);
  root.style.setProperty("--restty-search-ui-background", options.panelBackground);
  root.style.setProperty("--restty-search-ui-border", options.panelBorderColor);
  root.style.setProperty("--restty-search-ui-text", options.panelTextColor);
  root.style.setProperty("--restty-search-ui-shadow", options.panelShadow);
  root.style.setProperty("--restty-search-ui-input-background", options.inputBackground);
  root.style.setProperty("--restty-search-ui-input-text", options.inputTextColor);
  root.style.setProperty("--restty-search-ui-input-placeholder", options.inputPlaceholderColor);
  root.style.setProperty("--restty-search-ui-button-background", options.buttonBackground);
  root.style.setProperty("--restty-search-ui-button-text", options.buttonTextColor);
  root.style.setProperty("--restty-search-ui-button-hover", options.buttonHoverBackground);
  root.style.setProperty(
    "--restty-search-ui-button-disabled-opacity",
    options.buttonDisabledOpacity.toFixed(3),
  );
  root.style.setProperty("--restty-search-ui-status", options.statusTextColor);
  root.style.setProperty("--restty-search-ui-status-active", options.statusActiveTextColor);
  root.style.setProperty("--restty-search-ui-status-complete", options.statusCompleteTextColor);
}

export function clearSearchUiStyleOptions(root: HTMLElement): void {
  root.classList.remove(ROOT_CLASS);
  root.style.removeProperty("--restty-search-ui-top");
  root.style.removeProperty("--restty-search-ui-right");
  root.style.removeProperty("--restty-search-ui-min-width");
  root.style.removeProperty("--restty-search-ui-max-width");
  root.style.removeProperty("--restty-search-ui-z-index");
  root.style.removeProperty("--restty-search-ui-radius");
  root.style.removeProperty("--restty-search-ui-blur");
  root.style.removeProperty("--restty-search-ui-background");
  root.style.removeProperty("--restty-search-ui-border");
  root.style.removeProperty("--restty-search-ui-text");
  root.style.removeProperty("--restty-search-ui-shadow");
  root.style.removeProperty("--restty-search-ui-input-background");
  root.style.removeProperty("--restty-search-ui-input-text");
  root.style.removeProperty("--restty-search-ui-input-placeholder");
  root.style.removeProperty("--restty-search-ui-button-background");
  root.style.removeProperty("--restty-search-ui-button-text");
  root.style.removeProperty("--restty-search-ui-button-hover");
  root.style.removeProperty("--restty-search-ui-button-disabled-opacity");
  root.style.removeProperty("--restty-search-ui-status");
  root.style.removeProperty("--restty-search-ui-status-active");
  root.style.removeProperty("--restty-search-ui-status-complete");
}

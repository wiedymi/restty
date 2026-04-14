import { getConnectionBackendForValue } from "../../../../lib/connection-state.ts";
import type {
  ActivePaneAppearanceStateDetail,
  ActivePaneStateDetail,
  ConnectionStateDetail,
} from "../../../../lib/shell-events.ts";
import { shellState, type PlaygroundShellState } from "./shell-state.ts";

function updateShellDomain<K extends keyof PlaygroundShellState>(
  key: K,
  update: (state: PlaygroundShellState[K]) => PlaygroundShellState[K],
) {
  shellState.update((state) => ({
    ...state,
    [key]: update(state[key]),
  }));
}

export function applyConnectionShellState(detail: ConnectionStateDetail) {
  updateShellDomain("connection", (state) => ({
    ...state,
    backend:
      typeof detail.backend === "string"
        ? getConnectionBackendForValue(detail.backend)
        : state.backend,
    ptyUrl: typeof detail.ptyUrl === "string" ? detail.ptyUrl : state.ptyUrl,
    ptyButtonLabel:
      typeof detail.ptyButtonLabel === "string" ? detail.ptyButtonLabel : state.ptyButtonLabel,
    webContainerCommand:
      typeof detail.webContainerCommand === "string"
        ? detail.webContainerCommand
        : state.webContainerCommand,
    webContainerCwd:
      typeof detail.webContainerCwd === "string" ? detail.webContainerCwd : state.webContainerCwd,
  }));
}

export function applyAppearanceShellState(detail: ActivePaneAppearanceStateDetail) {
  updateShellDomain("appearance", (state) => ({
    ...state,
    fontFamily: typeof detail.fontFamily === "string" ? detail.fontFamily : state.fontFamily,
    mouseMode: typeof detail.mouseMode === "string" ? detail.mouseMode : state.mouseMode,
    shaderPreset:
      typeof detail.shaderPreset === "string" ? detail.shaderPreset : state.shaderPreset,
    themeSelectValue:
      typeof detail.themeSelectValue === "string"
        ? detail.themeSelectValue
        : state.themeSelectValue,
    ligatures:
      typeof detail.fontRendering?.ligatures === "string"
        ? detail.fontRendering.ligatures
        : state.ligatures,
    fontHinting:
      typeof detail.fontRendering?.fontHinting === "string"
        ? detail.fontRendering.fontHinting
        : state.fontHinting,
    fontHintTarget:
      typeof detail.fontRendering?.fontHintTarget === "string"
        ? detail.fontRendering.fontHintTarget
        : state.fontHintTarget,
    localFontValue:
      typeof detail.localFont?.value === "string" ? detail.localFont.value : state.localFontValue,
    localFontHintText:
      typeof detail.localFont?.hintText === "string"
        ? detail.localFont.hintText
        : state.localFontHintText,
    localFontSelectDisabled:
      typeof detail.localFont?.selectDisabled === "boolean"
        ? detail.localFont.selectDisabled
        : state.localFontSelectDisabled,
    loadLocalFontsDisabled:
      typeof detail.localFont?.loadDisabled === "boolean"
        ? detail.localFont.loadDisabled
        : state.loadLocalFontsDisabled,
    localFontOptions: Array.isArray(detail.localFont?.options)
      ? detail.localFont.options
      : state.localFontOptions,
  }));
}

export function applyActivePaneShellState(detail: ActivePaneStateDetail) {
  if (detail.terminal) {
    updateShellDomain("terminal", (state) => ({
      pauseLabel:
        typeof detail.terminal?.pauseLabel === "string"
          ? detail.terminal.pauseLabel
          : state.pauseLabel,
      renderer:
        typeof detail.terminal?.renderer === "string" ? detail.terminal.renderer : state.renderer,
      fontSize:
        detail.terminal?.fontSize !== undefined && detail.terminal.fontSize !== null
          ? String(detail.terminal.fontSize)
          : state.fontSize,
    }));
  }
  if (detail.appearance) {
    applyAppearanceShellState(detail.appearance);
  }
}

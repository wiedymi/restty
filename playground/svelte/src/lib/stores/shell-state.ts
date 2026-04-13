import { writable } from "svelte/store";
import type { LocalFontOption } from "../../../../lib/font-controls.ts";
import { getConnectionBackendForValue } from "../../../../lib/pty-connection.ts";
import type { PlaygroundDemoKind } from "../../../../lib/demos.ts";
import {
  createInitialAppearanceShellValues,
  createInitialConnectionShellValues,
  DEFAULT_DEMO_KIND,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_RENDERER,
} from "../../../../lib/shell-defaults.ts";
import {
  ACTIVE_PANE_STATE_EVENT,
  CONNECTION_STATE_EVENT,
  PTY_BUTTON_STATE_EVENT,
  type ActivePaneAppearanceStateDetail,
  type ActivePaneStateDetail,
  type ConnectionStateDetail,
  type PtyButtonStateDetail,
} from "../../../../lib/shell-events.ts";

type TerminalShellState = {
  pauseLabel: string;
  renderer: string;
  fontSize: string;
};

type ConnectionShellState = {
  backend: string;
  ptyUrl: string;
  webContainerCommand: string;
  webContainerCwd: string;
  ptyButtonLabel: string;
};

type AppearanceShellState = {
  mouseMode: string;
  fontFamily: string;
  localFontHintText: string;
  localFontOptions: LocalFontOption[];
  localFontSelectDisabled: boolean;
  localFontValue: string;
  loadLocalFontsDisabled: boolean;
  ligatures: string;
  fontHinting: string;
  fontHintTarget: string;
  shaderPreset: string;
  themeSelectValue: string;
};

type DemoShellState = {
  kind: PlaygroundDemoKind;
};

type SettingsShellState = {
  open: boolean;
};

const initialTerminalShellState: TerminalShellState = {
  pauseLabel: "Pause",
  renderer: DEFAULT_TERMINAL_RENDERER,
  fontSize: String(DEFAULT_TERMINAL_FONT_SIZE),
};

const initialConnectionShellState: ConnectionShellState = {
  ...createInitialConnectionShellValues(),
  ptyButtonLabel: "Connect PTY",
};

const initialAppearanceShellState: AppearanceShellState = {
  ...createInitialAppearanceShellValues(),
};

const initialDemoShellState: DemoShellState = {
  kind: DEFAULT_DEMO_KIND,
};

const initialSettingsShellState: SettingsShellState = {
  open: false,
};

export const terminalShellState = writable<TerminalShellState>(initialTerminalShellState);
export const connectionShellState = writable<ConnectionShellState>(initialConnectionShellState);
export const appearanceShellState = writable<AppearanceShellState>(initialAppearanceShellState);
export const demoShellState = writable<DemoShellState>(initialDemoShellState);
export const settingsShellState = writable<SettingsShellState>(initialSettingsShellState);

export function resetShellState() {
  terminalShellState.set(initialTerminalShellState);
  connectionShellState.set(initialConnectionShellState);
  appearanceShellState.set(initialAppearanceShellState);
  demoShellState.set(initialDemoShellState);
  settingsShellState.set(initialSettingsShellState);
}

export function startShellStateBridge(target: EventTarget = window) {
  const handlePtyButtonState: EventListener = (event) => {
    const detail = (event as CustomEvent<PtyButtonStateDetail>).detail;
    if (typeof detail?.label !== "string") return;
    connectionShellState.update((state) => ({
      ...state,
      ptyButtonLabel: detail.label!,
    }));
  };

  const handleConnectionState: EventListener = (event) => {
    const detail = (event as CustomEvent<ConnectionStateDetail>).detail;
    if (!detail) return;
    connectionShellState.update((state) => ({
      ...state,
      backend:
        typeof detail.backend === "string"
          ? getConnectionBackendForValue(detail.backend)
          : state.backend,
      ptyUrl: typeof detail.ptyUrl === "string" ? detail.ptyUrl : state.ptyUrl,
      webContainerCommand:
        typeof detail.webContainerCommand === "string"
          ? detail.webContainerCommand
          : state.webContainerCommand,
      webContainerCwd:
        typeof detail.webContainerCwd === "string" ? detail.webContainerCwd : state.webContainerCwd,
    }));
  };

  const applyAppearanceState = (detail: ActivePaneAppearanceStateDetail) => {
    appearanceShellState.update((state) => ({
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
  };

  const handleActivePaneState: EventListener = (event) => {
    const detail = (event as CustomEvent<ActivePaneStateDetail>).detail;
    if (!detail) return;
    if (detail.terminal) {
      terminalShellState.update((state) => ({
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
      applyAppearanceState(detail.appearance);
    }
  };

  target.addEventListener(ACTIVE_PANE_STATE_EVENT, handleActivePaneState);
  target.addEventListener(PTY_BUTTON_STATE_EVENT, handlePtyButtonState);
  target.addEventListener(CONNECTION_STATE_EVENT, handleConnectionState);

  return () => {
    target.removeEventListener(ACTIVE_PANE_STATE_EVENT, handleActivePaneState);
    target.removeEventListener(PTY_BUTTON_STATE_EVENT, handlePtyButtonState);
    target.removeEventListener(CONNECTION_STATE_EVENT, handleConnectionState);
  };
}

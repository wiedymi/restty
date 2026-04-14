import { derived, writable } from "svelte/store";
import type { LocalFontOption } from "../../../../lib/font-controls.ts";
import { getConnectionBackendForValue } from "../../../../lib/pty-connection.ts";
import { listenActivePaneState, listenConnectionState } from "../../../../lib/shell-bridge.ts";
import type { PlaygroundDemoKind } from "../../../../lib/demos.ts";
import {
  createInitialAppearanceShellValues,
  createInitialConnectionShellValues,
  DEFAULT_DEMO_KIND,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_RENDERER,
} from "../../../../lib/shell-defaults.ts";
import type {
  ActivePaneAppearanceStateDetail,
  ActivePaneStateDetail,
  ConnectionStateDetail,
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

export type PlaygroundShellState = {
  terminal: TerminalShellState;
  connection: ConnectionShellState;
  appearance: AppearanceShellState;
  demo: DemoShellState;
  settings: SettingsShellState;
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

function createInitialShellState(): PlaygroundShellState {
  return {
    terminal: { ...initialTerminalShellState },
    connection: { ...initialConnectionShellState },
    appearance: {
      ...initialAppearanceShellState,
      localFontOptions: [...initialAppearanceShellState.localFontOptions],
    },
    demo: { ...initialDemoShellState },
    settings: { ...initialSettingsShellState },
  };
}

export const shellState = writable<PlaygroundShellState>(createInitialShellState());
export const terminalShellState = derived(shellState, ($state) => $state.terminal);
export const connectionShellState = derived(shellState, ($state) => $state.connection);
export const appearanceShellState = derived(shellState, ($state) => $state.appearance);
export const demoShellState = derived(shellState, ($state) => $state.demo);
export const settingsShellState = derived(shellState, ($state) => $state.settings);

function updateShellDomain<K extends keyof PlaygroundShellState>(
  key: K,
  update: (state: PlaygroundShellState[K]) => PlaygroundShellState[K],
) {
  shellState.update((state) => ({
    ...state,
    [key]: update(state[key]),
  }));
}

export function setDemoShellKind(kind: PlaygroundDemoKind) {
  updateShellDomain("demo", (state) => ({
    ...state,
    kind,
  }));
}

export function setSettingsOpen(open: boolean) {
  updateShellDomain("settings", (state) => ({
    ...state,
    open,
  }));
}

export function resetShellState() {
  shellState.set(createInitialShellState());
}

export function startShellStateBridge(target: EventTarget = window) {
  const stopConnectionState = listenConnectionState(target, (detail: ConnectionStateDetail) => {
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
  });

  const applyAppearanceState = (detail: ActivePaneAppearanceStateDetail) => {
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
  };

  const stopActivePaneState = listenActivePaneState(target, (detail: ActivePaneStateDetail) => {
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
      applyAppearanceState(detail.appearance);
    }
  });

  return () => {
    stopActivePaneState();
    stopConnectionState();
  };
}

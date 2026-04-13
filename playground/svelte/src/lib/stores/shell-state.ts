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
  CONNECTION_STATE_EVENT,
  FONT_FAMILY_STATE_EVENT,
  FONT_RENDERING_STATE_EVENT,
  LOCAL_FONT_STATE_EVENT,
  MOUSE_MODE_STATE_EVENT,
  PTY_BUTTON_STATE_EVENT,
  SHADER_PRESET_STATE_EVENT,
  TERMINAL_STATE_EVENT,
  THEME_SELECT_STATE_EVENT,
  type ConnectionStateDetail,
  type FontRenderingStateDetail,
  type LocalFontStateDetail,
  type PtyButtonStateDetail,
  type ShellStringValueDetail,
  type TerminalStateDetail,
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
  const handleTerminalState: EventListener = (event) => {
    const detail = (event as CustomEvent<TerminalStateDetail>).detail;
    if (!detail) return;
    terminalShellState.update((state) => ({
      pauseLabel: typeof detail.pauseLabel === "string" ? detail.pauseLabel : state.pauseLabel,
      renderer: typeof detail.renderer === "string" ? detail.renderer : state.renderer,
      fontSize:
        detail.fontSize !== undefined && detail.fontSize !== null
          ? String(detail.fontSize)
          : state.fontSize,
    }));
  };

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

  const handleFontRenderingState: EventListener = (event) => {
    const detail = (event as CustomEvent<FontRenderingStateDetail>).detail;
    if (!detail) return;
    appearanceShellState.update((state) => ({
      ...state,
      ligatures: typeof detail.ligatures === "string" ? detail.ligatures : state.ligatures,
      fontHinting: typeof detail.fontHinting === "string" ? detail.fontHinting : state.fontHinting,
      fontHintTarget:
        typeof detail.fontHintTarget === "string" ? detail.fontHintTarget : state.fontHintTarget,
    }));
  };

  const handleStringValue =
    <K extends keyof AppearanceShellState>(key: K): EventListener =>
    (event) => {
      const detail = (event as CustomEvent<ShellStringValueDetail>).detail;
      if (typeof detail?.value !== "string") return;
      appearanceShellState.update((state) => ({
        ...state,
        [key]: detail.value!,
      }));
    };

  const handleLocalFontState: EventListener = (event) => {
    const detail = (event as CustomEvent<LocalFontStateDetail>).detail;
    if (!detail) return;
    appearanceShellState.update((state) => ({
      ...state,
      localFontValue: typeof detail.value === "string" ? detail.value : state.localFontValue,
      localFontHintText:
        typeof detail.hintText === "string" ? detail.hintText : state.localFontHintText,
      localFontSelectDisabled:
        typeof detail.selectDisabled === "boolean"
          ? detail.selectDisabled
          : state.localFontSelectDisabled,
      loadLocalFontsDisabled:
        typeof detail.loadDisabled === "boolean"
          ? detail.loadDisabled
          : state.loadLocalFontsDisabled,
      localFontOptions: Array.isArray(detail.options) ? detail.options : state.localFontOptions,
    }));
  };

  const handleMouseModeState = handleStringValue("mouseMode");
  const handleShaderPresetState = handleStringValue("shaderPreset");
  const handleThemeSelectState = handleStringValue("themeSelectValue");
  const handleFontFamilyState = handleStringValue("fontFamily");

  target.addEventListener(TERMINAL_STATE_EVENT, handleTerminalState);
  target.addEventListener(PTY_BUTTON_STATE_EVENT, handlePtyButtonState);
  target.addEventListener(CONNECTION_STATE_EVENT, handleConnectionState);
  target.addEventListener(FONT_RENDERING_STATE_EVENT, handleFontRenderingState);
  target.addEventListener(MOUSE_MODE_STATE_EVENT, handleMouseModeState);
  target.addEventListener(SHADER_PRESET_STATE_EVENT, handleShaderPresetState);
  target.addEventListener(THEME_SELECT_STATE_EVENT, handleThemeSelectState);
  target.addEventListener(FONT_FAMILY_STATE_EVENT, handleFontFamilyState);
  target.addEventListener(LOCAL_FONT_STATE_EVENT, handleLocalFontState);

  return () => {
    target.removeEventListener(TERMINAL_STATE_EVENT, handleTerminalState);
    target.removeEventListener(PTY_BUTTON_STATE_EVENT, handlePtyButtonState);
    target.removeEventListener(CONNECTION_STATE_EVENT, handleConnectionState);
    target.removeEventListener(FONT_RENDERING_STATE_EVENT, handleFontRenderingState);
    target.removeEventListener(MOUSE_MODE_STATE_EVENT, handleMouseModeState);
    target.removeEventListener(SHADER_PRESET_STATE_EVENT, handleShaderPresetState);
    target.removeEventListener(THEME_SELECT_STATE_EVENT, handleThemeSelectState);
    target.removeEventListener(FONT_FAMILY_STATE_EVENT, handleFontFamilyState);
    target.removeEventListener(LOCAL_FONT_STATE_EVENT, handleLocalFontState);
  };
}

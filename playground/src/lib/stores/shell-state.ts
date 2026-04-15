import { derived, writable } from "svelte/store";
import type { LocalFontOption } from "../../../lib/font-local-picker.ts";
import type { PlaygroundDemoKind } from "../../../lib/demos.ts";
import {
  createInitialAppearanceShellValues,
  createInitialConnectionShellValues,
  DEFAULT_DEMO_KIND,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_RENDERER,
} from "../../../lib/shell-defaults.ts";

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

export type PlaygroundShellState = {
  terminal: TerminalShellState;
  connection: ConnectionShellState;
  appearance: AppearanceShellState;
  demo: DemoShellState;
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

function createInitialShellState(): PlaygroundShellState {
  return {
    terminal: { ...initialTerminalShellState },
    connection: { ...initialConnectionShellState },
    appearance: {
      ...initialAppearanceShellState,
      localFontOptions: [...initialAppearanceShellState.localFontOptions],
    },
    demo: { ...initialDemoShellState },
  };
}

export const shellState = writable<PlaygroundShellState>(createInitialShellState());
export const terminalShellState = derived(shellState, ($state) => $state.terminal);
export const connectionShellState = derived(shellState, ($state) => $state.connection);
export const appearanceShellState = derived(shellState, ($state) => $state.appearance);
export const demoShellState = derived(shellState, ($state) => $state.demo);

export function setDemoShellKind(kind: PlaygroundDemoKind) {
  shellState.update((state) => ({
    ...state,
    demo: {
      ...state.demo,
      kind,
    },
  }));
}

export function resetShellState() {
  shellState.set(createInitialShellState());
}

import { createPaneAppearanceShellEvents } from "./pane-appearance-shell-events.ts";
import { createPaneConnectionShellEvents } from "./pane-connection-shell-events.ts";
import type { FontHintTarget } from "./font-controls.ts";
import type { LocalFontOption } from "./font-local-picker.ts";
import type { PaneState } from "./pane-state.ts";
import { createPaneTerminalShellEvents } from "./pane-terminal-shell-events.ts";
import type { PaneShellSyncPane } from "./pane-shell-sync.types.ts";
import type { ConnectionBackend } from "./pty-connection.ts";
import type { ShaderPreset } from "./shader-presets.ts";
import { dispatchActivePaneState } from "./shell-bridge.ts";

type CreatePaneShellSyncOptions = {
  target: EventTarget;
  getSelectedConnectionBackend: () => ConnectionBackend;
  getSelectedFontFamily: () => string;
  getSelectedLocalFontMatcher: () => string;
  getDetectedLocalFontOptions: () => LocalFontOption[];
  getLocalFontHintText: () => string;
  getSelectedLigatures: () => boolean;
  getSelectedFontHinting: () => boolean;
  getSelectedFontHintTarget: () => FontHintTarget;
  getSelectedShaderPreset: () => ShaderPreset;
  syncSelectedDefaults: (state: PaneState) => void;
};

export function createPaneShellSync(options: CreatePaneShellSyncOptions) {
  const terminalEvents = createPaneTerminalShellEvents({
    target: options.target,
  });

  const appearanceEvents = createPaneAppearanceShellEvents({
    target: options.target,
    getSelectedFontFamily: options.getSelectedFontFamily,
    getSelectedLocalFontMatcher: options.getSelectedLocalFontMatcher,
    getDetectedLocalFontOptions: options.getDetectedLocalFontOptions,
    getLocalFontHintText: options.getLocalFontHintText,
    getSelectedLigatures: options.getSelectedLigatures,
    getSelectedFontHinting: options.getSelectedFontHinting,
    getSelectedFontHintTarget: options.getSelectedFontHintTarget,
    getSelectedShaderPreset: options.getSelectedShaderPreset,
  });

  const connectionEvents = createPaneConnectionShellEvents({
    target: options.target,
    getSelectedConnectionBackend: options.getSelectedConnectionBackend,
  });

  function renderActivePaneControls(pane: PaneShellSyncPane, state: PaneState) {
    options.syncSelectedDefaults(state);
    state.mouseMode = pane.runtime.interaction.getMouseStatus().mode;
    dispatchActivePaneState(
      {
        terminal: terminalEvents.buildTerminalState(state),
        appearance: appearanceEvents.buildAppearanceState(state),
      },
      options.target,
    );
  }

  return {
    renderActivePaneControls,
    syncFontFamilyValue: appearanceEvents.syncFontFamilyValue,
    syncFontRenderingControls: appearanceEvents.syncFontRenderingControls,
    syncLocalFontControls: appearanceEvents.syncLocalFontControls,
    syncMouseModeValue: appearanceEvents.syncMouseModeValue,
    syncPauseButton: terminalEvents.syncPauseButton,
    syncPtyButton: connectionEvents.syncPtyButton,
    syncShaderPresetValue: appearanceEvents.syncShaderPresetValue,
    syncTerminalControlValues: terminalEvents.syncTerminalControlValues,
    syncThemeSelectValue: appearanceEvents.syncThemeSelectValue,
  };
}

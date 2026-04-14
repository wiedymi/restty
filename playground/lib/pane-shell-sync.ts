import { createPaneAppearanceShellSync } from "./pane-appearance-shell-sync.ts";
import { createPaneConnectionShellSync } from "./pane-connection-shell-sync.ts";
import type { FontHintTarget, LocalFontOption } from "./font-controls.ts";
import type { PaneState } from "./pane-state.ts";
import { createPaneTerminalShellSync } from "./pane-terminal-shell-sync.ts";
import type { PaneShellSyncElements, PaneShellSyncPane } from "./pane-shell-sync.types.ts";
import type { ConnectionBackend } from "./pty-connection.ts";
import type { ShaderPreset } from "./shader-presets.ts";
import { dispatchActivePaneState } from "./shell-bridge.ts";

type CreatePaneShellSyncOptions = {
  usesSvelteShell: boolean;
  target?: EventTarget;
  elements: PaneShellSyncElements;
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
  const terminalSync = createPaneTerminalShellSync({
    usesSvelteShell: options.usesSvelteShell,
    target: options.target,
    elements: {
      btnPause: options.elements.btnPause,
      rendererSelect: options.elements.rendererSelect,
      fontSizeInput: options.elements.fontSizeInput,
    },
  });

  const appearanceSync = createPaneAppearanceShellSync({
    usesSvelteShell: options.usesSvelteShell,
    target: options.target,
    elements: {
      themeSelect: options.elements.themeSelect,
      fontFamilySelect: options.elements.fontFamilySelect,
      fontFamilyLocalSelect: options.elements.fontFamilyLocalSelect,
      btnLoadLocalFonts: options.elements.btnLoadLocalFonts,
      fontFamilyHintEl: options.elements.fontFamilyHintEl,
      ligaturesSelect: options.elements.ligaturesSelect,
      fontHintingSelect: options.elements.fontHintingSelect,
      fontHintTargetSelect: options.elements.fontHintTargetSelect,
      mouseModeEl: options.elements.mouseModeEl,
      shaderPresetEl: options.elements.shaderPresetEl,
    },
    getSelectedFontFamily: options.getSelectedFontFamily,
    getSelectedLocalFontMatcher: options.getSelectedLocalFontMatcher,
    getDetectedLocalFontOptions: options.getDetectedLocalFontOptions,
    getLocalFontHintText: options.getLocalFontHintText,
    getSelectedLigatures: options.getSelectedLigatures,
    getSelectedFontHinting: options.getSelectedFontHinting,
    getSelectedFontHintTarget: options.getSelectedFontHintTarget,
    getSelectedShaderPreset: options.getSelectedShaderPreset,
  });

  const connectionSync = createPaneConnectionShellSync({
    usesSvelteShell: options.usesSvelteShell,
    target: options.target,
    elements: {
      ptyBtn: options.elements.ptyBtn,
    },
    getSelectedConnectionBackend: options.getSelectedConnectionBackend,
  });

  function renderActivePaneControls(pane: PaneShellSyncPane, state: PaneState) {
    options.syncSelectedDefaults(state);
    state.mouseMode = pane.runtime.interaction.getMouseStatus().mode;
    if (options.usesSvelteShell) {
      if (!options.target) return;
      dispatchActivePaneState(
        {
          terminal: terminalSync.buildTerminalState(state),
          appearance: appearanceSync.buildAppearanceState(state),
        },
        options.target,
      );
      return;
    }
    terminalSync.syncTerminalControlValues(state);
    appearanceSync.syncFontFamilyValue();
    appearanceSync.syncLocalFontControls();
    appearanceSync.syncFontRenderingControls();
    appearanceSync.syncMouseModeValue(state.mouseMode);
    appearanceSync.syncShaderPresetValue();
    appearanceSync.syncThemeSelectValue(state.theme.selectValue);
  }

  return {
    renderActivePaneControls,
    syncFontFamilyValue: appearanceSync.syncFontFamilyValue,
    syncFontRenderingControls: appearanceSync.syncFontRenderingControls,
    syncLocalFontControls: appearanceSync.syncLocalFontControls,
    syncMouseModeValue: appearanceSync.syncMouseModeValue,
    syncPauseButton: terminalSync.syncPauseButton,
    syncPtyButton: connectionSync.syncPtyButton,
    syncShaderPresetValue: appearanceSync.syncShaderPresetValue,
    syncTerminalControlValues: terminalSync.syncTerminalControlValues,
    syncThemeSelectValue: appearanceSync.syncThemeSelectValue,
  };
}

import { runActivePaneDemo } from "./demos.ts";
import {
  bindAppearanceShellEffects,
  bindConnectionShellEffects,
  bindTerminalShellEffects,
} from "./control-shell-effects.ts";
import { bindSettingsShellEffects } from "./settings-shell-effects.ts";
import type { WirePlaygroundControlsOptions } from "./playground-wiring.types.ts";

export function wirePlaygroundControls({
  restty,
  window,
  shell: {
    openSettings,
    closeSettings,
    syncConnectionState,
    paneShellSync,
    getConnectionShellStateDetail,
  },
  controllers: { paneLifecycle, appearanceController, connectionController },
  state: { paneStates, getActivePaneId },
}: WirePlaygroundControlsOptions): void {
  bindSettingsShellEffects({
    target: window,
    onOpen: () => {
      openSettings(restty);
    },
    onClose: () => {
      closeSettings(restty);
    },
  });

  bindConnectionShellEffects({
    target: window,
    onBackendChange: (value) => {
      connectionController.applyConnectionBackend(value);
    },
    onPtyUrlChange: (value) => {
      connectionController.setPtyUrl(value);
    },
    onWebContainerCommandChange: (value) => {
      connectionController.setWebContainerCommand(value);
    },
    onWebContainerCwdChange: (value) => {
      connectionController.setWebContainerCwd(value);
    },
  });

  bindTerminalShellEffects({
    target: window,
    onClear: () => {
      paneLifecycle.handleTerminalClear();
    },
    onDemoRun: (kind) => {
      runActivePaneDemo(paneStates, getActivePaneId(), kind);
    },
    onFontSizeChange: (value) => {
      appearanceController.applyFontSizeValue(value);
    },
    onInit: () => {
      paneLifecycle.handleTerminalInit();
    },
    onPauseToggle: () => {
      paneLifecycle.handleTerminalPauseToggle();
    },
    onPtyButton: () => {
      paneLifecycle.handlePtyButtonClick();
    },
    onRendererChange: (value) => {
      appearanceController.applyRendererChoice(value);
    },
  });

  bindAppearanceShellEffects({
    target: window,
    onFontFamilyChange: (value) => appearanceController.applyFontFamilySelection(value),
    onFontFamilyLocalChange: (value) => appearanceController.applyLocalFontSelection(value),
    onFontHintTargetChange: (value) => {
      appearanceController.applyFontHintTargetChange(value);
    },
    onFontHintingChange: (value) => {
      appearanceController.applyFontHintingChange(value);
    },
    onLigaturesChange: (value) => {
      appearanceController.applyLigaturesChange(value);
    },
    onLoadLocalFonts: () => appearanceController.loadLocalFonts(),
    onMouseModeChange: (value) => {
      appearanceController.applyMouseMode(value);
    },
    onShaderPresetChange: (value) => {
      appearanceController.applySelectedShaderPreset(value);
    },
    onThemeFileChange: (file) => appearanceController.applyUploadedThemeFile(file),
    onThemeSelectChange: (value) => {
      appearanceController.applyThemeSelection(value);
    },
  });

  syncConnectionState(getConnectionShellStateDetail());
  paneShellSync.syncFontFamilyValue();
  paneShellSync.syncLocalFontControls();
  paneShellSync.syncFontRenderingControls();
}

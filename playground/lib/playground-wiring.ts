import { Restty } from "../../src/index.ts";
import { runActivePaneDemo } from "./demos.ts";
import {
  bindAppearanceControls,
  bindConnectionControls,
  bindTerminalControls,
} from "./control-bindings.ts";
import type { LegacyPlaygroundElements, SharedPlaygroundElements } from "./elements.ts";
import type { createPaneAppearanceController } from "./appearance-controller.ts";
import type { createConnectionController } from "./connection-controller.ts";
import type { createPaneLifecycleController } from "./pane-lifecycle.ts";
import type { createPaneShellSync } from "./pane-shell-sync.ts";
import type { createPlaygroundShellAdapter } from "./shell-adapter.ts";
import { bindSettingsControls } from "./settings-bindings.ts";
import type { PaneState } from "./pane-state.ts";

type PlaygroundWindow = Window & typeof globalThis;

type PlaygroundControlShell = {
  shellAdapter: ReturnType<typeof createPlaygroundShellAdapter>;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
  getConnectionShellStateDetail: () => {
    backend: string;
    ptyUrl: string;
    ptyButtonLabel: string;
    webContainerCommand: string;
    webContainerCwd: string;
  };
};

type PlaygroundControlControllers = {
  paneLifecycle: ReturnType<typeof createPaneLifecycleController>;
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
  connectionController: ReturnType<typeof createConnectionController>;
};

type PlaygroundControlState = {
  paneStates: Map<number, PaneState>;
  getActivePaneId: () => number | null;
};

type WirePlaygroundControlsOptions = {
  restty: Restty;
  window: PlaygroundWindow;
  usesSvelteShell: boolean;
  sharedElements: SharedPlaygroundElements;
  legacyElements: LegacyPlaygroundElements;
  shell: PlaygroundControlShell;
  controllers: PlaygroundControlControllers;
  state: PlaygroundControlState;
};

export function wirePlaygroundControls({
  restty,
  window,
  usesSvelteShell,
  sharedElements: { settingsDialog },
  legacyElements: {
    btnInit,
    btnPause,
    btnClear,
    rendererSelect,
    demoSelect,
    btnRunDemo,
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
    ptyBtn,
    themeSelect,
    themeFileInput,
    fontSizeInput,
    fontFamilySelect,
    ligaturesSelect,
    fontHintingSelect,
    fontHintTargetSelect,
    fontFamilyLocalSelect,
    btnLoadLocalFonts,
    mouseModeEl,
    shaderPresetEl,
    settingsFab,
    settingsClose,
  },
  shell: { shellAdapter, paneShellSync, getConnectionShellStateDetail },
  controllers: { paneLifecycle, appearanceController, connectionController },
  state: { paneStates, getActivePaneId },
}: WirePlaygroundControlsOptions): void {
  bindSettingsControls({
    usesSvelteShell,
    target: window,
    settingsDialog,
    settingsFab,
    settingsClose,
    onOpen: () => {
      shellAdapter.openSettings(restty);
    },
    onClose: () => {
      shellAdapter.closeSettings(restty);
    },
  });

  bindConnectionControls({
    usesSvelteShell,
    target: window,
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
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

  bindTerminalControls({
    usesSvelteShell,
    target: window,
    btnClear,
    btnInit,
    btnPause,
    btnPty: ptyBtn,
    btnRunDemo,
    demoSelect,
    fontSizeInput,
    rendererSelect,
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

  bindAppearanceControls({
    usesSvelteShell,
    target: window,
    btnLoadLocalFonts,
    fontFamilyLocalSelect,
    fontFamilySelect,
    fontHintTargetSelect,
    fontHintingSelect,
    ligaturesSelect,
    mouseModeEl,
    shaderPresetEl,
    themeFileInput,
    themeSelect,
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

  shellAdapter.syncConnectionState(getConnectionShellStateDetail());
  paneShellSync.syncFontFamilyValue();
  paneShellSync.syncLocalFontControls();
  paneShellSync.syncFontRenderingControls();
}

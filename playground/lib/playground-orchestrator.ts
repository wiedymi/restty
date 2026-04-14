import { Restty, listBuiltinThemeNames } from "../../src/index.ts";
import type { LegacyPlaygroundElements, SharedPlaygroundElements } from "./elements.ts";
import { getConnectionBackend } from "./pty-connection.ts";
import { DEFAULT_CONNECTION_BACKEND } from "./shell-defaults.ts";
import { resolvePlaygroundStartupDefaults } from "./startup-defaults.ts";
import { bootstrapPlaygroundSurface } from "./surface-bootstrap.ts";
import { wirePlaygroundControls } from "./playground-wiring.ts";
import { createPlaygroundSession } from "./playground-session.ts";

type PlaygroundWindow = Window & typeof globalThis;

type BootstrapPlaygroundOrchestratorOptions = {
  window: PlaygroundWindow;
  usesSvelteShell: boolean;
  sharedElements: SharedPlaygroundElements;
  legacyElements: LegacyPlaygroundElements;
  notificationHost?: typeof Notification;
};

export function bootstrapPlaygroundOrchestrator({
  window,
  usesSvelteShell,
  sharedElements: { paneRoot, settingsDialog },
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
    connectionHintEl,
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
    fontFamilyHintEl,
    mouseModeEl,
    shaderPresetEl,
    settingsFab,
    settingsClose,
  },
  notificationHost = globalThis.Notification,
}: BootstrapPlaygroundOrchestratorOptions): Restty {
  let restty: Restty;

  const initialConnectionBackend = usesSvelteShell
    ? DEFAULT_CONNECTION_BACKEND
    : getConnectionBackend(connectionBackendEl);
  const builtinThemeNames = listBuiltinThemeNames();
  const {
    initialPtyUrl,
    initialWebContainerCommand,
    initialWebContainerCwd,
    initialFontSize,
    defaultThemeName,
    appearanceInitialState,
  } = resolvePlaygroundStartupDefaults({
    usesSvelteShell,
    shaderPresetValue: shaderPresetEl?.value,
    ptyUrlValue: ptyUrlInput?.value,
    webContainerCommandValue: wcCommandInput?.value,
    webContainerCwdValue: wcCwdInput?.value,
    rendererValue: rendererSelect?.value,
    fontSizeValue: fontSizeInput?.value,
    mouseModeValue: mouseModeEl?.value,
    fontFamilyValue: fontFamilySelect?.value,
    locationSearch: window.location.search,
    localFontPickerSupported:
      typeof window === "object" && window !== null && "queryLocalFonts" in window,
    builtinThemeNames,
  });

  const session = createPlaygroundSession({
    window,
    usesSvelteShell,
    getRestty: () => restty,
    initialConnectionBackend,
    initialPtyUrl,
    initialWebContainerCommand,
    initialWebContainerCwd,
    appearanceInitialState,
    notificationHost,
    elements: {
      btnPause,
      rendererSelect,
      fontSizeInput,
      ptyBtn,
      themeSelect,
      themeFileInput,
      fontFamilySelect,
      ligaturesSelect,
      fontHintingSelect,
      fontHintTargetSelect,
      fontFamilyLocalSelect,
      btnLoadLocalFonts,
      fontFamilyHintEl,
      mouseModeEl,
      shaderPresetEl,
      connectionBackendEl,
      ptyUrlInput,
      wcCommandInput,
      wcCwdInput,
      connectionHintEl,
      settingsDialog,
    },
  });

  restty = bootstrapPlaygroundSurface({
    root: paneRoot,
    target: window,
    initialFontSize,
    defaultThemeName,
    paneStates: session.state.paneStates,
    setActivePaneId: session.state.setActivePaneId,
    isSettingsDialogOpen: session.shell.shellAdapter.isSettingsDialogOpen,
    appearanceController: session.controllers.appearanceController,
    connectionController: session.controllers.connectionController,
    paneLifecycle: session.controllers.paneLifecycle,
    paneShellSync: session.shell.paneShellSync,
    onDesktopNotification: session.notifications.handleDesktopNotification,
  });

  wirePlaygroundControls({
    restty,
    window,
    usesSvelteShell,
    sharedElements: { paneRoot, settingsDialog },
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
      connectionHintEl,
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
      fontFamilyHintEl,
      mouseModeEl,
      shaderPresetEl,
      settingsFab,
      settingsClose,
    },
    shellAdapter: session.shell.shellAdapter,
    paneShellSync: session.shell.paneShellSync,
    paneLifecycle: session.controllers.paneLifecycle,
    appearanceController: session.controllers.appearanceController,
    connectionController: session.controllers.connectionController,
    paneStates: session.state.paneStates,
    getActivePaneId: session.state.getActivePaneId,
    getConnectionShellStateDetail: session.shell.getConnectionShellStateDetail,
  });

  return restty;
}

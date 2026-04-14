import { Restty, listBuiltinThemeNames } from "../../src/index.ts";
import type { PlaygroundElements } from "./elements.ts";
import { DEFAULT_CONNECTION_BACKEND } from "./shell-defaults.ts";
import { resolvePlaygroundStartupDefaults } from "./startup-defaults.ts";
import { bootstrapPlaygroundSurface } from "./surface-bootstrap.ts";
import { wirePlaygroundControls } from "./playground-wiring.ts";
import { createPlaygroundSession } from "./playground-session.ts";

type PlaygroundWindow = Window & typeof globalThis;

type BootstrapPlaygroundOrchestratorOptions = {
  window: PlaygroundWindow;
  elements: PlaygroundElements;
  notificationHost?: typeof Notification;
};

export function bootstrapPlaygroundOrchestrator({
  window,
  elements: { paneRoot },
  notificationHost = globalThis.Notification,
}: BootstrapPlaygroundOrchestratorOptions): Restty {
  let restty: Restty;

  const initialConnectionBackend = DEFAULT_CONNECTION_BACKEND;
  const builtinThemeNames = listBuiltinThemeNames();
  const {
    initialPtyUrl,
    initialWebContainerCommand,
    initialWebContainerCwd,
    initialFontSize,
    defaultThemeName,
    appearanceInitialState,
  } = resolvePlaygroundStartupDefaults({
    locationSearch: window.location.search,
    localFontPickerSupported:
      typeof window === "object" && window !== null && "queryLocalFonts" in window,
    builtinThemeNames,
  });

  const session = createPlaygroundSession({
    deps: {
      getRestty: () => restty,
      notificationHost,
    },
    startup: {
      initialConnectionBackend,
      initialPtyUrl,
      initialWebContainerCommand,
      initialWebContainerCwd,
      appearanceInitialState,
    },
    shell: {
      window,
    },
  });

  restty = bootstrapPlaygroundSurface({
    root: paneRoot,
    target: window,
    startup: {
      initialFontSize,
      defaultThemeName,
    },
    state: {
      paneStates: session.state.paneStates,
      setActivePaneId: session.state.setActivePaneId,
    },
    shell: {
      isSettingsDialogOpen: session.shell.isSettingsDialogOpen,
      paneShellSync: session.shell.paneShellSync,
    },
    controllers: {
      appearanceController: session.controllers.appearanceController,
      connectionController: session.controllers.connectionController,
      paneLifecycle: session.controllers.paneLifecycle,
    },
    onDesktopNotification: session.notifications.handleDesktopNotification,
  });

  wirePlaygroundControls({
    restty,
    window,
    shell: {
      publishConnectionState: session.shell.publishConnectionState,
      paneShellSync: session.shell.paneShellSync,
    },
    controllers: {
      paneLifecycle: session.controllers.paneLifecycle,
      appearanceController: session.controllers.appearanceController,
      connectionController: session.controllers.connectionController,
    },
    state: {
      paneStates: session.state.paneStates,
      getActivePaneId: session.state.getActivePaneId,
    },
  });

  return restty;
}

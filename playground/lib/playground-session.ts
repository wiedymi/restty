import { Restty } from "../../src/index.ts";
import { createConnectionController } from "./connection-controller.ts";
import { createDesktopNotificationHandler } from "./desktop-notifications.ts";
import { createPaneAppearanceController } from "./appearance-controller.ts";
import { createPaneLifecycleController } from "./pane-lifecycle.ts";
import {
  createPlaygroundSessionShell,
  type PlaygroundSessionShell,
} from "./playground-session-shell.ts";
import type { PlaygroundAppearanceInitialState } from "./startup-defaults.ts";
import type { PaneState } from "./pane-state.ts";

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;
type PlaygroundWindow = Window & typeof globalThis;

type PlaygroundSessionDeps = {
  getRestty: () => Restty;
  notificationHost?: typeof Notification;
};

type PlaygroundSessionStartup = {
  initialConnectionBackend: string;
  initialPtyUrl: string;
  initialWebContainerCommand: string;
  initialWebContainerCwd: string;
  appearanceInitialState: PlaygroundAppearanceInitialState;
};

type PlaygroundSessionShellConfig = {
  window: PlaygroundWindow;
  settingsDialog: HTMLDialogElement | null;
};

type CreatePlaygroundSessionOptions = {
  deps: PlaygroundSessionDeps;
  startup: PlaygroundSessionStartup;
  shell: PlaygroundSessionShellConfig;
};

export type PlaygroundSessionState = {
  paneStates: Map<number, PaneState>;
  getActivePaneId: () => number | null;
  setActivePaneId: (id: number | null) => void;
};

export type PlaygroundSessionControllers = {
  paneLifecycle: ReturnType<typeof createPaneLifecycleController>;
  connectionController: ReturnType<typeof createConnectionController>;
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
};

export type PlaygroundSessionNotifications = {
  handleDesktopNotification: ReturnType<typeof createDesktopNotificationHandler>;
};

export function createPlaygroundSession({
  deps: { getRestty, notificationHost = globalThis.Notification },
  startup: {
    initialConnectionBackend,
    initialPtyUrl,
    initialWebContainerCommand,
    initialWebContainerCwd,
    appearanceInitialState,
  },
  shell: { window, settingsDialog },
}: CreatePlaygroundSessionOptions) {
  const paneStates = new Map<number, PaneState>();
  let activePaneId: number | null = null;

  function waitForAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  function getActivePane(): ManagedPane | null {
    return getRestty().getActivePane();
  }

  let appearanceController: ReturnType<typeof createPaneAppearanceController>;
  let connectionController: ReturnType<typeof createConnectionController>;

  const handleDesktopNotification = createDesktopNotificationHandler({
    sink:
      typeof notificationHost === "undefined"
        ? null
        : {
            getPermission: () => notificationHost.permission,
            requestPermission: () => notificationHost.requestPermission(),
            notify: (title, options) => {
              const browserNotification = new notificationHost(title, options);
              void browserNotification;
            },
          },
  });

  const shell = createPlaygroundSessionShell({
    window,
    settingsDialog,
    getActivePane,
    getConnectionController: () => connectionController,
    getAppearanceController: () => appearanceController,
  });

  const paneLifecycle = createPaneLifecycleController({
    getPaneById: (id) => getRestty().getPaneById(id),
    getActivePane,
    getPaneState: (id) => paneStates.get(id),
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    getActivePaneId: () => activePaneId,
    getSelectedConnectionBackend: () => connectionController.getBackend(),
    getSelectedPtyUrl: () => connectionController.getPtyUrl(),
    syncPauseButton: (state) => {
      shell.paneShellSync.syncPauseButton(state);
    },
    syncPtyButton: (pane) => {
      shell.paneShellSync.syncPtyButton(pane);
    },
    waitForAnimationFrame,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
  });

  connectionController = createConnectionController({
    getActivePane,
    getPanes: () => getRestty().getPanes(),
    connectPaneIfNeeded: (pane) => paneLifecycle.connectPaneIfNeeded(pane),
    syncConnectionState: () => {
      shell.shellAdapter.syncConnectionState(shell.getConnectionShellStateDetail());
    },
    syncPtyButton: (pane) => {
      shell.paneShellSync.syncPtyButton(pane);
    },
    initialBackend: initialConnectionBackend,
    initialPtyUrl,
    initialWebContainerCommand,
    initialWebContainerCwd,
  });

  appearanceController = createPaneAppearanceController({
    host: {
      getPanes: () => getRestty().getPanes(),
      setFontSources: (sources) => getRestty().setFontSources(sources),
      setShaderStages: (stages) => getRestty().setShaderStages(stages),
    },
    getActivePane,
    getActivePaneState: () => {
      return activePaneId === null ? null : (paneStates.get(activePaneId) ?? null);
    },
    getActivePaneId: () => activePaneId,
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    shellSync: {
      syncFontFamilyValue: () => shell.paneShellSync.syncFontFamilyValue(),
      syncFontRenderingControls: () => shell.paneShellSync.syncFontRenderingControls(),
      syncLocalFontControls: () => shell.paneShellSync.syncLocalFontControls(),
      syncMouseModeValue: (value) => shell.paneShellSync.syncMouseModeValue(value),
      syncShaderPresetValue: (value) => shell.paneShellSync.syncShaderPresetValue(value),
      syncThemeSelectValue: (value) => shell.paneShellSync.syncThemeSelectValue(value),
    },
    onThemeFileReset: shell.shellAdapter.resetThemeFileInput,
    initialState: appearanceInitialState,
  });

  return {
    state: {
      paneStates,
      getActivePaneId: () => activePaneId,
      setActivePaneId: (id: number | null) => {
        activePaneId = id;
      },
    } satisfies PlaygroundSessionState,
    shell,
    controllers: {
      paneLifecycle,
      connectionController,
      appearanceController,
    } satisfies PlaygroundSessionControllers,
    notifications: {
      handleDesktopNotification,
    } satisfies PlaygroundSessionNotifications,
  };
}

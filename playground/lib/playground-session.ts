import { Restty } from "../../src/index.ts";
import { createDesktopNotificationHandler } from "./desktop-notifications.ts";
import {
  createPlaygroundSessionControllers,
  type PlaygroundSessionControllers,
} from "./playground-session-controllers.ts";
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

  function getActivePane(): ManagedPane | null {
    return getRestty().getActivePane();
  }

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

  let connectionController: PlaygroundSessionControllers["connectionController"];
  let appearanceController: PlaygroundSessionControllers["appearanceController"];

  const shell = createPlaygroundSessionShell({
    window,
    settingsDialog,
    getActivePane,
    getConnectionController: () => connectionController,
    getAppearanceController: () => appearanceController,
  });

  const controllers = createPlaygroundSessionControllers({
    getRestty,
    getActivePane,
    getActivePaneId: () => activePaneId,
    paneStates,
    window,
    shell,
    startup: {
      initialConnectionBackend,
      initialPtyUrl,
      initialWebContainerCommand,
      initialWebContainerCwd,
      appearanceInitialState,
    },
  });
  connectionController = controllers.connectionController;
  appearanceController = controllers.appearanceController;

  return {
    state: {
      paneStates,
      getActivePaneId: () => activePaneId,
      setActivePaneId: (id: number | null) => {
        activePaneId = id;
      },
    } satisfies PlaygroundSessionState,
    shell,
    controllers,
    notifications: {
      handleDesktopNotification,
    } satisfies PlaygroundSessionNotifications,
  };
}

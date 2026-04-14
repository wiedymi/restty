import { Restty } from "../../src/index.ts";
import { createConnectionController } from "./connection-controller.ts";
import { createDesktopNotificationHandler } from "./desktop-notifications.ts";
import { createPaneAppearanceController } from "./appearance-controller.ts";
import { createPaneLifecycleController } from "./pane-lifecycle.ts";
import { createPaneShellSync } from "./pane-shell-sync.ts";
import { createPlaygroundShellAdapter } from "./shell-adapter.ts";
import type { PlaygroundElements } from "./elements.ts";
import type { ConnectionStateDetail } from "./shell-events.ts";
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
  elements: Pick<
    PlaygroundElements,
    | "btnPause"
    | "rendererSelect"
    | "fontSizeInput"
    | "ptyBtn"
    | "themeSelect"
    | "fontFamilySelect"
    | "ligaturesSelect"
    | "fontHintingSelect"
    | "fontHintTargetSelect"
    | "fontFamilyLocalSelect"
    | "btnLoadLocalFonts"
    | "fontFamilyHintEl"
    | "mouseModeEl"
    | "shaderPresetEl"
  > & {
    settingsDialog: HTMLDialogElement | null;
  };
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

export type PlaygroundSessionShell = {
  shellAdapter: ReturnType<typeof createPlaygroundShellAdapter>;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
  getConnectionShellStateDetail: () => ConnectionStateDetail;
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
  shell: {
    window,
    elements: {
      btnPause,
      rendererSelect,
      fontSizeInput,
      ptyBtn,
      themeSelect,
      fontFamilySelect,
      ligaturesSelect,
      fontHintingSelect,
      fontHintTargetSelect,
      fontFamilyLocalSelect,
      btnLoadLocalFonts,
      fontFamilyHintEl,
      mouseModeEl,
      shaderPresetEl,
      settingsDialog,
    },
  },
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

  function getPtyButtonLabel() {
    const pane = getActivePane();
    if (pane?.runtime.io.isPtyConnected()) return "Disconnect";
    return connectionController.getBackend() === "webcontainer"
      ? "Start WebContainer"
      : "Connect PTY";
  }

  function getConnectionShellStateDetail(): ConnectionStateDetail {
    return {
      backend: connectionController.getBackend(),
      ptyUrl: connectionController.getPtyUrl(),
      ptyButtonLabel: getPtyButtonLabel(),
      webContainerCommand: connectionController.getWebContainerCommand(),
      webContainerCwd: connectionController.getWebContainerCwd(),
    };
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

  const shellAdapter = createPlaygroundShellAdapter({
    target: window,
    settingsDialog,
  });

  const paneShellSync = createPaneShellSync({
    target: window,
    elements: {
      btnPause,
      rendererSelect,
      fontSizeInput,
      ptyBtn,
      themeSelect,
      fontFamilySelect,
      fontFamilyLocalSelect,
      btnLoadLocalFonts,
      fontFamilyHintEl,
      ligaturesSelect,
      fontHintingSelect,
      fontHintTargetSelect,
      mouseModeEl,
      shaderPresetEl,
    },
    getSelectedConnectionBackend: () => connectionController.getBackend(),
    getSelectedFontFamily: () => appearanceController.getFontFamily(),
    getSelectedLocalFontMatcher: () => appearanceController.getLocalFontMatcher(),
    getDetectedLocalFontOptions: () => appearanceController.getDetectedLocalFontOptions(),
    getLocalFontHintText: () => appearanceController.getLocalFontHintText(),
    getSelectedLigatures: () => appearanceController.getLigatures(),
    getSelectedFontHinting: () => appearanceController.getFontHinting(),
    getSelectedFontHintTarget: () => appearanceController.getFontHintTarget(),
    getSelectedShaderPreset: () => appearanceController.getShaderPreset(),
    syncSelectedDefaults: (state) => {
      appearanceController.syncTerminalDefaultsFromState(state);
    },
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
      paneShellSync.syncPauseButton(state);
    },
    syncPtyButton: (pane) => {
      paneShellSync.syncPtyButton(pane);
    },
    waitForAnimationFrame,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
  });

  connectionController = createConnectionController({
    getActivePane,
    getPanes: () => getRestty().getPanes(),
    connectPaneIfNeeded: (pane) => paneLifecycle.connectPaneIfNeeded(pane),
    syncConnectionState: () => {
      shellAdapter.syncConnectionState(getConnectionShellStateDetail());
    },
    syncPtyButton: (pane) => {
      paneShellSync.syncPtyButton(pane);
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
      syncFontFamilyValue: () => paneShellSync.syncFontFamilyValue(),
      syncFontRenderingControls: () => paneShellSync.syncFontRenderingControls(),
      syncLocalFontControls: () => paneShellSync.syncLocalFontControls(),
      syncMouseModeValue: (value) => paneShellSync.syncMouseModeValue(value),
      syncShaderPresetValue: (value) => paneShellSync.syncShaderPresetValue(value),
      syncThemeSelectValue: (value) => paneShellSync.syncThemeSelectValue(value),
    },
    onThemeFileReset: shellAdapter.resetThemeFileInput,
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
    shell: {
      shellAdapter,
      paneShellSync,
      getConnectionShellStateDetail,
    } satisfies PlaygroundSessionShell,
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

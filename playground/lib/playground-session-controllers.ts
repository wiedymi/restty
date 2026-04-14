import type { Restty } from "../../src/index.ts";
import { createConnectionController } from "./connection-controller.ts";
import { createPaneAppearanceController } from "./appearance-controller.ts";
import { createPaneLifecycleController } from "./pane-lifecycle.ts";
import type { PlaygroundSessionShell } from "./playground-session-shell.ts";
import type { PlaygroundAppearanceInitialState } from "./startup-defaults.ts";
import type { PaneState } from "./pane-state.ts";

type ManagedPane = NonNullable<ReturnType<Restty["getActivePane"]>>;
type PlaygroundWindow = Window & typeof globalThis;

type CreatePlaygroundSessionControllersOptions = {
  getRestty: () => Restty;
  getActivePane: () => ManagedPane | null;
  getActivePaneId: () => number | null;
  paneStates: Map<number, PaneState>;
  window: PlaygroundWindow;
  shell: PlaygroundSessionShell;
  startup: {
    initialConnectionBackend: string;
    initialPtyUrl: string;
    initialWebContainerCommand: string;
    initialWebContainerCwd: string;
    appearanceInitialState: PlaygroundAppearanceInitialState;
  };
};

export type PlaygroundSessionControllers = {
  paneLifecycle: ReturnType<typeof createPaneLifecycleController>;
  connectionController: ReturnType<typeof createConnectionController>;
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
};

export function createPlaygroundSessionControllers({
  getRestty,
  getActivePane,
  getActivePaneId,
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
}: CreatePlaygroundSessionControllersOptions): PlaygroundSessionControllers {
  function waitForAnimationFrame(): Promise<void> {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  let appearanceController: ReturnType<typeof createPaneAppearanceController>;
  let connectionController: ReturnType<typeof createConnectionController>;

  const paneLifecycle = createPaneLifecycleController({
    getPaneById: (id) => getRestty().getPaneById(id),
    getActivePane,
    getPaneState: (id) => paneStates.get(id),
    setPaneState: (id, state) => {
      paneStates.set(id, state);
    },
    getActivePaneId,
    getSelectedConnectionBackend: () => connectionController.getBackend(),
    getSelectedPtyUrl: () => connectionController.getPtyUrl(),
    updatePaneSize: (id, force) => {
      getRestty().pane(id)?.updateSize(force);
    },
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
      shell.publishConnectionState();
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
      forEachPane: (visitor) => {
        getRestty().forEachPane(visitor);
      },
      setFontSources: (sources) => getRestty().setFontSources(sources),
      setShaderStages: (stages) => getRestty().setShaderStages(stages),
    },
    getActivePane: () => getRestty().activePane(),
    getActivePaneState: () => {
      const activePaneId = getActivePaneId();
      return activePaneId === null ? null : (paneStates.get(activePaneId) ?? null);
    },
    getActivePaneId,
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
    onThemeFileReset: shell.resetThemeFileInput,
    initialState: appearanceInitialState,
  });

  return {
    paneLifecycle,
    connectionController,
    appearanceController,
  };
}

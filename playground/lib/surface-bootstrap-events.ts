import type { ResttyConfig, ResttyPaneApi } from "../../src/index.ts";
import { createDemoController, stopPaneDemo } from "./demos.ts";
import type { PlaygroundDesktopNotification } from "./desktop-notifications.ts";
import type { PaneLifecyclePane, createPaneLifecycleController } from "./pane-lifecycle.ts";
import type { PaneState } from "./pane-state.ts";
import type { createPaneShellSync } from "./pane-shell-sync.ts";

type PlaygroundSurfaceEventPolicyOptions = {
  paneStates: Map<number, PaneState>;
  getPaneHandleById: (id: number) => ResttyPaneApi | null;
  setActivePaneId: (id: number | null) => void;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
  paneLifecycle: ReturnType<typeof createPaneLifecycleController>;
  queueResizeAllPanes: () => void;
  onDesktopNotification: (notification: PlaygroundDesktopNotification) => void;
  createDemoController?: typeof createDemoController;
};

export function createPlaygroundSurfaceEvents({
  paneStates,
  getPaneHandleById,
  setActivePaneId,
  paneShellSync,
  paneLifecycle,
  queueResizeAllPanes,
  onDesktopNotification,
  createDemoController: createDemoControllerForPane = createDemoController,
}: PlaygroundSurfaceEventPolicyOptions): NonNullable<
  NonNullable<ResttyConfig["surface"]>["events"]
> {
  return {
    onPaneCreated: (pane) => {
      const state = paneStates.get(pane.id);
      if (!state) return;
      const paneHandle = getPaneHandleById(pane.id);
      if (!paneHandle) return;

      pane.paused = state.paused;
      pane.setPaused = (value: boolean) => {
        paneLifecycle.setPanePaused(pane.id, value);
      };

      state.demos = createDemoControllerForPane(paneHandle);
      paneHandle.setMouseMode(state.mouseMode);
      void paneLifecycle.initPane(pane as PaneLifecyclePane, state);
    },
    onPaneClosed: (pane) => {
      const state = paneStates.get(pane.id);
      stopPaneDemo(state);
      paneStates.delete(pane.id);
    },
    onActivePaneChange: (pane) => {
      setActivePaneId(pane?.id ?? null);
      if (!pane) return;
      const state = paneStates.get(pane.id);
      if (!state) return;
      const paneHandle = getPaneHandleById(pane.id);
      if (!paneHandle) return;
      paneShellSync.syncPtyButton(paneHandle);
      paneShellSync.renderActivePaneControls(paneHandle, state);
    },
    onLayoutChanged: () => {
      queueResizeAllPanes();
    },
    onDesktopNotification,
  };
}

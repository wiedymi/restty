import type { Restty } from "../../src/index.ts";
import type { createPaneAppearanceController } from "./appearance-controller.ts";
import type { createPaneShellSync } from "./pane-shell-sync.ts";
import type { PaneState } from "./pane-state.ts";

type AnimationFrameHost = Pick<Window, "addEventListener" | "requestAnimationFrame">;

type CreatePlaygroundSurfaceStartupOptions = {
  target: AnimationFrameHost;
  paneStates: Map<number, PaneState>;
  setActivePaneId: (id: number | null) => void;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
};

export function createPlaygroundSurfaceStartup({
  target,
  paneStates,
  setActivePaneId,
  paneShellSync,
  appearanceController,
}: CreatePlaygroundSurfaceStartupOptions) {
  let resizeRaf = 0;
  let resizeAllPanes: ((force?: boolean) => void) | null = null;

  const queueResizeAllPanes = () => {
    if (resizeRaf) return;
    resizeRaf = target.requestAnimationFrame(() => {
      resizeRaf = 0;
      resizeAllPanes?.(true);
    });
  };

  function start(restty: Restty) {
    resizeAllPanes = (force) => {
      restty.forEachPane((pane) => {
        pane.updateSize(force);
      });
    };
    appearanceController.applyCurrentShaderPreset();

    target.addEventListener("resize", () => {
      queueResizeAllPanes();
    });

    const firstPane = restty.createInitialPane({ focus: true });
    setActivePaneId(firstPane.id);
    const firstState = paneStates.get(firstPane.id);
    if (firstState) {
      paneShellSync.syncPtyButton(firstPane);
      paneShellSync.renderActivePaneControls(firstPane, firstState);
    }
    queueResizeAllPanes();
  }

  return {
    queueResizeAllPanes,
    start,
  };
}

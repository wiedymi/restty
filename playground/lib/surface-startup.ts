import { Restty } from "../../src/index.ts";
import type { createPaneAppearanceController } from "./appearance-controller.ts";
import type { createPaneShellSync } from "./pane-shell-sync.ts";
import type { PaneState } from "./pane-state.ts";

type AnimationFrameHost = Pick<Window, "addEventListener" | "requestAnimationFrame">;

type CreatePlaygroundSurfaceStartupOptions = {
  target: AnimationFrameHost;
  getPanes: () => ReturnType<Restty["getPanes"]>;
  paneStates: Map<number, PaneState>;
  setActivePaneId: (id: number | null) => void;
  paneShellSync: ReturnType<typeof createPaneShellSync>;
  appearanceController: ReturnType<typeof createPaneAppearanceController>;
};

export function createPlaygroundSurfaceStartup({
  target,
  getPanes,
  paneStates,
  setActivePaneId,
  paneShellSync,
  appearanceController,
}: CreatePlaygroundSurfaceStartupOptions) {
  let resizeRaf = 0;

  const queueResizeAllPanes = () => {
    if (resizeRaf) return;
    resizeRaf = target.requestAnimationFrame(() => {
      resizeRaf = 0;
      for (const pane of getPanes()) {
        pane.runtime.interaction.updateSize(true);
      }
    });
  };

  function start(restty: Restty) {
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

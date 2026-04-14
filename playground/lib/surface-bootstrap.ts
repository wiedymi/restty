import type { Restty } from "../../src/index.ts";
import type { PaneState } from "./pane-state.ts";
import {
  assemblePlaygroundSurface,
  type CreatePlaygroundSurfaceAssemblyOptions,
} from "./surface-bootstrap-assembly.ts";
import { createPlaygroundSurfaceStartup } from "./surface-startup.ts";

type AnimationFrameHost = Pick<Window, "addEventListener" | "requestAnimationFrame">;

type BootstrapPlaygroundSurfaceOptions = Omit<
  CreatePlaygroundSurfaceAssemblyOptions,
  "surfaceStartup"
> & {
  target: AnimationFrameHost;
};

export function bootstrapPlaygroundSurface({
  target,
  ...assembly
}: BootstrapPlaygroundSurfaceOptions) {
  const surfaceStartup = createPlaygroundSurfaceStartup({
    target,
    getPanes: () => restty.getPanes(),
    paneStates: assembly.state.paneStates,
    setActivePaneId: assembly.state.setActivePaneId,
    paneShellSync: assembly.shell.paneShellSync,
    appearanceController: assembly.controllers.appearanceController,
  });

  let restty!: Restty;
  restty = assemblePlaygroundSurface({
    ...assembly,
    surfaceStartup,
  });

  surfaceStartup.start(restty);

  return restty;
}

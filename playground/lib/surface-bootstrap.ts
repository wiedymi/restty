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
  "getPaneHandleById" | "surfaceStartup"
> & {
  target: AnimationFrameHost;
  onResttyReady?: (restty: Restty) => void;
};

export function bootstrapPlaygroundSurface({
  target,
  onResttyReady,
  ...assembly
}: BootstrapPlaygroundSurfaceOptions) {
  const surfaceStartup = createPlaygroundSurfaceStartup({
    target,
    paneStates: assembly.state.paneStates,
    setActivePaneId: assembly.state.setActivePaneId,
    paneShellSync: assembly.shell.paneShellSync,
  });

  let restty!: Restty;
  restty = assemblePlaygroundSurface({
    ...assembly,
    getPaneHandleById: (id) => restty.pane(id),
    surfaceStartup,
  });

  onResttyReady?.(restty);
  surfaceStartup.start(restty);

  return restty;
}

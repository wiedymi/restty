import type { ResttyFontSource } from "../../runtime/core/models";
import { createResttyManagedPaneManager } from "../panes/managed-pane-manager";
import type { ResttyManagedPane, ResttyManagedPaneManager } from "../panes/managed-pane-types";
import type { ResttyConfig } from "./config";
import type { ResttyPluginSurfaceBridgeSource } from "./plugin-surface";
import { createResttySurfaceAssembly } from "./assembly";
import { ResttyController } from "./controller";
import { ResttyShaderOps } from "./shader-ops";

type BootstrapResttySurfaceOptions = {
  restty: ResttyPluginSurfaceBridgeSource;
  getPanes: () => ResttyManagedPane[];
  getPaneById: (id: number) => ResttyManagedPane | null;
  getFontSources: () => ResttyFontSource[] | undefined;
  options: ResttyConfig;
};

export function bootstrapResttySurface({
  restty,
  getPanes,
  getPaneById,
  getFontSources,
  options,
}: BootstrapResttySurfaceOptions): {
  shaderOps: ResttyShaderOps;
  controller: ResttyController;
  paneManager: ResttyManagedPaneManager;
  createInitialPane: NonNullable<ResttyConfig["surface"]>["createInitialPane"];
} {
  const { root, session, surface, terminal, services } = options;
  const {
    paneDom,
    autoInit,
    minPaneSize,
    paneStyles,
    searchUi,
    shortcuts,
    contextMenu,
    defaultContextMenu,
    createInitialPane = true,
    events,
  } = surface ?? {};
  const {
    shaderOps,
    controller,
    mergedTerminalConfig,
    mergedServicesConfig,
    paneManagerEventHandlers,
  } = createResttySurfaceAssembly({
    restty,
    getPanes,
    getPaneById,
    getFontSources,
    terminal,
    services,
    events,
  });

  const paneManager = createResttyManagedPaneManager({
    root,
    session,
    paneDom,
    autoInit,
    minPaneSize,
    paneStyles,
    searchUi,
    shortcuts,
    contextMenu,
    defaultContextMenu,
    terminal: mergedTerminalConfig,
    services: mergedServicesConfig,
    ...paneManagerEventHandlers,
  });

  return {
    shaderOps,
    controller,
    paneManager,
    createInitialPane,
  };
}

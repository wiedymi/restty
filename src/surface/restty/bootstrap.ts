import type { ResttyFontSource } from "../../runtime/core/models";
import { createResttyManagedPaneManager } from "../panes/managed-pane-manager";
import type { ResttyManagedPane, ResttyManagedPaneManager } from "../panes/managed-pane-types";
import {
  createMergedPaneServicesConfig,
  createMergedPaneTerminalConfig,
  createPaneManagerEventHandlers,
} from "./manager-options";
import { ResttyController } from "./controller";
import type { ResttyConfig } from "./config";
import {
  createResttyPluginSurfaceBridge,
  type ResttyPluginSurfaceBridgeSource,
} from "./plugin-surface";
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
    onPaneCreated,
    onPaneClosed,
    onPaneSplit,
    onActivePaneChange,
    onLayoutChanged,
    onDesktopNotification,
  } = events ?? {};

  const shaderOps = new ResttyShaderOps({
    getPanes,
    getPaneById,
  });
  const controller = new ResttyController({
    restty: createResttyPluginSurfaceBridge(restty),
    panes: () => restty.panes(),
    pane: (id) => restty.pane(id),
    activePane: () => restty.activePane(),
    focusedPane: () => restty.focusedPane(),
    addRenderStage: (stage, ownerPluginId) => shaderOps.addManagedShaderStage(stage, ownerPluginId),
  });

  const mergedTerminalConfig = createMergedPaneTerminalConfig({
    terminal,
    getFontSources,
    shaderOps,
  });
  const mergedServicesConfig = createMergedPaneServicesConfig({
    services,
    onDesktopNotification,
    pluginHost: controller,
    runRenderHooks: (payload) => controller.runRenderHooks(payload),
  });

  const paneManagerEventHandlers = createPaneManagerEventHandlers({
    shaderOps,
    emitPluginEvent: (event, payload) => controller.emitPluginEvent(event, payload),
    onPaneCreated,
    onPaneClosed,
    onPaneSplit,
    onActivePaneChange,
    onLayoutChanged,
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

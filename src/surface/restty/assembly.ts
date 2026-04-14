import type { ResttyFontSource } from "../../runtime/core/models";
import type { ResttyManagedPane } from "../panes/managed-pane-types";
import {
  createMergedPaneServicesConfig,
  createMergedPaneTerminalConfig,
  createPaneManagerEventHandlers,
} from "./manager-options";
import {
  createResttyPluginSurfaceBridge,
  type ResttyPluginSurfaceBridgeSource,
} from "./plugin-surface";
import { ResttyController } from "./controller";
import type { ResttyConfig } from "./config";
import { ResttyShaderOps } from "./shader-ops";

type CreateResttySurfaceAssemblyOptions = {
  restty: ResttyPluginSurfaceBridgeSource;
  getPanes: () => ResttyManagedPane[];
  getPaneById: (id: number) => ResttyManagedPane | null;
  getFontSources: () => ResttyFontSource[] | undefined;
  terminal: ResttyConfig["terminal"];
  services: ResttyConfig["services"];
  events: NonNullable<NonNullable<ResttyConfig["surface"]>["events"]> | undefined;
};

export function createResttySurfaceAssembly({
  restty,
  getPanes,
  getPaneById,
  getFontSources,
  terminal,
  services,
  events,
}: CreateResttySurfaceAssemblyOptions) {
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

  return {
    shaderOps,
    controller,
    mergedTerminalConfig,
    mergedServicesConfig,
    paneManagerEventHandlers,
  };
}

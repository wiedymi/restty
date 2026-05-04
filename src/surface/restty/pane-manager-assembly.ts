import type { ResttyFontInput } from "../../runtime/core/models";
import {
  createMergedPaneServicesConfig,
  createMergedPaneTerminalConfig,
  createPaneManagerEventHandlers,
} from "./manager-options";
import { ResttyController } from "./controller";
import type { ResttyConfig } from "./config";
import { ResttyShaderOps } from "./shader-ops";

type CreateResttyPaneManagerAssemblyOptions = {
  shaderOps: ResttyShaderOps;
  controller: ResttyController;
  getFonts: () => ResttyFontInput[] | undefined;
  terminal: ResttyConfig["terminal"];
  services: ResttyConfig["services"];
  events: NonNullable<NonNullable<ResttyConfig["surface"]>["events"]> | undefined;
};

export function createResttyPaneManagerAssembly({
  shaderOps,
  controller,
  getFonts,
  terminal,
  services,
  events,
}: CreateResttyPaneManagerAssemblyOptions) {
  const controllerHooks = controller.paneManagerHooks;
  const {
    onPaneCreated,
    onPaneClosed,
    onPaneSplit,
    onActivePaneChange,
    onLayoutChanged,
    onDesktopNotification,
  } = events ?? {};

  const mergedTerminalConfig = createMergedPaneTerminalConfig({
    terminal,
    getFonts,
    shaderOps,
  });
  const mergedServicesConfig = createMergedPaneServicesConfig({
    services,
    onDesktopNotification,
    pluginHost: controller,
    runRenderHooks: controllerHooks.runRenderHooks,
  });

  const paneManagerEventHandlers = createPaneManagerEventHandlers({
    shaderOps,
    emitPluginEvent: controllerHooks.emitPluginEvent,
    onPaneCreated,
    onPaneClosed,
    onPaneSplit,
    onActivePaneChange,
    onLayoutChanged,
  });

  return {
    mergedTerminalConfig,
    mergedServicesConfig,
    paneManagerEventHandlers,
  };
}

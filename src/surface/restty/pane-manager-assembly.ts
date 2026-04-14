import type { ResttyFontSource } from "../../runtime/core/models";
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
  getFontSources: () => ResttyFontSource[] | undefined;
  terminal: ResttyConfig["terminal"];
  services: ResttyConfig["services"];
  events: NonNullable<NonNullable<ResttyConfig["surface"]>["events"]> | undefined;
};

export function createResttyPaneManagerAssembly({
  shaderOps,
  controller,
  getFontSources,
  terminal,
  services,
  events,
}: CreateResttyPaneManagerAssemblyOptions) {
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
    mergedTerminalConfig,
    mergedServicesConfig,
    paneManagerEventHandlers,
  };
}

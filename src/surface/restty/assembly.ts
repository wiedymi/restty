import type { ResttyFontSource } from "../../runtime/core/models";
import { createResttyPaneManagerAssembly } from "./pane-manager-assembly";
import {
  createResttyPluginSurfaceBridge,
  type ResttyPluginSurfaceBridgeSource,
} from "./plugin-surface";
import { ResttyController } from "./controller";
import type { ResttyConfig } from "./config";
import type { ResttyPaneApi } from "./pane-handle";
import { ResttyShaderOps } from "./shader-ops";

type CreateResttySurfaceAssemblyOptions = {
  restty: ResttyPluginSurfaceBridgeSource;
  forEachPane: (visitor: (pane: Pick<ResttyPaneApi, "id" | "setShaderStages">) => void) => void;
  getPaneHandleById: (id: number) => Pick<ResttyPaneApi, "id" | "setShaderStages"> | null;
  getFontSources: () => ResttyFontSource[] | undefined;
  terminal: ResttyConfig["terminal"];
  services: ResttyConfig["services"];
  events: NonNullable<NonNullable<ResttyConfig["surface"]>["events"]> | undefined;
};

export function createResttySurfaceAssembly({
  restty,
  forEachPane,
  getPaneHandleById,
  getFontSources,
  terminal,
  services,
  events,
}: CreateResttySurfaceAssemblyOptions) {
  const shaderOps = new ResttyShaderOps({
    forEachPane,
    getPaneHandleById,
  });
  const controller = new ResttyController({
    restty: createResttyPluginSurfaceBridge(restty),
    addRenderStage: (stage, ownerPluginId) => shaderOps.addManagedShaderStage(stage, ownerPluginId),
  });

  const paneManagerAssembly = createResttyPaneManagerAssembly({
    shaderOps,
    controller,
    getFontSources,
    terminal,
    services,
    events,
  });

  return {
    shaderOps,
    controller,
    ...paneManagerAssembly,
  };
}

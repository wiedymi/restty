import type { ResttyFontSource } from "../../runtime/core/models";
import type { ResttyManagedPane } from "../panes/managed-pane-types";
import { createResttyPaneManagerAssembly } from "./pane-manager-assembly";
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
  const shaderOps = new ResttyShaderOps({
    getPanes,
    getPaneById,
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

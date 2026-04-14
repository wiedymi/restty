import type { ResttyShaderStage } from "../../runtime/core/models";
import type { ResttyPluginHostApi, ResttyRenderStageHandle } from "./context.types";

export type ResttyPluginHostDeps = {
  restty: ResttyPluginHostApi;
  addRenderStage: (
    stage: ResttyShaderStage,
    ownerPluginId: string | null,
  ) => ResttyRenderStageHandle;
};

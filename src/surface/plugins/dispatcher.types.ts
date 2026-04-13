import type { ResttyShaderStage } from "../../runtime/core/models";
import type { ResttyPaneHandle } from "../restty/pane-handle";
import type { Restty } from "../restty";
import type { ResttyRenderStageHandle } from "./context.types";

export type ResttyPluginHostDeps = {
  restty: Restty;
  panes: () => ResttyPaneHandle[];
  pane: (id: number) => ResttyPaneHandle | null;
  activePane: () => ResttyPaneHandle | null;
  focusedPane: () => ResttyPaneHandle | null;
  addRenderStage: (
    stage: ResttyShaderStage,
    ownerPluginId: string | null,
  ) => ResttyRenderStageHandle;
};

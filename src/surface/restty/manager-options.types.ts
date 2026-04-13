import type { DesktopNotification } from "../../input";
import type { ResttyFontSource } from "../../runtime/core/models";
import type { ResttyPluginHost } from "../plugins/host";
import type { ResttyRenderHookPayload } from "../plugins/context.types";
import type { ResttyPluginEvents } from "../plugins/types";
import type {
  ResttyManagedPane,
  ResttyRuntimeServicesConfigInput,
  ResttyTerminalConfigInput,
} from "../panes/managed-pane-types";
import type { ResttyPaneSplitDirection } from "../panes/types";
import type { ResttyShaderOps } from "./shader-ops";

export type PaneManagerEventHandlers = {
  onPaneCreated?: (pane: ResttyManagedPane) => void;
  onPaneClosed?: (pane: ResttyManagedPane) => void;
  onPaneSplit?: (
    sourcePane: ResttyManagedPane,
    createdPane: ResttyManagedPane,
    direction: ResttyPaneSplitDirection,
  ) => void;
  onActivePaneChange?: (pane: ResttyManagedPane | null) => void;
  onLayoutChanged?: () => void;
};

export type MergedPaneTerminalConfigDeps = {
  terminal: ResttyTerminalConfigInput | undefined;
  getFontSources: () => ResttyFontSource[] | undefined;
  shaderOps: Pick<
    ResttyShaderOps,
    "normalizePaneShaderStages" | "setPaneBaseShaderStages" | "buildMergedShaderStages"
  >;
};

export type MergedPaneServicesConfigDeps = {
  services: ResttyRuntimeServicesConfigInput | undefined;
  onDesktopNotification?: (notification: DesktopNotification & { paneId: number }) => void;
  pluginHost: Pick<ResttyPluginHost, "applyInputInterceptors" | "applyOutputInterceptors">;
  runRenderHooks: (payload: ResttyRenderHookPayload) => void;
};

export type PaneManagerCallbacksDeps = PaneManagerEventHandlers & {
  shaderOps: Pick<ResttyShaderOps, "syncPaneShaderStages" | "removePaneBaseShaderStages">;
  emitPluginEvent: <E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ) => void;
};

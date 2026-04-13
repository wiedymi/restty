import type { DesktopNotification } from "../../input";
import type { CreateResttyAppPaneManagerOptions, ResttyManagedAppPane } from "../pane-app-manager";
import type { ResttyPluginEvents, ResttyRenderHookPayload } from "../restty-plugin-types";
import type { ResttyFontSource } from "../../runtime/types";
import type { ResttyPluginOps } from "./plugin-ops";
import type { ResttyShaderOps } from "./shader-ops";

type PaneManagerEventHandlers = Pick<
  CreateResttyAppPaneManagerOptions,
  "onPaneCreated" | "onPaneClosed" | "onPaneSplit" | "onActivePaneChange" | "onLayoutChanged"
>;

type MergedPaneTerminalConfigDeps = {
  terminal: CreateResttyAppPaneManagerOptions["terminal"] | undefined;
  getFontSources: () => ResttyFontSource[] | undefined;
  shaderOps: Pick<
    ResttyShaderOps,
    "normalizePaneShaderStages" | "setPaneBaseShaderStages" | "buildMergedShaderStages"
  >;
};

type MergedPaneServicesConfigDeps = {
  services: CreateResttyAppPaneManagerOptions["services"] | undefined;
  onDesktopNotification?: (notification: DesktopNotification & { paneId: number }) => void;
  pluginOps: Pick<ResttyPluginOps, "applyInputInterceptors" | "applyOutputInterceptors">;
  runRenderHooks: (payload: ResttyRenderHookPayload) => void;
};

type PaneManagerCallbacksDeps = PaneManagerEventHandlers & {
  shaderOps: Pick<ResttyShaderOps, "syncPaneShaderStages" | "removePaneBaseShaderStages">;
  emitPluginEvent: <E extends keyof ResttyPluginEvents>(
    event: E,
    payload: ResttyPluginEvents[E],
  ) => void;
};

export function createMergedPaneTerminalConfig(
  deps: MergedPaneTerminalConfigDeps,
): CreateResttyAppPaneManagerOptions["terminal"] {
  return (context) => {
    const paneId = context.id;
    const resolved =
      typeof deps.terminal === "function" ? deps.terminal(context) : (deps.terminal ?? {});
    const paneBaseStages = deps.shaderOps.normalizePaneShaderStages(resolved.shaderStages, paneId);
    deps.shaderOps.setPaneBaseShaderStages(paneId, paneBaseStages);

    const fontSources = deps.getFontSources();
    return {
      ...resolved,
      ...(fontSources ? { fontSources } : {}),
      shaderStages: deps.shaderOps.buildMergedShaderStages(paneBaseStages),
    };
  };
}

export function createMergedPaneServicesConfig(
  deps: MergedPaneServicesConfigDeps,
): CreateResttyAppPaneManagerOptions["services"] {
  return (context) => {
    const paneId = context.id;
    const resolved =
      typeof deps.services === "function" ? deps.services(context) : (deps.services ?? {});
    const resolvedBeforeInput = resolved.beforeInput;
    const resolvedBeforeRenderOutput = resolved.beforeRenderOutput;
    const resolvedCallbacks = resolved.callbacks;
    return {
      ...resolved,
      callbacks:
        deps.onDesktopNotification || resolvedCallbacks?.onDesktopNotification
          ? {
              ...resolvedCallbacks,
              onDesktopNotification: (notification) => {
                resolvedCallbacks?.onDesktopNotification?.(notification);
                deps.onDesktopNotification?.({ ...notification, paneId });
              },
            }
          : resolvedCallbacks,
      beforeInput: ({ text, source }) => {
        const maybeUserText = resolvedBeforeInput?.({ text, source });
        if (maybeUserText === null) return null;
        const current = maybeUserText === undefined ? text : maybeUserText;
        return deps.pluginOps.applyInputInterceptors(paneId, current, source);
      },
      beforeRenderOutput: ({ text, source }) => {
        deps.runRenderHooks({
          phase: "before",
          paneId,
          text,
          source,
          dropped: false,
        });
        const maybeUserText = resolvedBeforeRenderOutput?.({ text, source });
        if (maybeUserText === null) {
          deps.runRenderHooks({
            phase: "after",
            paneId,
            text,
            source,
            dropped: true,
          });
          return null;
        }
        const current = maybeUserText === undefined ? text : maybeUserText;
        const next = deps.pluginOps.applyOutputInterceptors(paneId, current, source);
        deps.runRenderHooks({
          phase: "after",
          paneId,
          text: next === null ? current : next,
          source,
          dropped: next === null,
        });
        return next;
      },
    };
  };
}

export function createPaneManagerEventHandlers(
  deps: PaneManagerCallbacksDeps,
): PaneManagerEventHandlers {
  return {
    onPaneCreated: (pane: ResttyManagedAppPane) => {
      deps.shaderOps.syncPaneShaderStages(pane.id);
      deps.emitPluginEvent("pane:created", { paneId: pane.id });
      deps.onPaneCreated?.(pane);
    },
    onPaneClosed: (pane: ResttyManagedAppPane) => {
      deps.shaderOps.removePaneBaseShaderStages(pane.id);
      deps.emitPluginEvent("pane:closed", { paneId: pane.id });
      deps.onPaneClosed?.(pane);
    },
    onPaneSplit: (sourcePane, createdPane, direction) => {
      deps.emitPluginEvent("pane:split", {
        sourcePaneId: sourcePane.id,
        createdPaneId: createdPane.id,
        direction,
      });
      deps.onPaneSplit?.(sourcePane, createdPane, direction);
    },
    onActivePaneChange: (pane) => {
      deps.emitPluginEvent("pane:active-changed", { paneId: pane?.id ?? null });
      deps.onActivePaneChange?.(pane);
    },
    onLayoutChanged: () => {
      deps.emitPluginEvent("layout:changed", {});
      deps.onLayoutChanged?.();
    },
  };
}

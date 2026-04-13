import type { ResttyRuntimeCallbacks } from "../../runtime/core/resources";
import type { ResttyRuntimeConfig } from "../../runtime/core/config";
import type { CreateManagedPaneRuntimeConfigOptions } from "./managed-pane-runtime-config.types";

export function createManagedPaneRuntimeConfig(
  options: CreateManagedPaneRuntimeConfigOptions,
): ResttyRuntimeConfig {
  const { context, session, onSearchState } = options;
  const baseTerminal =
    typeof options.terminal === "function" ? options.terminal(context) : (options.terminal ?? {});
  const baseServices =
    typeof options.services === "function" ? options.services(context) : (options.services ?? {});

  const mergedCallbacks: ResttyRuntimeCallbacks = {
    ...baseServices.callbacks,
    onSearchState: (state) => {
      baseServices.callbacks?.onSearchState?.(state);
      onSearchState?.(state);
    },
  };

  return {
    mount: {
      canvas: context.canvas,
      imeInput: context.imeInput,
      session,
    },
    terminal: baseTerminal,
    services: {
      ...baseServices,
      callbacks: mergedCallbacks,
    },
  };
}

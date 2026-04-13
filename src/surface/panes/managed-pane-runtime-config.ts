import type { ResttyAppCallbacks, ResttyAppSession } from "../../runtime/core/resources";
import type { ResttyRuntimeConfig } from "../../runtime/core/config";
import type {
  ResttyPaneRuntimeContext,
  ResttyRuntimeServicesConfigInput,
  ResttyTerminalConfigInput,
} from "./managed-pane-types";

export type CreateManagedPaneRuntimeConfigOptions = {
  context: ResttyPaneRuntimeContext;
  terminal?: ResttyTerminalConfigInput;
  services?: ResttyRuntimeServicesConfigInput;
  session: ResttyAppSession;
  onSearchState?: ResttyAppCallbacks["onSearchState"];
};

export function createManagedPaneRuntimeConfig(
  options: CreateManagedPaneRuntimeConfigOptions,
): ResttyRuntimeConfig {
  const { context, session, onSearchState } = options;
  const baseTerminal =
    typeof options.terminal === "function" ? options.terminal(context) : (options.terminal ?? {});
  const baseServices =
    typeof options.services === "function" ? options.services(context) : (options.services ?? {});

  const mergedElements = {
    ...baseServices.elements,
    termDebugEl: baseServices.elements?.termDebugEl ?? context.termDebugEl,
  };
  const mergedCallbacks: ResttyAppCallbacks = {
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
      elements: mergedElements,
      callbacks: mergedCallbacks,
    },
  };
}

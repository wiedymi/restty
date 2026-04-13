import { createResttyRuntime } from "../app-factory";
import type { ResttyAppCallbacks, ResttyAppSession, ResttyRuntime } from "../../runtime/types";
import type {
  CreateResttyAppPaneManagerOptions,
  ResttyPaneRuntimeContext,
} from "./managed-pane-types";

export type CreateManagedPaneRuntimeOptions = {
  context: ResttyPaneRuntimeContext;
  terminal?: CreateResttyAppPaneManagerOptions["terminal"];
  services?: CreateResttyAppPaneManagerOptions["services"];
  session: ResttyAppSession;
  autoInit?: boolean;
  onSearchState?: ResttyAppCallbacks["onSearchState"];
};

export function createManagedPaneRuntime(options: CreateManagedPaneRuntimeOptions): ResttyRuntime {
  const { context, session, autoInit, onSearchState } = options;
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

  const app = createResttyRuntime({
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
  });

  if (autoInit) {
    void app.lifecycle.init();
  }

  return app;
}

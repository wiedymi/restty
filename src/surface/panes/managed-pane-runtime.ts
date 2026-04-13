import { createResttyRuntime } from "../app-factory";
import type { ResttyAppCallbacks, ResttyAppSession, ResttyRuntime } from "../../runtime/types";
import { createManagedPaneRuntimeConfig } from "./managed-pane-runtime-config";
import type {
  ResttyPaneRuntimeContext,
  ResttyRuntimeServicesConfigInput,
  ResttyTerminalConfigInput,
} from "./managed-pane-types";

export type CreateManagedPaneRuntimeOptions = {
  context: ResttyPaneRuntimeContext;
  terminal?: ResttyTerminalConfigInput;
  services?: ResttyRuntimeServicesConfigInput;
  session: ResttyAppSession;
  autoInit?: boolean;
  onSearchState?: ResttyAppCallbacks["onSearchState"];
};

export function createManagedPaneRuntime(options: CreateManagedPaneRuntimeOptions): ResttyRuntime {
  const { autoInit } = options;
  const app = createResttyRuntime(createManagedPaneRuntimeConfig(options));

  if (autoInit) {
    void app.lifecycle.init();
  }

  return app;
}

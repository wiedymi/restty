import { createResttyRuntime } from "../../runtime/create-runtime";
import type { ResttyRuntime } from "../../runtime/core/api";
import type { ResttyRuntimeCallbacks, ResttyRuntimeSession } from "../../runtime/core/resources";
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
  session: ResttyRuntimeSession;
  autoInit?: boolean;
  onSearchState?: ResttyRuntimeCallbacks["onSearchState"];
};

export function createManagedPaneRuntime(options: CreateManagedPaneRuntimeOptions): ResttyRuntime {
  const { autoInit } = options;
  const app = createResttyRuntime(createManagedPaneRuntimeConfig(options));

  if (autoInit) {
    void app.lifecycle.init();
  }

  return app;
}

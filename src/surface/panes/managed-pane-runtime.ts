import { createResttyRuntime } from "../../runtime/create-runtime";
import type { ResttyRuntime } from "../../runtime/core/api";
import { createManagedPaneRuntimeConfig } from "./managed-pane-runtime-config";
import type { CreateManagedPaneRuntimeOptions } from "./managed-pane-runtime.types";

export function createManagedPaneRuntime(options: CreateManagedPaneRuntimeOptions): ResttyRuntime {
  const { autoInit } = options;
  const runtime = createResttyRuntime(createManagedPaneRuntimeConfig(options));

  if (autoInit) {
    void runtime.lifecycle.init();
  }

  return runtime;
}

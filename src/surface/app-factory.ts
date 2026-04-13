import type { ResttyRuntime } from "../runtime/core/api";
import type { ResttyRuntimeConfig } from "../runtime/core/config";
import { createResttyRuntime as createResttyRuntimeImpl } from "../runtime/create-runtime";

/** Internal runtime-construction boundary used by pane manager wiring. */
export function createResttyRuntime(options: ResttyRuntimeConfig): ResttyRuntime {
  return createResttyRuntimeImpl(options);
}

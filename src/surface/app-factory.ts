import type { ResttyRuntime, ResttyRuntimeConfig } from "../runtime/types";
import { createResttyRuntime as createResttyRuntimeImpl } from "../runtime/create-runtime";

/** Internal runtime-construction boundary used by pane manager wiring. */
export function createResttyRuntime(options: ResttyRuntimeConfig): ResttyRuntime {
  return createResttyRuntimeImpl(options);
}

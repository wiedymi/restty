import type { ResttyApp, ResttyRuntimeConfig } from "../runtime/types";
import { createResttyApp as createResttyAppImpl } from "../runtime/create-runtime";

/** Internal app-construction boundary used by pane manager wiring. */
export function createResttyApp(options: ResttyRuntimeConfig): ResttyApp {
  return createResttyAppImpl(options);
}

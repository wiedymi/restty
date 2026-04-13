import type { ResttyAppInputPayload } from "../core/models";

export type RuntimeInputHook =
  | ((payload: ResttyAppInputPayload) => string | null | void)
  | null
  | undefined;

export type RuntimeInputHooksOptions = {
  beforeInputHook?: RuntimeInputHook;
  beforeRenderOutputHook?: RuntimeInputHook;
};

export type RuntimeInputHooks = {
  runBeforeInputHook: (text: string, source: string) => string | null;
  runBeforeRenderOutputHook: (text: string, source: string) => string | null;
};

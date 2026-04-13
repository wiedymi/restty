import type { ResttyRuntimeInputPayload } from "../core/models";

export type RuntimeInputHook =
  | ((payload: ResttyRuntimeInputPayload) => string | null | void)
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

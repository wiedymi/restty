import {
  PLAYGROUND_SHELL_SCRIPTS,
  type PlaygroundShellScriptSpec,
} from "./playground-shell-scripts.ts";

export type WebContainerSeedScriptSpec = PlaygroundShellScriptSpec;

export const WEBCONTAINER_SEED_SCRIPTS: WebContainerSeedScriptSpec[] =
  PLAYGROUND_SHELL_SCRIPTS;

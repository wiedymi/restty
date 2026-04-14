import { wireSveltePlaygroundControls } from "./playground-wiring.svelte.ts";
import type { WirePlaygroundControlsOptions } from "./playground-wiring.types.ts";

export function wirePlaygroundControls(options: WirePlaygroundControlsOptions): void {
  wireSveltePlaygroundControls(options);
}

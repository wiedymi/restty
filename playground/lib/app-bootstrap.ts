import { Restty } from "../../src/index.ts";
import {
  createEmptyLegacyPlaygroundElements,
  queryLegacyPlaygroundElements,
  querySharedPlaygroundElements,
} from "./elements.ts";
import { bootstrapPlaygroundOrchestrator } from "./playground-orchestrator.ts";

type PlaygroundWindow = Window & typeof globalThis;

type BootstrapPlaygroundAppOptions = {
  document: Document;
  window: PlaygroundWindow;
  notificationHost?: typeof Notification;
};

export function bootstrapPlaygroundApp({
  document,
  window,
  notificationHost = globalThis.Notification,
}: BootstrapPlaygroundAppOptions): Restty {
  const usesSvelteShell = document.documentElement.dataset.playgroundShell === "svelte";

  return bootstrapPlaygroundOrchestrator({
    window,
    usesSvelteShell,
    notificationHost,
    sharedElements: querySharedPlaygroundElements(document),
    legacyElements: usesSvelteShell
      ? createEmptyLegacyPlaygroundElements()
      : queryLegacyPlaygroundElements(document),
  });
}

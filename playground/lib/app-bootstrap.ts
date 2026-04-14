import { Restty } from "../../src/index.ts";
import { queryLegacyPlaygroundElements, querySharedPlaygroundElements } from "./elements.ts";
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
  return bootstrapPlaygroundOrchestrator({
    window,
    notificationHost,
    sharedElements: querySharedPlaygroundElements(document),
    legacyElements: queryLegacyPlaygroundElements(document),
  });
}

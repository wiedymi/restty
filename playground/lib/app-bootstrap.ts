import type { Restty } from "../../src/index.ts";
import { queryPlaygroundElements } from "./elements.ts";
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
    elements: queryPlaygroundElements(document),
  });
}

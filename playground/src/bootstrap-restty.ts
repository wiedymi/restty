import { bootstrapPlaygroundApp } from "../lib/app-bootstrap.ts";

export function bootstrapResttyPlayground() {
  return bootstrapPlaygroundApp({
    document,
    window,
    notificationHost: globalThis.Notification,
  });
}

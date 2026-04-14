import { bootstrapPlaygroundApp } from "./lib/app-bootstrap.ts";

void bootstrapPlaygroundApp({
  document,
  window,
  notificationHost: globalThis.Notification,
});

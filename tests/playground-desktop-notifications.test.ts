import { expect, test } from "bun:test";
import {
  createDesktopNotificationHandler,
  type PlaygroundDesktopNotification,
} from "../playground/lib/desktop-notifications.ts";

const baseNotification: PlaygroundDesktopNotification = {
  title: " Build finished ",
  body: " ready ",
  source: "osc9",
  raw: "raw",
  paneId: 7,
};

test("desktop notification handler logs normalized messages without a browser sink", () => {
  const logs: string[] = [];
  const handleDesktopNotification = createDesktopNotificationHandler({
    logInfo: (message) => logs.push(message),
  });

  handleDesktopNotification(baseNotification);
  handleDesktopNotification({
    ...baseNotification,
    title: "  ",
    body: "",
    source: "osc777",
  });

  expect(logs).toEqual([
    "[notify][pane 7][osc9] Build finished: ready",
    "[notify][pane 7][osc777] Terminal notification",
  ]);
});

test("desktop notification handler emits immediately when permission is granted", () => {
  const notifications: Array<{ title: string; options?: NotificationOptions }> = [];
  const handleDesktopNotification = createDesktopNotificationHandler({
    sink: {
      getPermission: () => "granted",
      requestPermission: async () => "denied",
      notify: (title, options) => {
        notifications.push({ title, options });
      },
    },
    logInfo: () => {},
  });

  handleDesktopNotification(baseNotification);

  expect(notifications).toEqual([
    {
      title: "Build finished",
      options: { body: "ready" },
    },
  ]);
});

test("desktop notification handler reuses a pending permission request", async () => {
  const notifications: Array<{ title: string; options?: NotificationOptions }> = [];
  let requestCount = 0;
  let permission: NotificationPermission = "default";
  let resolvePermission: ((value: NotificationPermission) => void) | null = null;
  const permissionPromise = new Promise<NotificationPermission>((resolve) => {
    resolvePermission = resolve;
  });

  const handleDesktopNotification = createDesktopNotificationHandler({
    sink: {
      getPermission: () => permission,
      requestPermission: async () => {
        requestCount += 1;
        const result = await permissionPromise;
        permission = result;
        return result;
      },
      notify: (title, options) => {
        notifications.push({ title, options });
      },
    },
    logInfo: () => {},
  });

  handleDesktopNotification(baseNotification);
  handleDesktopNotification({
    ...baseNotification,
    title: "Pane updated",
    body: "",
  });

  expect(requestCount).toBe(1);
  resolvePermission?.("granted");
  await permissionPromise;
  await Promise.resolve();
  await Promise.resolve();

  expect(notifications).toEqual([
    {
      title: "Build finished",
      options: { body: "ready" },
    },
    {
      title: "Pane updated",
      options: undefined,
    },
  ]);
});

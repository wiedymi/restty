import { expect, test } from "bun:test";
import { createConnectionController } from "../playground/lib/connection-controller.ts";

function createPane(connected = false) {
  const calls: string[] = [];
  let isConnected = connected;
  const pane = {
    runtime: {
      io: {
        disconnectPty: () => {
          calls.push("disconnect");
          isConnected = false;
        },
        isPtyConnected: () => isConnected,
      },
    },
  };
  return { calls, pane };
}

test("connection controller updates backend state and reconnect flow", () => {
  const first = createPane(true);
  const second = createPane(false);
  const syncCalls: string[] = [];

  const controller = createConnectionController({
    getActivePane: () => first.pane,
    getPanes: () => [first.pane, second.pane],
    connectPaneIfNeeded: (pane) => {
      syncCalls.push(pane === first.pane ? "connect:first" : "connect:second");
    },
    syncConnectionUi: () => {
      syncCalls.push("sync-ui");
    },
    syncPtyButton: (pane) => {
      syncCalls.push(pane === first.pane ? "sync-pty:first" : "sync-pty:second");
    },
    initialBackend: "ws",
    initialPtyUrl: "ws://localhost:8787/pty",
    initialWebContainerCommand: "jsh",
    initialWebContainerCwd: "/",
  });

  controller.setPtyUrl("ws://example.test/pty");
  controller.setWebContainerCommand("bash");
  controller.setWebContainerCwd("/tmp");
  controller.applyConnectionBackend("webcontainer");

  expect(controller.getBackend()).toBe("webcontainer");
  expect(controller.getConnectUrl()).toBe("");
  expect(controller.getPtyUrl()).toBe("ws://example.test/pty");
  expect(controller.getWebContainerCommand()).toBe("bash");
  expect(controller.getWebContainerCwd()).toBe("/tmp");
  expect(first.calls).toEqual(["disconnect"]);
  expect(second.calls).toEqual([]);
  expect(syncCalls).toEqual(["sync-ui", "connect:first", "connect:second", "sync-pty:first"]);
});

test("connection controller normalizes string inputs", () => {
  const controller = createConnectionController({
    getActivePane: () => null,
    getPanes: () => [],
    connectPaneIfNeeded: () => {},
    syncPtyButton: () => {},
    initialBackend: "ws",
    initialPtyUrl: "ws://localhost:8787/pty",
    initialWebContainerCommand: "jsh",
    initialWebContainerCwd: "/",
  });

  controller.setPtyUrl("");
  controller.setWebContainerCommand("");
  controller.setWebContainerCwd("");
  controller.applyConnectionBackend("unexpected");

  expect(controller.getBackend()).toBe("ws");
  expect(controller.getConnectUrl()).toBe("");
  expect(controller.getWebContainerCommand()).toBe("jsh");
  expect(controller.getWebContainerCwd()).toBe("/");
});

import { expect, test } from "bun:test";
import { createConnectionController } from "../playground/lib/connection-controller.ts";

function createPane(id: number, connected = false) {
  const calls: string[] = [];
  let isConnected = connected;
  const pane = {
    id,
    disconnectPty: () => {
      calls.push("disconnect");
      isConnected = false;
    },
    isPtyConnected: () => isConnected,
  };
  return { calls, pane };
}

test("connection controller updates backend state and reconnect flow", () => {
  const first = createPane(1, true);
  const second = createPane(2, false);
  const syncCalls: string[] = [];

  const controller = createConnectionController({
    getActivePane: () => first.pane,
    forEachPane: (visitor) => {
      visitor(first.pane.id, first.pane);
      visitor(second.pane.id, second.pane);
    },
    connectPaneIfNeeded: (paneId) => {
      syncCalls.push(paneId === first.pane.id ? "connect:first" : "connect:second");
    },
    syncConnectionState: () => {
      syncCalls.push("sync-state");
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
  expect(syncCalls).toEqual([
    "sync-state",
    "sync-state",
    "sync-state",
    "sync-state",
    "connect:first",
    "connect:second",
    "sync-pty:first",
  ]);
});

test("connection controller treats just-bash as an auto-connect backend", () => {
  const first = createPane(1, false);
  const second = createPane(2, false);
  const syncCalls: string[] = [];

  const controller = createConnectionController({
    getActivePane: () => first.pane,
    forEachPane: (visitor) => {
      visitor(first.pane.id, first.pane);
      visitor(second.pane.id, second.pane);
    },
    connectPaneIfNeeded: (paneId) => {
      syncCalls.push(paneId === first.pane.id ? "connect:first" : "connect:second");
    },
    syncConnectionState: () => {
      syncCalls.push("sync-state");
    },
    syncPtyButton: (pane) => {
      syncCalls.push(pane === first.pane ? "sync-pty:first" : "sync-pty:second");
    },
    initialBackend: "ws",
    initialPtyUrl: "ws://localhost:8787/pty",
    initialWebContainerCommand: "jsh",
    initialWebContainerCwd: "/",
  });

  controller.applyConnectionBackend("just-bash");

  expect(controller.getBackend()).toBe("just-bash");
  expect(controller.getConnectUrl()).toBe("");
  expect(syncCalls).toEqual(["sync-state", "connect:first", "connect:second", "sync-pty:first"]);
});

test("connection controller normalizes string inputs", () => {
  const controller = createConnectionController({
    getActivePane: () => null,
    forEachPane: () => {},
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

  expect(controller.getBackend()).toBe("just-bash");
  expect(controller.getConnectUrl()).toBe("");
  expect(controller.getWebContainerCommand()).toBe("jsh");
  expect(controller.getWebContainerCwd()).toBe("/");
});

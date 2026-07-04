import { expect, test } from "bun:test";
import { createRuntimeIoView } from "../src/runtime/create-runtime/runtime-controller.public-api.capabilities";
import { createRuntimeEventHub } from "../src/runtime/core/runtime-events";
import type { ResttyRuntimeLifecycleState } from "../src/runtime/core/lifecycle";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function flushMicrotasks(times = 4) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function createIoHarness() {
  const calls: string[] = [];
  const ready = deferred();
  const runtimeEvents = createRuntimeEventHub();
  let state: ResttyRuntimeLifecycleState = "created";
  let connected = false;
  const setState = (next: ResttyRuntimeLifecycleState) => {
    state = next;
    runtimeEvents.emit({ type: "state", state: next });
  };

  const view = createRuntimeIoView({
    runtimeEvents,
    init: async () => {
      calls.push("init");
      setState("initializing");
      await ready.promise;
      setState("ready");
    },
    getLifecycleState: () => state,
    sendInput: (text, source = "program") => {
      calls.push(`input:${source}:${text}`);
    },
    ptyInputRuntime: {
      setPtyStatus: () => undefined,
      updateMouseStatus: () => undefined,
      scheduleSyncOutputReset: () => undefined,
      cancelSyncOutputReset: () => undefined,
      connectPty: (url = "") => {
        connected = true;
        calls.push(`connect:${url}`);
      },
      disconnectPty: () => {
        connected = false;
        calls.push("disconnect");
      },
      sendKeyInput: () => undefined,
      sendPasteText: () => undefined,
      sendPastePayloadFromDataTransfer: () => false,
      getCprPosition: () => ({ row: 0, col: 0 }),
    },
    ptyTransport: {
      isConnected: () => connected,
    },
  });

  return {
    calls,
    ready,
    setState,
    view,
  };
}

test("runtime IO waits for lifecycle readiness before connecting PTY", async () => {
  const { calls, ready, view } = createIoHarness();

  view.connectPty("ws://localhost:8787/pty");
  expect(calls).toEqual(["init"]);

  ready.resolve();
  await flushMicrotasks();

  expect(calls).toEqual(["init", "connect:ws://localhost:8787/pty"]);
});

test("runtime IO queues public input until lifecycle readiness", async () => {
  const { calls, ready, view } = createIoHarness();

  view.sendInput("hello", "program");
  view.sendInput("from pty", "pty");
  expect(calls).toEqual(["init"]);

  ready.resolve();
  await flushMicrotasks();

  expect(calls).toEqual(["init", "input:program:hello", "input:pty:from pty"]);
});

test("runtime IO reuses an in-flight lifecycle init for queued operations", async () => {
  const { calls, setState, view } = createIoHarness();

  setState("initializing");
  view.connectPty("ws://localhost:8787/pty");
  view.sendInput("hello");

  expect(calls).toEqual([]);

  setState("ready");
  await flushMicrotasks();

  expect(calls).toEqual(["input:program:hello", "connect:ws://localhost:8787/pty"]);
});

test("runtime IO cancels a pending PTY connect when disconnected before ready", async () => {
  const { calls, ready, view } = createIoHarness();

  view.connectPty("ws://localhost:8787/pty");
  view.disconnectPty();

  ready.resolve();
  await flushMicrotasks();

  expect(calls).toEqual(["init", "disconnect"]);
});

test("runtime IO runs immediately when lifecycle is already ready", () => {
  const { calls, setState, view } = createIoHarness();
  setState("ready");

  view.sendInput("ready");
  view.connectPty("");

  expect(calls).toEqual(["input:program:ready", "connect:"]);
});

import { expect, test } from "bun:test";
import type { PtyCallbacks } from "../src/index.ts";
import { createWebContainerProcessController } from "../playground/lib/webcontainer-process.ts";

function waitForMicrotasks() {
  return new Promise<void>((resolve) => {
    queueMicrotask(() => resolve());
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

function createCallbacks() {
  const events: string[] = [];
  const callbacks: PtyCallbacks = {
    onConnect: () => {
      events.push("connect");
    },
    onData: (data) => {
      events.push(`data:${data}`);
    },
    onDisconnect: () => {
      events.push("disconnect");
    },
    onError: (label, details) => {
      events.push(`error:${label}:${details.join("|")}`);
    },
    onExit: (code) => {
      events.push(`exit:${code}`);
    },
    onStatus: (status) => {
      events.push(`status:${status}`);
    },
  };
  return { callbacks, events };
}

function createProcess(options?: {
  exitPromise?: Promise<number>;
  readSteps?: Array<{ done?: boolean; value?: string }>;
}) {
  const writes: string[] = [];
  const calls: string[] = [];
  let readIndex = 0;
  const exitPromise = options?.exitPromise ?? Promise.resolve(0);
  const reader = {
    cancel: () => {
      calls.push("reader-cancel");
      return Promise.resolve();
    },
    read: async () => {
      const next = options?.readSteps?.[readIndex++] ?? { done: true, value: undefined };
      return { done: next.done ?? false, value: next.value };
    },
    releaseLock: () => {
      calls.push("reader-release");
    },
  };
  const writer = {
    releaseLock: () => {
      calls.push("writer-release");
    },
    write: async (value: string) => {
      writes.push(value);
    },
  };

  return {
    calls,
    process: {
      exit: exitPromise,
      input: {
        getWriter: () => writer,
      },
      kill: () => {
        calls.push("kill");
      },
      output: {
        getReader: () => reader,
      },
      resize: ({ cols, rows }: { cols: number; rows: number }) => {
        calls.push(`resize:${cols}x${rows}`);
      },
    },
    writes,
  };
}

test("webcontainer process controller streams output and exits cleanly", async () => {
  const controller = createWebContainerProcessController();
  const exit = createDeferred<number>();
  const { callbacks, events } = createCallbacks();
  const { process } = createProcess({
    exitPromise: exit.promise,
    readSteps: [{ value: "one" }, { value: "two" }, { done: true }],
  });

  controller.attachProcess({
    callbacks,
    isTokenActive: () => true,
    process,
    statusLabel: "jsh",
    token: 1,
    welcomeData: "welcome",
  });

  await waitForMicrotasks();
  exit.resolve(0);
  await waitForMicrotasks();

  expect(events).toEqual([
    "connect",
    "status:jsh",
    "data:welcome",
    "data:one",
    "data:two",
    "exit:0",
    "disconnect",
  ]);
});

test("webcontainer process controller stops, releases streams, and disconnects", () => {
  const controller = createWebContainerProcessController();
  const { callbacks, events } = createCallbacks();
  const { calls, process } = createProcess();

  controller.attachProcess({
    callbacks,
    isTokenActive: () => true,
    process,
    statusLabel: "bash",
    token: 2,
  });
  controller.stop(true);

  expect(controller.isConnected()).toBe(false);
  expect(events).toEqual(["connect", "status:bash", "disconnect"]);
  expect(calls).toEqual(["reader-cancel", "writer-release", "reader-release", "kill"]);
});

test("webcontainer process controller maps input, resizes, and reports connect errors", async () => {
  const controller = createWebContainerProcessController();
  const { callbacks, events } = createCallbacks();
  const { calls, process, writes } = createProcess();

  controller.attachProcess({
    callbacks,
    isTokenActive: () => true,
    process,
    statusLabel: "jsh",
    token: 3,
  });

  expect(controller.sendInput("\x7f", (value) => (value === "\x7f" ? "\x08" : value))).toBe(true);
  expect(controller.resize(100, 30)).toBe(true);
  await waitForMicrotasks();

  controller.handleConnectError(callbacks, new Error("boom"));

  expect(writes).toEqual(["\x08"]);
  expect(calls).toContain("resize:100x30");
  expect(events.slice(-2)).toEqual([
    "error:Failed to start WebContainer process:boom",
    "disconnect",
  ]);
});

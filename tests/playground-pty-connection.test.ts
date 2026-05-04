import { expect, test } from "bun:test";
import type { PtyConnectOptions, PtyResizeMeta, PtyTransport } from "../src/index.ts";
import { createAdaptivePtyTransport } from "../playground/lib/pty-connection.ts";
import type { ConnectionBackend } from "../playground/lib/connection-state.ts";

function createMockTransport(name: string) {
  const events: string[] = [];
  let connected = false;

  const transport: PtyTransport = {
    connect: (_options: PtyConnectOptions) => {
      events.push(`${name}:connect`);
      connected = true;
    },
    disconnect: () => {
      events.push(`${name}:disconnect`);
      connected = false;
    },
    sendInput: (data: string) => {
      events.push(`${name}:send:${data}`);
      return connected;
    },
    resize: (cols: number, rows: number, _meta?: PtyResizeMeta) => {
      events.push(`${name}:resize:${cols}x${rows}`);
      return connected;
    },
    isConnected: () => connected,
    destroy: () => {
      events.push(`${name}:destroy`);
      connected = false;
    },
  };

  return { transport, events };
}

test("createAdaptivePtyTransport switches transports when backend changes", async () => {
  const ws = createMockTransport("ws");
  const justBash = createMockTransport("just-bash");
  const webcontainer = createMockTransport("webcontainer");
  let backend: ConnectionBackend = "ws";

  const transport = createAdaptivePtyTransport({
    getConnectionBackend: () => backend,
    getPtyUrl: () => "ws://localhost:8787/pty",
    getWebContainerCommand: () => "jsh",
    getWebContainerCwd: () => "/",
    createWebSocketTransport: () => ws.transport,
    createJustBashTransport: () => justBash.transport,
    createWebContainerTransport: () => webcontainer.transport,
  });

  transport.connect({ callbacks: {} });
  expect(ws.events).toEqual(["ws:connect"]);
  expect(webcontainer.events).toEqual([]);

  backend = "webcontainer";
  await transport.connect({ callbacks: {} });
  expect(ws.events).toEqual(["ws:connect", "ws:disconnect"]);
  expect(justBash.events).toEqual([]);
  expect(webcontainer.events).toEqual(["webcontainer:connect"]);

  backend = "just-bash";
  await transport.connect({ callbacks: {} });
  expect(webcontainer.events).toEqual(["webcontainer:connect", "webcontainer:disconnect"]);
  expect(justBash.events).toEqual(["just-bash:connect"]);

  transport.disconnect();
  expect(ws.events).toEqual(["ws:connect", "ws:disconnect", "ws:disconnect"]);
  expect(justBash.events).toEqual(["just-bash:connect", "just-bash:disconnect"]);
  expect(webcontainer.events).toEqual([
    "webcontainer:connect",
    "webcontainer:disconnect",
    "webcontainer:disconnect",
  ]);
});

test("createAdaptivePtyTransport lazy-loads webcontainer transport only when selected", async () => {
  const ws = createMockTransport("ws");
  const webcontainer = createMockTransport("webcontainer");
  let backend: ConnectionBackend = "ws";
  let webcontainerLoads = 0;

  const transport = createAdaptivePtyTransport({
    getConnectionBackend: () => backend,
    getPtyUrl: () => "ws://localhost:8787/pty",
    getWebContainerCommand: () => "jsh",
    getWebContainerCwd: () => "/",
    createWebSocketTransport: () => ws.transport,
    createWebContainerTransport: async () => {
      webcontainerLoads += 1;
      return webcontainer.transport;
    },
  });

  transport.connect({ callbacks: {} });
  expect(webcontainerLoads).toBe(0);

  backend = "webcontainer";
  await transport.connect({ callbacks: {} });
  await transport.connect({ callbacks: {} });

  expect(webcontainerLoads).toBe(1);
  expect(webcontainer.events).toEqual(["webcontainer:connect", "webcontainer:connect"]);
});

test("createAdaptivePtyTransport routes just-bash without loading webcontainer", async () => {
  const justBash = createMockTransport("just-bash");
  const webcontainer = createMockTransport("webcontainer");
  let webcontainerLoads = 0;

  const transport = createAdaptivePtyTransport({
    getConnectionBackend: () => "just-bash",
    getPtyUrl: () => "ws://localhost:8787/pty",
    getWebContainerCommand: () => "node demo.js",
    getWebContainerCwd: () => "/",
    createJustBashTransport: () => justBash.transport,
    createWebContainerTransport: () => {
      webcontainerLoads += 1;
      return webcontainer.transport;
    },
  });

  await transport.connect({ callbacks: {} });

  expect(justBash.events).toEqual(["just-bash:connect"]);
  expect(webcontainerLoads).toBe(0);
  expect(webcontainer.events).toEqual([]);
});

test("createAdaptivePtyTransport ignores stale webcontainer connects during deferred load", async () => {
  let resolveTransport!: (transport: PtyTransport) => void;
  const webcontainer = createMockTransport("webcontainer");

  const transport = createAdaptivePtyTransport({
    getConnectionBackend: () => "webcontainer",
    getPtyUrl: () => "ws://localhost:8787/pty",
    getWebContainerCommand: () => "jsh",
    getWebContainerCwd: () => "/",
    createWebContainerTransport: () =>
      new Promise<PtyTransport>((resolve) => {
        resolveTransport = resolve;
      }),
  });

  const connectPromise = transport.connect({ callbacks: {} });
  transport.disconnect();
  resolveTransport(webcontainer.transport);
  await connectPromise;

  expect(webcontainer.events).toEqual([]);
  expect(transport.isConnected()).toBe(false);
});

import { expect, test } from "bun:test";
import type { PtyConnectOptions, PtyResizeMeta, PtyTransport } from "../src/index.ts";
import { createAdaptivePtyTransport } from "../playground/app/lib/pty/adaptive-transport.ts";
import {
  getConnectUrl,
  normalizeConnectionBackend,
  type PlaygroundConnectionBackend,
} from "../playground/app/lib/pty/types.ts";

function createMockTransport(name: string) {
  const events: string[] = [];
  let connected = false;

  const transport: PtyTransport = {
    connect: (options: PtyConnectOptions) => {
      events.push(`${name}:connect:${options.url}`);
      connected = true;
      options.callbacks.onConnect?.();
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

test("playground backend helpers default to Just Bash and only use URLs for OS PTY", () => {
  expect(normalizeConnectionBackend("ws")).toBe("ws");
  expect(normalizeConnectionBackend("webcontainer")).toBe("webcontainer");
  expect(normalizeConnectionBackend("bad")).toBe("just-bash");
  expect(getConnectUrl("just-bash", "ws://localhost:8787/pty")).toBe("");
  expect(getConnectUrl("webcontainer", "ws://localhost:8787/pty")).toBe("");
  expect(getConnectUrl("ws", "ws://localhost:8787/pty")).toBe("ws://localhost:8787/pty");
});

test("createAdaptivePtyTransport switches transports when backend changes", async () => {
  const ws = createMockTransport("ws");
  const justBash = createMockTransport("just-bash");
  const webcontainer = createMockTransport("webcontainer");
  const status: string[] = [];
  let backend: PlaygroundConnectionBackend = "ws";

  const transport = createAdaptivePtyTransport({
    getConnectionBackend: () => backend,
    getPtyUrl: () => "ws://localhost:8787/pty",
    getWebContainerCommand: () => "jsh",
    getWebContainerCwd: () => "/",
    onStatusChange: (next) => status.push(next),
    createWebSocketTransport: () => ws.transport,
    createJustBashTransport: () => justBash.transport,
    createWebContainerTransport: () => webcontainer.transport,
  });

  await transport.connect({ url: "", callbacks: {} });
  expect(ws.events).toEqual(["ws:connect:ws://localhost:8787/pty"]);
  expect(status).toEqual(["connecting", "connected"]);

  backend = "webcontainer";
  await transport.connect({ url: "", callbacks: {} });
  expect(ws.events).toEqual(["ws:connect:ws://localhost:8787/pty", "ws:disconnect"]);
  expect(webcontainer.events).toEqual(["webcontainer:connect:"]);

  backend = "just-bash";
  await transport.connect({ url: "", callbacks: {} });
  expect(webcontainer.events).toEqual(["webcontainer:connect:", "webcontainer:disconnect"]);
  expect(justBash.events).toEqual(["just-bash:connect:"]);
});

test("createAdaptivePtyTransport lazy-loads WebContainer only when selected", async () => {
  const ws = createMockTransport("ws");
  const webcontainer = createMockTransport("webcontainer");
  let backend: PlaygroundConnectionBackend = "ws";
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

  await transport.connect({ url: "", callbacks: {} });
  expect(webcontainerLoads).toBe(0);

  backend = "webcontainer";
  await transport.connect({ url: "", callbacks: {} });
  await transport.connect({ url: "", callbacks: {} });

  expect(webcontainerLoads).toBe(1);
  expect(webcontainer.events).toEqual(["webcontainer:connect:", "webcontainer:connect:"]);
});

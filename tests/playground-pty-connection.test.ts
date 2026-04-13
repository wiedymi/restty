import { expect, test } from "bun:test";
import type { PtyConnectOptions, PtyResizeMeta, PtyTransport } from "../src/index.ts";
import {
  createAdaptivePtyTransport,
  getConnectUrl,
  getConnectionBackend,
  getConnectionUiState,
  syncConnectionUi,
} from "../playground/lib/pty-connection.ts";

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

test("getConnectionBackend resolves webcontainer and defaults to ws", () => {
  expect(getConnectionBackend({ value: "webcontainer" })).toBe("webcontainer");
  expect(getConnectionBackend({ value: "ws" })).toBe("ws");
  expect(getConnectionBackend({ value: "other" })).toBe("ws");
  expect(getConnectionBackend(null)).toBe("ws");
});

test("getConnectUrl returns blank for webcontainer and trims ws urls", () => {
  expect(getConnectUrl({ value: "webcontainer" }, { value: " ws://localhost:8787/pty " })).toBe("");
  expect(getConnectUrl({ value: "ws" }, { value: " ws://localhost:8787/pty " })).toBe(
    "ws://localhost:8787/pty",
  );
});

test("syncConnectionUi toggles inputs and hint text", () => {
  const connectionBackendEl = { value: "webcontainer" };
  const ptyUrlInput = { disabled: false };
  const wcCommandInput = { disabled: true };
  const wcCwdInput = { disabled: true };
  const connectionHintEl = { textContent: "" };

  const webcontainerBackend = syncConnectionUi({
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
    connectionHintEl,
  });

  expect(webcontainerBackend).toBe("webcontainer");
  expect(ptyUrlInput.disabled).toBe(true);
  expect(wcCommandInput.disabled).toBe(false);
  expect(wcCwdInput.disabled).toBe(false);
  expect(connectionHintEl.textContent).toBe("Using in-browser WebContainer process");

  connectionBackendEl.value = "ws";
  const wsBackend = syncConnectionUi({
    connectionBackendEl,
    ptyUrlInput,
    wcCommandInput,
    wcCwdInput,
    connectionHintEl,
  });

  expect(wsBackend).toBe("ws");
  expect(ptyUrlInput.disabled).toBe(false);
  expect(wcCommandInput.disabled).toBe(true);
  expect(wcCwdInput.disabled).toBe(true);
  expect(connectionHintEl.textContent).toBe("Using WebSocket PTY URL");
});

test("getConnectionUiState describes backend-specific shell state", () => {
  expect(getConnectionUiState("webcontainer")).toEqual({
    ptyUrlDisabled: true,
    webContainerInputsDisabled: false,
    hintText: "Using in-browser WebContainer process",
  });
  expect(getConnectionUiState("ws")).toEqual({
    ptyUrlDisabled: false,
    webContainerInputsDisabled: true,
    hintText: "Using WebSocket PTY URL",
  });
});

test("createAdaptivePtyTransport switches transports when backend changes", () => {
  const ws = createMockTransport("ws");
  const webcontainer = createMockTransport("webcontainer");
  let backend: "ws" | "webcontainer" = "ws";

  const transport = createAdaptivePtyTransport({
    getConnectionBackend: () => backend,
    getPtyUrl: () => "ws://localhost:8787/pty",
    getWebContainerCommand: () => "jsh",
    getWebContainerCwd: () => "/",
    createWebSocketTransport: () => ws.transport,
    createWebContainerTransport: () => webcontainer.transport,
  });

  transport.connect({ callbacks: {} });
  expect(ws.events).toEqual(["ws:connect"]);
  expect(webcontainer.events).toEqual([]);

  backend = "webcontainer";
  transport.connect({ callbacks: {} });
  expect(ws.events).toEqual(["ws:connect", "ws:disconnect"]);
  expect(webcontainer.events).toEqual(["webcontainer:connect"]);

  transport.disconnect();
  expect(ws.events).toEqual(["ws:connect", "ws:disconnect", "ws:disconnect"]);
  expect(webcontainer.events).toEqual(["webcontainer:connect", "webcontainer:disconnect"]);
});

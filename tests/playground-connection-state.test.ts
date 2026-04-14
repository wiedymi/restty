import { expect, test } from "bun:test";
import {
  getConnectUrl,
  getConnectUrlForState,
  getConnectionBackend,
  getConnectionBackendForValue,
  getConnectionUiState,
  syncConnectionUi,
} from "../playground/lib/connection-state.ts";

test("getConnectionBackend resolves webcontainer and defaults to ws", () => {
  expect(getConnectionBackend({ value: "webcontainer" })).toBe("webcontainer");
  expect(getConnectionBackend({ value: "ws" })).toBe("ws");
  expect(getConnectionBackend({ value: "other" })).toBe("ws");
  expect(getConnectionBackend(null)).toBe("ws");
});

test("getConnectionBackendForValue resolves webcontainer and defaults to ws", () => {
  expect(getConnectionBackendForValue("webcontainer")).toBe("webcontainer");
  expect(getConnectionBackendForValue("ws")).toBe("ws");
  expect(getConnectionBackendForValue("other")).toBe("ws");
  expect(getConnectionBackendForValue(null)).toBe("ws");
});

test("getConnectUrl returns blank for webcontainer and trims ws urls", () => {
  expect(getConnectUrl({ value: "webcontainer" }, { value: " ws://localhost:8787/pty " })).toBe("");
  expect(getConnectUrl({ value: "ws" }, { value: " ws://localhost:8787/pty " })).toBe(
    "ws://localhost:8787/pty",
  );
});

test("getConnectUrlForState returns blank for webcontainer and trims ws urls", () => {
  expect(getConnectUrlForState("webcontainer", " ws://localhost:8787/pty ")).toBe("");
  expect(getConnectUrlForState("ws", " ws://localhost:8787/pty ")).toBe("ws://localhost:8787/pty");
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

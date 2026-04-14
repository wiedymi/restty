import { expect, test } from "bun:test";
import {
  getConnectUrlForState,
  getConnectionBackendForValue,
  getConnectionUiState,
} from "../playground/lib/connection-state.ts";

test("getConnectionBackendForValue resolves webcontainer and defaults to ws", () => {
  expect(getConnectionBackendForValue("webcontainer")).toBe("webcontainer");
  expect(getConnectionBackendForValue("ws")).toBe("ws");
  expect(getConnectionBackendForValue("other")).toBe("ws");
  expect(getConnectionBackendForValue(null)).toBe("ws");
});

test("getConnectUrlForState returns blank for webcontainer and trims ws urls", () => {
  expect(getConnectUrlForState("webcontainer", " ws://localhost:8787/pty ")).toBe("");
  expect(getConnectUrlForState("ws", " ws://localhost:8787/pty ")).toBe("ws://localhost:8787/pty");
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

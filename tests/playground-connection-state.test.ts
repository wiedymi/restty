import { expect, test } from "bun:test";
import {
  getConnectUrlForState,
  getConnectionBackendForValue,
  getConnectionUiState,
} from "../playground/lib/connection-state.ts";

test("getConnectionBackendForValue resolves supported backends and defaults to just-bash", () => {
  expect(getConnectionBackendForValue("just-bash")).toBe("just-bash");
  expect(getConnectionBackendForValue("webcontainer")).toBe("webcontainer");
  expect(getConnectionBackendForValue("ws")).toBe("ws");
  expect(getConnectionBackendForValue("other")).toBe("just-bash");
  expect(getConnectionBackendForValue(null)).toBe("just-bash");
});

test("getConnectUrlForState returns blank for in-browser backends and trims ws urls", () => {
  expect(getConnectUrlForState("just-bash", " ws://localhost:8787/pty ")).toBe("");
  expect(getConnectUrlForState("webcontainer", " ws://localhost:8787/pty ")).toBe("");
  expect(getConnectUrlForState("ws", " ws://localhost:8787/pty ")).toBe("ws://localhost:8787/pty");
});

test("getConnectionUiState describes backend-specific shell state", () => {
  expect(getConnectionUiState("just-bash")).toEqual({
    ptyUrlDisabled: true,
    webContainerInputsDisabled: true,
    hintText: "Using in-browser bash",
  });
  expect(getConnectionUiState("webcontainer")).toEqual({
    ptyUrlDisabled: true,
    webContainerInputsDisabled: false,
    hintText: "Using custom WebContainer command",
  });
  expect(getConnectionUiState("ws")).toEqual({
    ptyUrlDisabled: false,
    webContainerInputsDisabled: true,
    hintText: "Using OS PTY websocket URL",
  });
});

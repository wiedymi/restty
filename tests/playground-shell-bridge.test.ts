import { expect, test } from "bun:test";
import {
  dispatchAppearanceInput,
  dispatchActivePaneState,
  dispatchConnectionInput,
  dispatchConnectionState,
  dispatchShellCommand,
  dispatchTerminalAction,
  dispatchThemeFileReset,
  listenAppearanceInput,
  listenActivePaneState,
  listenConnectionInput,
  listenConnectionState,
  listenShellCommand,
  listenTerminalAction,
} from "../playground/lib/shell-bridge.ts";
import { THEME_FILE_RESET_EVENT } from "../playground/lib/shell-events.ts";

test("shell bridge dispatchers emit the expected details", () => {
  const target = new EventTarget();
  const seen: unknown[] = [];

  listenActivePaneState(target, (detail) => {
    seen.push({ type: "active", detail });
  });
  listenConnectionState(target, (detail) => {
    seen.push({ type: "connection", detail });
  });
  target.addEventListener(THEME_FILE_RESET_EVENT, () => {
    seen.push({ type: "theme-reset" });
  });

  dispatchActivePaneState({ terminal: { pauseLabel: "Resume" } }, target);
  dispatchConnectionState({ ptyButtonLabel: "Disconnect" }, target);
  dispatchThemeFileReset(target);

  expect(seen).toEqual([
    { type: "active", detail: { terminal: { pauseLabel: "Resume" } } },
    { type: "connection", detail: { ptyButtonLabel: "Disconnect" } },
    { type: "theme-reset" },
  ]);
});

test("shell bridge listeners can be removed", () => {
  const target = new EventTarget();
  const seen: string[] = [];
  const stop = listenConnectionState(target, (detail) => {
    seen.push(String(detail.ptyButtonLabel));
  });

  dispatchConnectionState({ ptyButtonLabel: "Connect OS PTY" }, target);
  stop();
  dispatchConnectionState({ ptyButtonLabel: "Disconnect" }, target);

  expect(seen).toEqual(["Connect OS PTY"]);
});

test("shell bridge dispatches shell command, input, and action details", () => {
  const target = new EventTarget();
  const seen: Array<{ type: string; detail: unknown }> = [];

  listenShellCommand(target, (detail) => {
    seen.push({ type: "command", detail });
  });
  listenConnectionInput(target, (detail) => {
    seen.push({ type: "connection-input", detail });
  });
  listenAppearanceInput(target, (detail) => {
    seen.push({ type: "appearance-input", detail });
  });
  listenTerminalAction(target, (detail) => {
    seen.push({ type: "terminal-action", detail });
  });

  const file = new File(["theme"], "theme.conf");
  dispatchShellCommand({ command: "run-demo", demoKind: "unicode" }, target);
  dispatchConnectionInput({ backend: "webcontainer" }, target);
  dispatchAppearanceInput({ fontFamily: "jetbrains" }, target);
  dispatchConnectionInput({ ptyUrl: "ws://localhost:8787/pty" }, target);
  dispatchTerminalAction({ fontSize: "22" }, target);
  dispatchShellCommand({ command: "settings-open" }, target);
  dispatchAppearanceInput({ themeFile: file }, target);
  dispatchConnectionInput({ webContainerCommand: "bash" }, target);
  dispatchConnectionInput({ webContainerCwd: "/tmp" }, target);
  dispatchAppearanceInput({ action: "load-local-fonts" }, target);
  dispatchShellCommand({ command: "pty-button" }, target);
  dispatchShellCommand({ command: "settings-close" }, target);
  dispatchTerminalAction({ command: "clear" }, target);

  expect(seen).toEqual([
    { type: "command", detail: { command: "run-demo", demoKind: "unicode" } },
    { type: "connection-input", detail: { backend: "webcontainer" } },
    { type: "appearance-input", detail: { fontFamily: "jetbrains" } },
    { type: "connection-input", detail: { ptyUrl: "ws://localhost:8787/pty" } },
    { type: "terminal-action", detail: { fontSize: "22" } },
    { type: "command", detail: { command: "settings-open" } },
    { type: "appearance-input", detail: { themeFile: file } },
    { type: "connection-input", detail: { webContainerCommand: "bash" } },
    { type: "connection-input", detail: { webContainerCwd: "/tmp" } },
    { type: "appearance-input", detail: { action: "load-local-fonts" } },
    { type: "command", detail: { command: "pty-button" } },
    { type: "command", detail: { command: "settings-close" } },
    { type: "terminal-action", detail: { command: "clear" } },
  ]);
});

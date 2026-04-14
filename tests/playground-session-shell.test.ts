import { expect, test } from "bun:test";
import { createPlaygroundSessionShell } from "../playground/lib/playground-session-shell.ts";
import { dispatchShellCommand } from "../playground/lib/shell-bridge.ts";
import { CONNECTION_STATE_EVENT, THEME_FILE_RESET_EVENT } from "../playground/lib/shell-events.ts";

function createPane() {
  return {
    id: 1,
    runtime: {
      io: {
        isPtyConnected: () => false,
      },
    },
  };
}

function createAppearanceController() {
  return {
    getFontFamily: () => "fira-code",
    getLocalFontMatcher: () => "",
    getDetectedLocalFontOptions: () => [],
    getLocalFontHintText: () => "No local font detected",
    getLigatures: () => true,
    getFontHinting: () => false,
    getFontHintTarget: () => "auto",
    getShaderPreset: () => "none",
    syncTerminalDefaultsFromState: () => {},
  };
}

test("playground session shell dispatches theme reset and connection state", () => {
  const target = new EventTarget();
  const seen: string[] = [];
  let connectionState: unknown = null;

  target.addEventListener(THEME_FILE_RESET_EVENT, () => {
    seen.push("reset");
  });
  target.addEventListener(CONNECTION_STATE_EVENT, (event) => {
    connectionState = (event as CustomEvent).detail;
  });

  const pane = createPane();
  const shell = createPlaygroundSessionShell({
    window: target as Window & typeof globalThis,
    getActivePane: () => pane,
    getConnectionController: () => ({
      getBackend: () => "ws",
      getPtyUrl: () => "ws://example.test/pty",
      getWebContainerCommand: () => "bash",
      getWebContainerCwd: () => "/tmp",
    }),
    getAppearanceController: createAppearanceController,
  });

  expect(shell.isSettingsDialogOpen()).toBe(false);
  dispatchShellCommand({ command: "settings-open" }, target);
  expect(shell.isSettingsDialogOpen()).toBe(true);
  dispatchShellCommand({ command: "settings-close" }, target);
  expect(shell.isSettingsDialogOpen()).toBe(false);

  shell.resetThemeFileInput();
  shell.syncConnectionState(shell.getConnectionShellStateDetail());

  expect(seen).toEqual(["reset"]);
  expect(connectionState).toEqual({
    backend: "ws",
    ptyUrl: "ws://example.test/pty",
    ptyButtonLabel: "Connect PTY",
    webContainerCommand: "bash",
    webContainerCwd: "/tmp",
  });
});

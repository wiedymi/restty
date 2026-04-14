import { expect, test } from "bun:test";
import { createPlaygroundShellAdapter } from "../playground/lib/shell-adapter.ts";
import { CONNECTION_STATE_EVENT, THEME_FILE_RESET_EVENT } from "../playground/lib/shell-events.ts";

function createHost() {
  const calls: string[] = [];
  const focusedPane = {
    canvas: {
      focus: () => {
        calls.push("focus");
      },
    },
  };

  return {
    host: {
      hideContextMenu: () => {
        calls.push("hide");
      },
      getFocusedPane: () => focusedPane,
      getActivePane: () => focusedPane,
      getPanes: () => [focusedPane],
    },
    calls,
  };
}

test("shell adapter dispatches theme reset and handles settings focus in svelte mode", () => {
  const target = new EventTarget();
  const seen: string[] = [];
  let connectionState: unknown = null;
  target.addEventListener(THEME_FILE_RESET_EVENT, () => {
    seen.push("reset");
  });
  target.addEventListener(CONNECTION_STATE_EVENT, (event) => {
    connectionState = (event as CustomEvent).detail;
  });
  const { host, calls } = createHost();

  const adapter = createPlaygroundShellAdapter({
    target,
    settingsDialog: null,
  });

  adapter.resetThemeFileInput();
  adapter.syncConnectionState({
    backend: "ws",
    ptyUrl: "ws://example.test/pty",
    ptyButtonLabel: "Disconnect",
    webContainerCommand: "bash",
    webContainerCwd: "/tmp",
  });
  adapter.openSettings(host);
  adapter.closeSettings(host);

  expect(seen).toEqual(["reset"]);
  expect(connectionState).toEqual({
    backend: "ws",
    ptyUrl: "ws://example.test/pty",
    ptyButtonLabel: "Disconnect",
    webContainerCommand: "bash",
    webContainerCwd: "/tmp",
  });
  expect(calls).toEqual(["hide", "focus"]);
});

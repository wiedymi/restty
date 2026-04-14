import { expect, test } from "bun:test";
import { createPlaygroundShellEffects } from "../playground/lib/shell-effects.ts";
import { CONNECTION_STATE_EVENT, THEME_FILE_RESET_EVENT } from "../playground/lib/shell-events.ts";

test("shell effects dispatch theme reset and connection state through the shell bridge", () => {
  const target = new EventTarget();
  const seen: string[] = [];
  let connectionState: unknown = null;

  target.addEventListener(THEME_FILE_RESET_EVENT, () => {
    seen.push("reset");
  });
  target.addEventListener(CONNECTION_STATE_EVENT, (event) => {
    connectionState = (event as CustomEvent).detail;
  });

  const effects = createPlaygroundShellEffects({
    target,
  });

  effects.resetThemeFileInput();
  effects.syncConnectionState({
    backend: "ws",
    ptyUrl: "ws://example.test/pty",
    ptyButtonLabel: "Disconnect",
    webContainerCommand: "bash",
    webContainerCwd: "/tmp",
  });

  expect(seen).toEqual(["reset"]);
  expect(connectionState).toEqual({
    backend: "ws",
    ptyUrl: "ws://example.test/pty",
    ptyButtonLabel: "Disconnect",
    webContainerCommand: "bash",
    webContainerCwd: "/tmp",
  });
});

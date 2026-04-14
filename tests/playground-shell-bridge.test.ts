import { expect, test } from "bun:test";
import {
  dispatchActivePaneState,
  dispatchConnectionState,
  dispatchThemeFileReset,
  listenActivePaneState,
  listenConnectionState,
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

  dispatchConnectionState({ ptyButtonLabel: "Connect PTY" }, target);
  stop();
  dispatchConnectionState({ ptyButtonLabel: "Disconnect" }, target);

  expect(seen).toEqual(["Connect PTY"]);
});

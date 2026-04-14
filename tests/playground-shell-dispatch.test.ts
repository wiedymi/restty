import { expect, test } from "bun:test";
import {
  APPEARANCE_INPUT_EVENT,
  CONNECTION_INPUT_EVENT,
  SHELL_COMMAND_EVENT,
  TERMINAL_ACTION_EVENT,
} from "../playground/lib/shell-events.ts";
import {
  dispatchConnectionBackendChange,
  dispatchDemoRun,
  dispatchFontFamilyChange,
  dispatchLoadLocalFonts,
  dispatchPtyUrlChange,
  dispatchTerminalClear,
  dispatchTerminalFontSizeChange,
  dispatchThemeFileChange,
  dispatchWebContainerCommandChange,
  dispatchWebContainerCwdChange,
} from "../playground/svelte/src/lib/shell-dispatch.ts";

test("dispatch helpers emit shell events with expected detail", () => {
  const target = new EventTarget();
  const seen: Array<{ type: string; detail: unknown }> = [];

  const record = (type: string) => (event: Event) => {
    seen.push({
      type,
      detail: (event as CustomEvent).detail ?? null,
    });
  };

  target.addEventListener(SHELL_COMMAND_EVENT, record(SHELL_COMMAND_EVENT));
  target.addEventListener(CONNECTION_INPUT_EVENT, record(CONNECTION_INPUT_EVENT));
  target.addEventListener(APPEARANCE_INPUT_EVENT, record(APPEARANCE_INPUT_EVENT));
  target.addEventListener(TERMINAL_ACTION_EVENT, record(TERMINAL_ACTION_EVENT));

  const file = new File(["theme"], "theme.conf");
  dispatchDemoRun("unicode", target);
  dispatchConnectionBackendChange("webcontainer", target);
  dispatchFontFamilyChange("jetbrains", target);
  dispatchPtyUrlChange("ws://localhost:8787/pty", target);
  dispatchTerminalFontSizeChange("22", target);
  dispatchThemeFileChange(file, target);
  dispatchWebContainerCommandChange("bash", target);
  dispatchWebContainerCwdChange("/tmp", target);
  dispatchLoadLocalFonts(target);
  dispatchTerminalClear(target);

  expect(seen).toEqual([
    { type: SHELL_COMMAND_EVENT, detail: { command: "run-demo", demoKind: "unicode" } },
    { type: CONNECTION_INPUT_EVENT, detail: { backend: "webcontainer" } },
    { type: APPEARANCE_INPUT_EVENT, detail: { fontFamily: "jetbrains" } },
    { type: CONNECTION_INPUT_EVENT, detail: { ptyUrl: "ws://localhost:8787/pty" } },
    { type: TERMINAL_ACTION_EVENT, detail: { fontSize: "22" } },
    { type: APPEARANCE_INPUT_EVENT, detail: { themeFile: file } },
    { type: CONNECTION_INPUT_EVENT, detail: { webContainerCommand: "bash" } },
    { type: CONNECTION_INPUT_EVENT, detail: { webContainerCwd: "/tmp" } },
    { type: APPEARANCE_INPUT_EVENT, detail: { action: "load-local-fonts" } },
    { type: TERMINAL_ACTION_EVENT, detail: { command: "clear" } },
  ]);
});

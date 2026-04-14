import { expect, test } from "bun:test";
import {
  CONNECTION_INPUT_EVENT,
  FONT_FAMILY_CHANGE_EVENT,
  LOAD_LOCAL_FONTS_EVENT,
  RUN_DEMO_EVENT,
  TERMINAL_ACTION_EVENT,
  THEME_FILE_CHANGE_EVENT,
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

  target.addEventListener(RUN_DEMO_EVENT, record(RUN_DEMO_EVENT));
  target.addEventListener(CONNECTION_INPUT_EVENT, record(CONNECTION_INPUT_EVENT));
  target.addEventListener(FONT_FAMILY_CHANGE_EVENT, record(FONT_FAMILY_CHANGE_EVENT));
  target.addEventListener(TERMINAL_ACTION_EVENT, record(TERMINAL_ACTION_EVENT));
  target.addEventListener(THEME_FILE_CHANGE_EVENT, record(THEME_FILE_CHANGE_EVENT));
  target.addEventListener(LOAD_LOCAL_FONTS_EVENT, record(LOAD_LOCAL_FONTS_EVENT));

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
    { type: RUN_DEMO_EVENT, detail: { kind: "unicode" } },
    { type: CONNECTION_INPUT_EVENT, detail: { backend: "webcontainer" } },
    { type: FONT_FAMILY_CHANGE_EVENT, detail: { value: "jetbrains" } },
    { type: CONNECTION_INPUT_EVENT, detail: { ptyUrl: "ws://localhost:8787/pty" } },
    { type: TERMINAL_ACTION_EVENT, detail: { fontSize: "22" } },
    { type: THEME_FILE_CHANGE_EVENT, detail: { file } },
    { type: CONNECTION_INPUT_EVENT, detail: { webContainerCommand: "bash" } },
    { type: CONNECTION_INPUT_EVENT, detail: { webContainerCwd: "/tmp" } },
    { type: LOAD_LOCAL_FONTS_EVENT, detail: null },
    { type: TERMINAL_ACTION_EVENT, detail: { command: "clear" } },
  ]);
});

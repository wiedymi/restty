import { expect, test } from "bun:test";
import {
  CONNECTION_BACKEND_CHANGE_EVENT,
  FONT_FAMILY_CHANGE_EVENT,
  LOAD_LOCAL_FONTS_EVENT,
  PTY_URL_CHANGE_EVENT,
  RUN_DEMO_EVENT,
  TERMINAL_ACTION_EVENT,
  THEME_FILE_CHANGE_EVENT,
  WC_COMMAND_CHANGE_EVENT,
  WC_CWD_CHANGE_EVENT,
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
  target.addEventListener(CONNECTION_BACKEND_CHANGE_EVENT, record(CONNECTION_BACKEND_CHANGE_EVENT));
  target.addEventListener(FONT_FAMILY_CHANGE_EVENT, record(FONT_FAMILY_CHANGE_EVENT));
  target.addEventListener(PTY_URL_CHANGE_EVENT, record(PTY_URL_CHANGE_EVENT));
  target.addEventListener(TERMINAL_ACTION_EVENT, record(TERMINAL_ACTION_EVENT));
  target.addEventListener(THEME_FILE_CHANGE_EVENT, record(THEME_FILE_CHANGE_EVENT));
  target.addEventListener(WC_COMMAND_CHANGE_EVENT, record(WC_COMMAND_CHANGE_EVENT));
  target.addEventListener(WC_CWD_CHANGE_EVENT, record(WC_CWD_CHANGE_EVENT));
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
    { type: CONNECTION_BACKEND_CHANGE_EVENT, detail: { value: "webcontainer" } },
    { type: FONT_FAMILY_CHANGE_EVENT, detail: { value: "jetbrains" } },
    { type: PTY_URL_CHANGE_EVENT, detail: { value: "ws://localhost:8787/pty" } },
    { type: TERMINAL_ACTION_EVENT, detail: { fontSize: "22" } },
    { type: THEME_FILE_CHANGE_EVENT, detail: { file } },
    { type: WC_COMMAND_CHANGE_EVENT, detail: { value: "bash" } },
    { type: WC_CWD_CHANGE_EVENT, detail: { value: "/tmp" } },
    { type: LOAD_LOCAL_FONTS_EVENT, detail: null },
    { type: TERMINAL_ACTION_EVENT, detail: { command: "clear" } },
  ]);
});

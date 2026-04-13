import { expect, test } from "bun:test";
import {
  FONT_FAMILY_CHANGE_EVENT,
  LOAD_LOCAL_FONTS_EVENT,
  RUN_DEMO_EVENT,
  TERMINAL_CLEAR_EVENT,
  TERMINAL_FONT_SIZE_EVENT,
  THEME_FILE_CHANGE_EVENT,
} from "../playground/lib/shell-events.ts";
import {
  dispatchDemoRun,
  dispatchFontFamilyChange,
  dispatchLoadLocalFonts,
  dispatchTerminalClear,
  dispatchTerminalFontSizeChange,
  dispatchThemeFileChange,
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
  target.addEventListener(FONT_FAMILY_CHANGE_EVENT, record(FONT_FAMILY_CHANGE_EVENT));
  target.addEventListener(TERMINAL_FONT_SIZE_EVENT, record(TERMINAL_FONT_SIZE_EVENT));
  target.addEventListener(THEME_FILE_CHANGE_EVENT, record(THEME_FILE_CHANGE_EVENT));
  target.addEventListener(LOAD_LOCAL_FONTS_EVENT, record(LOAD_LOCAL_FONTS_EVENT));
  target.addEventListener(TERMINAL_CLEAR_EVENT, record(TERMINAL_CLEAR_EVENT));

  const file = new File(["theme"], "theme.conf");
  dispatchDemoRun("unicode", target);
  dispatchFontFamilyChange("jetbrains", target);
  dispatchTerminalFontSizeChange("22", target);
  dispatchThemeFileChange(file, target);
  dispatchLoadLocalFonts(target);
  dispatchTerminalClear(target);

  expect(seen).toEqual([
    { type: RUN_DEMO_EVENT, detail: { kind: "unicode" } },
    { type: FONT_FAMILY_CHANGE_EVENT, detail: { value: "jetbrains" } },
    { type: TERMINAL_FONT_SIZE_EVENT, detail: { value: "22" } },
    { type: THEME_FILE_CHANGE_EVENT, detail: { file } },
    { type: LOAD_LOCAL_FONTS_EVENT, detail: null },
    { type: TERMINAL_CLEAR_EVENT, detail: null },
  ]);
});

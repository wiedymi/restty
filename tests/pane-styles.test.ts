import { expect, test } from "bun:test";
import {
  DEFAULT_RESTTY_PANE_STYLE_OPTIONS,
  normalizePaneStyleOptions,
} from "../src/surface/panes/styles.ts";

test("normalizePaneStyleOptions carries a visible divider color", () => {
  expect(DEFAULT_RESTTY_PANE_STYLE_OPTIONS.dividerColor).toBe("#242424");
  expect(normalizePaneStyleOptions({}).dividerColor).toBe("#242424");
  expect(normalizePaneStyleOptions({ dividerColor: "  #101010  " }).dividerColor).toBe(
    "#101010",
  );
});

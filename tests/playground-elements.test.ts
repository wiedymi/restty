import { expect, test } from "bun:test";
import { queryPlaygroundElements } from "../playground/lib/elements.ts";

test("queryPlaygroundElements returns the required pane root and optional controls", () => {
  const paneRoot = { id: "paneRoot" };
  const rendererSelect = { id: "rendererSelect", value: "auto" };
  const settingsDialog = { id: "settingsDialog", open: false };
  const elements = new Map<string, unknown>([
    ["paneRoot", paneRoot],
    ["rendererSelect", rendererSelect],
    ["settingsDialog", settingsDialog],
  ]);

  const queried = queryPlaygroundElements({
    getElementById: (id) => (elements.get(id) ?? null) as HTMLElement | null,
  });

  expect(queried.paneRoot).toBe(paneRoot);
  expect(queried.rendererSelect).toBe(rendererSelect);
  expect(queried.settingsDialog).toBe(settingsDialog);
  expect(queried.btnInit).toBeNull();
});

test("queryPlaygroundElements throws when the required pane root is missing", () => {
  expect(() =>
    queryPlaygroundElements({
      getElementById: () => null,
    }),
  ).toThrow("missing #paneRoot element");
});

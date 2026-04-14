import { expect, test } from "bun:test";
import { queryPlaygroundElements } from "../playground/lib/elements.ts";

test("queryPlaygroundElements returns the required root and control elements", () => {
  const paneRoot = { id: "paneRoot" };
  const settingsDialog = { id: "settingsDialog", open: false };
  const rendererSelect = { id: "rendererSelect", value: "auto" };
  const settingsFab = { id: "settingsFab" };
  const elements = new Map<string, unknown>([
    ["paneRoot", paneRoot],
    ["settingsDialog", settingsDialog],
    ["rendererSelect", rendererSelect],
    ["settingsFab", settingsFab],
  ]);

  const queried = queryPlaygroundElements({
    getElementById: (id) => (elements.get(id) ?? null) as HTMLElement | null,
  });

  expect(queried.paneRoot).toBe(paneRoot);
  expect(queried.settingsDialog).toBe(settingsDialog);
  expect(queried.rendererSelect).toBe(rendererSelect);
  expect(queried.settingsFab).toBe(settingsFab);
  expect(queried.btnInit).toBeNull();
});

test("queryPlaygroundElements throws when the required pane root is missing", () => {
  expect(() =>
    queryPlaygroundElements({
      getElementById: () => null,
    }),
  ).toThrow("missing #paneRoot element");
});

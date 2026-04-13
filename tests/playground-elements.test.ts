import { expect, test } from "bun:test";
import {
  createEmptyLegacyPlaygroundElements,
  queryLegacyPlaygroundElements,
  querySharedPlaygroundElements,
} from "../playground/lib/elements.ts";

test("querySharedPlaygroundElements returns the required shared elements", () => {
  const paneRoot = { id: "paneRoot" };
  const settingsDialog = { id: "settingsDialog", open: false };
  const elements = new Map<string, unknown>([
    ["paneRoot", paneRoot],
    ["settingsDialog", settingsDialog],
  ]);

  const queried = querySharedPlaygroundElements({
    getElementById: (id) => (elements.get(id) ?? null) as HTMLElement | null,
  });

  expect(queried.paneRoot).toBe(paneRoot);
  expect(queried.settingsDialog).toBe(settingsDialog);
});

test("querySharedPlaygroundElements throws when the required pane root is missing", () => {
  expect(() =>
    querySharedPlaygroundElements({
      getElementById: () => null,
    }),
  ).toThrow("missing #paneRoot element");
});

test("queryLegacyPlaygroundElements looks up only legacy controls", () => {
  const calls: string[] = [];
  const rendererSelect = { id: "rendererSelect", value: "auto" };
  const settingsFab = { id: "settingsFab" };
  const queried = queryLegacyPlaygroundElements({
    getElementById: (id) => {
      calls.push(id);
      if (id === "rendererSelect") return rendererSelect as HTMLElement;
      if (id === "settingsFab") return settingsFab as HTMLElement;
      return null;
    },
  });

  expect(calls).not.toContain("paneRoot");
  expect(calls).not.toContain("settingsDialog");
  expect(queried.rendererSelect).toBe(rendererSelect);
  expect(queried.settingsFab).toBe(settingsFab);
  expect(queried.btnInit).toBeNull();
});

test("createEmptyLegacyPlaygroundElements returns nulls for every legacy field", () => {
  const queried = createEmptyLegacyPlaygroundElements();

  expect(queried.btnInit).toBeNull();
  expect(queried.rendererSelect).toBeNull();
  expect(queried.connectionBackendEl).toBeNull();
  expect(queried.themeFileInput).toBeNull();
  expect(queried.settingsFab).toBeNull();
});

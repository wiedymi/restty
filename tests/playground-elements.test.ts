import { expect, test } from "bun:test";
import { queryPlaygroundElements } from "../playground/lib/elements.ts";

test("queryPlaygroundElements returns the required root elements", () => {
  const paneRoot = { id: "paneRoot" };
  const elements = new Map<string, unknown>([["paneRoot", paneRoot]]);

  const queried = queryPlaygroundElements({
    getElementById: (id) => (elements.get(id) ?? null) as HTMLElement | null,
  });

  expect(queried.paneRoot).toBe(paneRoot);
});

test("queryPlaygroundElements throws when the required pane root is missing", () => {
  expect(() =>
    queryPlaygroundElements({
      getElementById: () => null,
    }),
  ).toThrow("missing #paneRoot element");
});

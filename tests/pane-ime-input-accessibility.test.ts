import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("createImeInput keeps IME textarea focusable without aria-hidden", () => {
  const source = readFileSync(join(process.cwd(), "src/surface/panes/managed-pane-dom.ts"), "utf8");
  const bodyMatch = source.match(/function createImeInput[\s\S]*?return imeInput;\n\}/);
  const body = bodyMatch?.[0] ?? "";
  expect(body.length > 0).toBe(true);
  expect(body.includes("imeInput.tabIndex = -1;")).toBe(true);
  expect(body.includes("aria-hidden")).toBe(false);
});

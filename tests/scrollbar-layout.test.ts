import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("overlay scrollbar layout uses fixed thickness and dynamic thumb sizing", () => {
  const source = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/overlay-scrollbar.ts"),
    "utf8",
  );
  const bodyMatch = source.match(
    /export function computeOverlayScrollbarLayout\([\s\S]*?\): OverlayScrollbarLayout \| null \{[\s\S]*?return \{ total, offset, len, denom, width, trackX, trackY, trackH, thumbY, thumbH \};\n\}/,
  );
  const body = bodyMatch?.[0] ?? "";
  expect(body.length > 0).toBe(true);
  expect(body.includes("OVERLAY_SCROLLBAR_WIDTH_CSS_PX")).toBe(true);
  expect(body.includes("OVERLAY_SCROLLBAR_MARGIN_CSS_PX")).toBe(true);
  expect(body.includes("OVERLAY_SCROLLBAR_MIN_THUMB_CSS_PX")).toBe(true);
  expect(body.includes("canvasHeight")).toBe(true);
  expect(body.includes("len / total")).toBe(true);
  expect(body.includes("cellW")).toBe(false);
  expect(body.includes("cellH")).toBe(false);
});

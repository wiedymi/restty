import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSymbolCp } from "../src/renderer/shapes";

test("symbol-like classification follows Ghostty's precomputed table", () => {
  expect(isSymbolCp(0x2192)).toBe(true); // →
  expect(isSymbolCp(0x1f680)).toBe(true); // 🚀
  expect(isSymbolCp(0x23f5)).toBe(false); // ⏵
  expect(isSymbolCp(0x25a3)).toBe(false); // ▣
  expect(isSymbolCp(0x2b1d)).toBe(false); // ⬝
  expect(isSymbolCp(0x41)).toBe(false); // A
});

test("both render loops apply default centered symbol constraint", () => {
  const source = readFileSync(join(process.cwd(), "src/app/index.ts"), "utf8");
  const matches =
    source.match(
      /const constraint =\s+nerdConstraint \?\? \(colorGlyph \? DEFAULT_EMOJI_CONSTRAINT : DEFAULT_SYMBOL_CONSTRAINT\);/g,
    ) ?? [];
  expect(matches.length).toBe(2);
});

test("nerd constraints are keyed by codepoint, not font label", () => {
  const source = readFileSync(join(process.cwd(), "src/app/index.ts"), "utf8");
  const byCodepoint =
    source.match(/const nerdConstraint = symbolLike \? resolveSymbolConstraint\(cp\) : null;/g) ?? [];
  const perItem = source.match(/const nerdConstraint = resolveSymbolConstraint\(item\.cp\);/g) ?? [];
  expect(byCodepoint.length).toBe(2);
  expect(perItem.length).toBe(2);
});

test("render path uses generic symbol handling without per-codepoint override table", () => {
  const source = readFileSync(join(process.cwd(), "src/app/index.ts"), "utf8");
  expect(source.includes("const PARITY_SYMBOL_OVERRIDES")).toBe(false);
  expect(source.includes("[0x2300, 0x23ff]")).toBe(true);
  expect(source.includes("[0x25a0, 0x25ff]")).toBe(true);
  expect(source.includes("[0x2b00, 0x2bff]")).toBe(true);
  expect(source.includes("align_vertical: \"center\"")).toBe(true);
  expect(source.includes("align_horizontal: \"center\"")).toBe(true);
  expect(source.includes("const DEFAULT_EMOJI_CONSTRAINT")).toBe(true);
  expect(source.includes("size: \"cover\"")).toBe(true);
  const renderSymbolChecks = source.match(/const symbolLike = isRenderSymbolLike\(cp\);/g) ?? [];
  expect(renderSymbolChecks.length).toBe(2);
});

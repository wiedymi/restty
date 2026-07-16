import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSymbolCp } from "../src/renderer/shapes";
import {
  isRenderSymbolLike,
  resolveSymbolConstraint,
} from "../src/runtime/create-runtime/runtime-symbols";

test("symbol-like classification follows Ghostty's precomputed table", () => {
  expect(isSymbolCp(0x2192)).toBe(true); // →
  expect(isSymbolCp(0x1f680)).toBe(true); // 🚀
  expect(isSymbolCp(0x23f5)).toBe(false); // ⏵
  expect(isSymbolCp(0x25a3)).toBe(false); // ▣
  expect(isSymbolCp(0x2b1d)).toBe(false); // ⬝
  expect(isSymbolCp(0x41)).toBe(false); // A
});

test("both render loops apply Ghostty-style default symbol constraint", () => {
  const webgpuSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgpu-emit-glyphs.ts"),
    "utf8",
  );
  const webglSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgl-glyph-pipeline.ts"),
    "utf8",
  );
  const defaultConstraintPattern =
    /const defaultConstraint = isAppleSymbolsFont\(entry\)\s+\?\s+DEFAULT_APPLE_SYMBOLS_CONSTRAINT\s+:\s+DEFAULT_SYMBOL_CONSTRAINT;/g;
  expect((webgpuSource.match(defaultConstraintPattern) ?? []).length).toBe(1);
  expect((webglSource.match(defaultConstraintPattern) ?? []).length).toBe(1);

  const constraintPattern =
    /const constraint =\s+nerdConstraint \?\? \(colorGlyph \? DEFAULT_EMOJI_CONSTRAINT : defaultConstraint\);/g;
  expect((webgpuSource.match(constraintPattern) ?? []).length).toBe(1);
  expect((webglSource.match(constraintPattern) ?? []).length).toBe(1);
});

test("nerd constraints are keyed by codepoint, not font label", () => {
  const webgpuCellSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgpu-cell-pass.ts"),
    "utf8",
  );
  const webglSceneSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgl-scene.ts"),
    "utf8",
  );
  const webgpuEmitSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgpu-emit-glyphs.ts"),
    "utf8",
  );
  const webglPipelineSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgl-glyph-pipeline.ts"),
    "utf8",
  );
  const byCodepointPattern = /const nerdConstraint = resolveSymbolConstraint\(cp\);/g;
  expect((webgpuCellSource.match(byCodepointPattern) ?? []).length).toBe(1);
  expect((webglSceneSource.match(byCodepointPattern) ?? []).length).toBe(1);
  const perItemPattern = /const nerdConstraint = resolveSymbolConstraint\(item\.cp\);/g;
  expect((webgpuEmitSource.match(perItemPattern) ?? []).length).toBe(1);
  expect((webglPipelineSource.match(perItemPattern) ?? []).length).toBe(1);
});

test("render path uses generic symbol handling without per-codepoint override table", () => {
  const webgpuCellSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgpu-cell-pass.ts"),
    "utf8",
  );
  const webglSceneSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgl-scene.ts"),
    "utf8",
  );
  const symbolSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/runtime-symbols.ts"),
    "utf8",
  );
  expect(symbolSource.includes("[0x2300, 0x23ff]")).toBe(false);
  expect(symbolSource.includes("[0x25a0, 0x25ff]")).toBe(true);
  expect(symbolSource.includes("[0x2b00, 0x2bff]")).toBe(true);
  const defaultConstraintBlock =
    symbolSource.match(/export const DEFAULT_SYMBOL_CONSTRAINT:[\s\S]*?};/m)?.[0] ?? "";
  expect(defaultConstraintBlock.includes('size: "fit"')).toBe(true);
  expect(defaultConstraintBlock.includes("align_vertical")).toBe(false);
  expect(defaultConstraintBlock.includes("align_horizontal")).toBe(false);
  const appleConstraintBlock =
    symbolSource.match(/export const DEFAULT_APPLE_SYMBOLS_CONSTRAINT:[\s\S]*?};/m)?.[0] ?? "";
  expect(appleConstraintBlock.includes('size: "fit_cover1"')).toBe(true);
  expect(appleConstraintBlock.includes('align_vertical: "center"')).toBe(true);
  expect(symbolSource.includes("const DEFAULT_EMOJI_CONSTRAINT")).toBe(true);
  expect(symbolSource.includes('size: "cover"')).toBe(true);
  const symbolLikePattern = /const symbolLike = isRenderSymbolLike\(cp\) \|\| !!nerdConstraint;/g;
  expect((webgpuCellSource.match(symbolLikePattern) ?? []).length).toBe(1);
  expect((webglSceneSource.match(symbolLikePattern) ?? []).length).toBe(1);
  const symbolFontDrivenPattern = /isRenderSymbolLike\(cp\) \|\| isSymbolFont\(fontEntry\)/g;
  expect((webgpuCellSource.match(symbolFontDrivenPattern) ?? []).length).toBe(0);
  expect((webglSceneSource.match(symbolFontDrivenPattern) ?? []).length).toBe(0);
});

test("render loops skip fallback baseline adjustment for non-Nerd symbol-like glyphs", () => {
  const webgpuSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgpu-emit-glyphs.ts"),
    "utf8",
  );
  const webglSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgl-glyph-pipeline.ts"),
    "utf8",
  );
  const pattern =
    /const glyphBaselineAdjust = symbolLike && !symbolConstraint \? 0 : baselineAdjust;/g;
  expect((webgpuSource.match(pattern) ?? []).length).toBe(1);
  expect((webglSource.match(pattern) ?? []).length).toBe(1);
});

test("symbol constraint width rule is applied for all symbol-like glyphs", () => {
  const webgpuCellSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgpu-cell-pass.ts"),
    "utf8",
  );
  const webglSceneSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgl-scene.ts"),
    "utf8",
  );
  const legacyGuard = /if \(nerdConstraint\?\.height === "icon"\)/g;
  expect((webgpuCellSource.match(legacyGuard) ?? []).length).toBe(0);
  expect((webglSceneSource.match(legacyGuard) ?? []).length).toBe(0);
});

test("symbol constraints remain table-driven without per-codepoint overrides", () => {
  const symbolSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/runtime-symbols.ts"),
    "utf8",
  );
  expect(symbolSource.includes("cp === 0x15e3")).toBe(false);
  expect(symbolSource.includes("RENDERER_SYMBOL_FALLBACK_CODEPOINTS")).toBe(false);
  expect(isRenderSymbolLike(0x15e3)).toBe(false);
  expect(resolveSymbolConstraint(0x15e3)).toBeNull();
});

test("fallback font scaling routes primary-em wide faces through the shared resolver", () => {
  const webgpuSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgpu-cell-pass.ts"),
    "utf8",
  );
  const webglSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgl-context.ts"),
    "utf8",
  );
  const metricOrderPattern = /"ic_width",\s+"ex_height",\s+"cap_height",\s+"line_height"/g;
  expect((webgpuSource.match(metricOrderPattern) ?? []).length).toBeGreaterThanOrEqual(1);
  expect((webglSource.match(metricOrderPattern) ?? []).length).toBeGreaterThanOrEqual(1);
  const upscaleOnlyPattern = /clamp\(fallbackScaleAdjustment\(primaryEntry, entry\), 1, 2\)/g;
  expect((webgpuSource.match(upscaleOnlyPattern) ?? []).length).toBe(1);
  expect((webglSource.match(upscaleOnlyPattern) ?? []).length).toBe(1);
  const sharedScalePattern = /resolveFallbackTextScale\(\{/g;
  expect((webgpuSource.match(sharedScalePattern) ?? []).length).toBe(1);
  expect((webglSource.match(sharedScalePattern) ?? []).length).toBe(1);
});

test("fallback glyph clamp avoids width bbox shrinking in emit paths", () => {
  const webgpuSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgpu-emit-glyphs.ts"),
    "utf8",
  );
  const webglSource = readFileSync(
    join(process.cwd(), "src/runtime/create-runtime/render-tick-webgl-glyph-pipeline.ts"),
    "utf8",
  );
  const widthClampPattern = /maxWidth \/ metrics\.width/g;
  expect((webgpuSource.match(widthClampPattern) ?? []).length).toBe(0);
  expect((webglSource.match(widthClampPattern) ?? []).length).toBe(0);
  const heightClampPattern = /const clampScale = Math\.min\(1, heightScale\);/g;
  expect((webgpuSource.match(heightClampPattern) ?? []).length).toBe(1);
  expect((webglSource.match(heightClampPattern) ?? []).length).toBe(1);
  const widthSafetyPattern = /if \(gw > maxWidth && gw > 0\) \{/g;
  expect((webgpuSource.match(widthSafetyPattern) ?? []).length).toBe(0);
  expect((webglSource.match(widthSafetyPattern) ?? []).length).toBe(0);
  const fallbackAdvanceFitPattern = /if \(!symbolLike && fontIndex === 0\) \{/g;
  expect((webgpuSource.match(fallbackAdvanceFitPattern) ?? []).length).toBe(1);
  expect((webglSource.match(fallbackAdvanceFitPattern) ?? []).length).toBe(1);
  const symbolLayoutPattern =
    /const applySymbolLayout = symbolLike && \(fontIndex > 0 \|\| symbolConstraint \|\| colorGlyph\);/g;
  expect((webgpuSource.match(symbolLayoutPattern) ?? []).length).toBe(1);
  expect((webglSource.match(symbolLayoutPattern) ?? []).length).toBe(1);
});

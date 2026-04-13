import { expect, test } from "bun:test";
import { shaderStagesForPreset, type ShaderPreset } from "../playground/lib/shader-presets.ts";

const presets: Array<{ preset: Exclude<ShaderPreset, "none">; id: string }> = [
  { preset: "scanline", id: "playground/scanline" },
  { preset: "aurora", id: "playground/aurora" },
  { preset: "crt-lite", id: "playground/crt-lite" },
  { preset: "mono-green", id: "playground/mono-green" },
];

test('shaderStagesForPreset returns no stages for "none"', () => {
  expect(shaderStagesForPreset("none")).toEqual([]);
});

for (const { preset, id } of presets) {
  test(`shaderStagesForPreset maps ${preset} to the expected stage`, () => {
    const stages = shaderStagesForPreset(preset);

    expect(stages).toHaveLength(1);
    expect(stages[0]).toMatchObject({
      id,
      mode: "after-main",
    });
    expect(stages[0]?.shader?.wgsl).toContain("resttyStage");
    expect(stages[0]?.shader?.glsl).toContain("resttyStage");
  });
}

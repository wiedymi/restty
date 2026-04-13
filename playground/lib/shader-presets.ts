import type { ResttyShaderStage } from "../../src/index.ts";

export type ShaderPreset = "none" | "scanline" | "aurora" | "crt-lite" | "mono-green";

export function shaderStagesForPreset(preset: ShaderPreset): ResttyShaderStage[] {
  if (preset === "scanline") {
    return [
      {
        id: "playground/scanline",
        mode: "after-main",
        uniforms: [0.38, 1.0],
        shader: {
          wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let strength = clamp(params0.x, 0.0, 0.85);
  let speed = max(params0.y, 0.1);
  let stripes = 0.5 + 0.5 * sin(uv.y * 1800.0 + time * 1.8 * speed);
  let darken = 1.0 - strength * (0.15 + 0.85 * stripes);
  let beam = 1.0 + 0.04 * strength * sin(uv.y * 90.0 - time * 5.0 * speed);
  let outColor = color.rgb * darken * beam;
  return vec4f(min(vec3f(1.0), outColor), color.a);
}
`,
          glsl: `
vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) {
  float strength = clamp(params0.x, 0.0, 0.85);
  float speed = max(params0.y, 0.1);
  float stripes = 0.5 + 0.5 * sin(uv.y * 1800.0 + time * 1.8 * speed);
  float darken = 1.0 - strength * (0.15 + 0.85 * stripes);
  float beam = 1.0 + 0.04 * strength * sin(uv.y * 90.0 - time * 5.0 * speed);
  vec3 outColor = color.rgb * darken * beam;
  return vec4(min(vec3(1.0), outColor), color.a);
}
`,
        },
      },
    ];
  }

  if (preset === "aurora") {
    return [
      {
        id: "playground/aurora",
        mode: "after-main",
        uniforms: [0.28, 1.0],
        shader: {
          wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let mixAmount = clamp(params0.x, 0.0, 0.65);
  let speed = max(params0.y, 0.1);
  let phase = time * speed + uv.y * 14.0 + uv.x * 3.5;
  let wave0 = 0.5 + 0.5 * sin(phase);
  let wave1 = 0.5 + 0.5 * sin(phase * 1.37 + 2.1);
  let wave2 = 0.5 + 0.5 * sin(phase * 0.73 + 4.2);
  let tint = vec3f(
    0.12 + wave0 * 0.28,
    0.08 + wave1 * 0.32,
    0.18 + wave2 * 0.24
  );
  let sparkle = 1.0 + 0.06 * sin((uv.x * 120.0 + uv.y * 42.0) + time * 4.0 * speed);
  let boosted = min(vec3f(1.0), color.rgb * sparkle);
  let outColor = mix(color.rgb, min(vec3f(1.0), boosted + tint * 0.35), mixAmount);
  return vec4f(outColor, color.a);
}
`,
          glsl: `
vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) {
  float mixAmount = clamp(params0.x, 0.0, 0.65);
  float speed = max(params0.y, 0.1);
  float phase = time * speed + uv.y * 14.0 + uv.x * 3.5;
  float wave0 = 0.5 + 0.5 * sin(phase);
  float wave1 = 0.5 + 0.5 * sin(phase * 1.37 + 2.1);
  float wave2 = 0.5 + 0.5 * sin(phase * 0.73 + 4.2);
  vec3 tint = vec3(
    0.12 + wave0 * 0.28,
    0.08 + wave1 * 0.32,
    0.18 + wave2 * 0.24
  );
  float sparkle = 1.0 + 0.06 * sin((uv.x * 120.0 + uv.y * 42.0) + time * 4.0 * speed);
  vec3 boosted = min(vec3(1.0), color.rgb * sparkle);
  vec3 outColor = mix(color.rgb, min(vec3(1.0), boosted + tint * 0.35), mixAmount);
  return vec4(outColor, color.a);
}
`,
        },
      },
    ];
  }

  if (preset === "crt-lite") {
    return [
      {
        id: "playground/crt-lite",
        mode: "after-main",
        uniforms: [0.24, 0.12],
        shader: {
          wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let vignetteStrength = clamp(params0.x, 0.0, 0.7);
  let maskStrength = clamp(params0.y, 0.0, 0.35);
  let centered = (uv - vec2f(0.5, 0.5)) * 2.0;
  let vignette = max(0.0, 1.0 - vignetteStrength * dot(centered, centered));
  let scan = 0.92 + 0.08 * (0.5 + 0.5 * sin(uv.y * 1400.0));
  let phase = uv.x * 1400.0;
  let mask = vec3f(
    1.0 + maskStrength * sin(phase),
    1.0 + maskStrength * sin(phase + 2.094),
    1.0 + maskStrength * sin(phase + 4.188)
  );
  let flicker = 1.0 + 0.012 * sin(time * 64.0);
  let outColor = min(vec3f(1.0), color.rgb * vignette * scan * flicker * mask);
  return vec4f(outColor, color.a);
}
`,
          glsl: `
vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) {
  float vignetteStrength = clamp(params0.x, 0.0, 0.7);
  float maskStrength = clamp(params0.y, 0.0, 0.35);
  vec2 centered = (uv - vec2(0.5)) * 2.0;
  float vignette = max(0.0, 1.0 - vignetteStrength * dot(centered, centered));
  float scan = 0.92 + 0.08 * (0.5 + 0.5 * sin(uv.y * 1400.0));
  float phase = uv.x * 1400.0;
  vec3 mask = vec3(
    1.0 + maskStrength * sin(phase),
    1.0 + maskStrength * sin(phase + 2.094),
    1.0 + maskStrength * sin(phase + 4.188)
  );
  float flicker = 1.0 + 0.012 * sin(time * 64.0);
  vec3 outColor = min(vec3(1.0), color.rgb * vignette * scan * flicker * mask);
  return vec4(outColor, color.a);
}
`,
        },
      },
    ];
  }

  if (preset === "mono-green") {
    return [
      {
        id: "playground/mono-green",
        mode: "after-main",
        uniforms: [1.0],
        shader: {
          wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let gain = clamp(params0.x, 0.25, 2.0);
  let luma = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
  return vec4f(luma * 0.12 * gain, luma * 0.95 * gain, luma * 0.35 * gain, color.a);
}
`,
          glsl: `
vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1) {
  float gain = clamp(params0.x, 0.25, 2.0);
  float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
  return vec4(luma * 0.12 * gain, luma * 0.95 * gain, luma * 0.35 * gain, color.a);
}
`,
        },
      },
    ];
  }

  return [];
}

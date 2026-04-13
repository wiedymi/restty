export const STAGE_UNIFORM_BUFFER_FLOATS = 12;

export const FULLSCREEN_STAGE_VERTEX_SHADER_GL = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_quad;
out vec2 v_uv;
void main() {
  v_uv = a_quad;
  vec2 clip = vec2(a_quad.x * 2.0 - 1.0, 1.0 - a_quad.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

export const FULLSCREEN_STAGE_SHADER_GL_PREFIX = `#version 300 es
precision highp float;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_params0;
uniform vec4 u_params1;
in vec2 v_uv;
out vec4 fragColor;
`;

export const FULLSCREEN_STAGE_SHADER_GL_SUFFIX = `
void main() {
  vec4 color = texture(u_source, v_uv);
  fragColor = resttyStage(color, v_uv, u_time, u_params0, u_params1);
}
`;

export const FULLSCREEN_STAGE_SHADER_WGSL_PREFIX = `
struct StageUniforms {
  resolution: vec2f,
  time: f32,
  _pad0: f32,
  params0: vec4f,
  params1: vec4f,
};

@group(0) @binding(0) var sourceSampler: sampler;
@group(0) @binding(1) var sourceTex: texture_2d<f32>;
@group(0) @binding(2) var<uniform> stageUniforms: StageUniforms;

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsMain(@location(0) quad: vec2f) -> VSOut {
  var out: VSOut;
  out.uv = quad;
  let clip = vec2f(quad.x * 2.0 - 1.0, 1.0 - quad.y * 2.0);
  out.position = vec4f(clip.x, clip.y, 0.0, 1.0);
  return out;
}
`;

export const FULLSCREEN_STAGE_SHADER_WGSL_SUFFIX = `
@fragment
fn fsMain(input: VSOut) -> @location(0) vec4f {
  let color = textureSample(sourceTex, sourceSampler, input.uv);
  return resttyStage(
    color,
    input.uv,
    stageUniforms.time,
    stageUniforms.params0,
    stageUniforms.params1,
  );
}
`;

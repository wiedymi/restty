/** WebGPU WGSL shader for rendering solid-color rectangles. */
export const RECT_SHADER = `
struct Uniforms {
  res: vec2f,
  _pad: vec2f,
  blend: vec2f,
  _pad2: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VSIn {
  @location(0) quad: vec2f,
  @location(1) pos: vec2f,
  @location(2) size: vec2f,
  @location(3) color: vec4f,
};

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

// sRGB to linear conversion for proper blending
fn srgbToLinear(c: f32) -> f32 {
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return pow((c + 0.055) / 1.055, 2.4);
}

fn srgbToLinear3(c: vec3f) -> vec3f {
  return vec3f(srgbToLinear(c.x), srgbToLinear(c.y), srgbToLinear(c.z));
}

@vertex
fn vsMain(input: VSIn) -> VSOut {
  let pixel = input.pos + input.quad * input.size;
  let clip = vec2f(
    (pixel.x / uniforms.res.x) * 2.0 - 1.0,
    1.0 - (pixel.y / uniforms.res.y) * 2.0
  );

  var out: VSOut;
  out.position = vec4f(clip.x, clip.y, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment
fn fsMain(input: VSOut) -> @location(0) vec4f {
  let useLinear = uniforms.blend.x > 0.5;
  var color = input.color;
  if (useLinear) {
    color = vec4f(srgbToLinear3(color.rgb), color.a);
  }
  color = vec4f(color.rgb * color.a, color.a);
  return color;
}
`;

/** WebGL2 vertex shader for rendering solid-color rectangles. */
export const RECT_SHADER_GL_VERT = `#version 300 es
precision highp float;

uniform vec2 u_resolution;

layout(location = 0) in vec2 a_quad;
layout(location = 1) in vec2 a_pos;
layout(location = 2) in vec2 a_size;
layout(location = 3) in vec4 a_color;

out vec4 v_color;

void main() {
  vec2 pixel = a_pos + a_quad * a_size;
  vec2 clip = vec2(
    (pixel.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (pixel.y / u_resolution.y) * 2.0
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = a_color;
}
`;

/** WebGL2 fragment shader for rendering solid-color rectangles with alpha blending. */
export const RECT_SHADER_GL_FRAG = `#version 300 es
precision highp float;

uniform vec2 u_blend;

in vec4 v_color;
out vec4 fragColor;

// sRGB to linear conversion for proper blending
float srgbToLinear(float c) {
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return pow((c + 0.055) / 1.055, 2.4);
}

vec3 srgbToLinear(vec3 c) {
  return vec3(srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b));
}

void main() {
  bool useLinear = u_blend.x > 0.5;
  vec4 color = v_color;
  if (useLinear) {
    color.rgb = srgbToLinear(color.rgb);
  }
  color.rgb *= color.a;
  fragColor = color;
}
`;

/** WebGL2 vertex shader for rendering textured glyph quads. */
export const GLYPH_SHADER_GL_VERT = `#version 300 es
precision highp float;

uniform vec2 u_resolution;

layout(location = 0) in vec2 a_quad;
layout(location = 1) in vec2 a_pos;
layout(location = 2) in vec2 a_size;
layout(location = 3) in vec2 a_uv0;
layout(location = 4) in vec2 a_uv1;
layout(location = 5) in vec4 a_color;
layout(location = 6) in vec4 a_bg;
layout(location = 7) in float a_slant;
layout(location = 8) in float a_mode;

out vec2 v_uv;
out vec4 v_color;
out vec4 v_bg;
out float v_mode;

void main() {
  vec2 pixel = a_pos + vec2(a_quad.x * a_size.x + a_slant * (1.0 - a_quad.y), a_quad.y * a_size.y);
  vec2 clip = vec2(
    (pixel.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (pixel.y / u_resolution.y) * 2.0
  );
  v_uv = a_uv0 + (a_uv1 - a_uv0) * a_quad;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = a_color;
  v_bg = a_bg;
  v_mode = a_mode;
}
`;

/** WebGL2 fragment shader for sampling glyph atlas textures with linear filtering. */
export const GLYPH_SHADER_GL_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_atlas;
uniform vec2 u_blend;

in vec2 v_uv;
in vec4 v_color;
in vec4 v_bg;
in float v_mode;
out vec4 fragColor;

// sRGB to linear conversion for proper blending
float srgbToLinear(float c) {
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return pow((c + 0.055) / 1.055, 2.4);
}

// Linear to sRGB conversion
float linearToSrgb(float c) {
  if (c <= 0.0031308) {
    return c * 12.92;
  }
  return 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

vec3 srgbToLinear(vec3 c) {
  return vec3(srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b));
}

vec3 linearToSrgb(vec3 c) {
  return vec3(linearToSrgb(c.r), linearToSrgb(c.g), linearToSrgb(c.b));
}

float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec4 atlasSample = texture(u_atlas, v_uv);
  bool useLinear = u_blend.x > 0.5;
  bool useCorrection = u_blend.y > 0.5;

  if (v_mode > 0.5) {
    vec4 color = atlasSample;
    if (useLinear) {
      color.rgb = srgbToLinear(color.rgb);
    }
    color.rgb *= color.a;
    fragColor = color;
    return;
  }

  vec4 fg = v_color;
  vec4 bg = v_bg;
  if (useLinear) {
    fg.rgb = srgbToLinear(fg.rgb);
    bg.rgb = srgbToLinear(bg.rgb);
  }
  fg.rgb *= fg.a;
  bg.rgb *= bg.a;

  float alpha = atlasSample.a;
  if (useCorrection && useLinear) {
    float fg_l = luminance(fg.rgb);
    float bg_l = luminance(bg.rgb);
    if (abs(fg_l - bg_l) > 0.001) {
      float blend_l = srgbToLinear(linearToSrgb(fg_l) * alpha + linearToSrgb(bg_l) * (1.0 - alpha));
      alpha = clamp((blend_l - bg_l) / (fg_l - bg_l), 0.0, 1.0);
    }
  }

  vec4 color = fg * alpha;
  fragColor = color;
}
`;

/** WebGPU WGSL shader for rendering textured glyph quads with linear atlas sampling. */
export const GLYPH_SHADER = `
struct Uniforms {
  res: vec2f,
  _pad: vec2f,
  blend: vec2f,
  _pad2: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var atlasSampler: sampler;
@group(0) @binding(2) var atlasTex: texture_2d<f32>;

struct VSIn {
  @location(0) quad: vec2f,
  @location(1) pos: vec2f,
  @location(2) size: vec2f,
  @location(3) uv0: vec2f,
  @location(4) uv1: vec2f,
  @location(5) color: vec4f,
  @location(6) bg: vec4f,
  @location(7) slant: f32,
  @location(8) mode: f32,
};

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) bg: vec4f,
  @location(3) mode: f32,
};

@vertex
fn vsMain(input: VSIn) -> VSOut {
  let pixel = input.pos +
    vec2f(input.quad.x * input.size.x + input.slant * (1.0 - input.quad.y), input.quad.y * input.size.y);
  let clip = vec2f(
    (pixel.x / uniforms.res.x) * 2.0 - 1.0,
    1.0 - (pixel.y / uniforms.res.y) * 2.0
  );
  let uv = input.uv0 + (input.uv1 - input.uv0) * input.quad;

  var out: VSOut;
  out.position = vec4f(clip.x, clip.y, 0.0, 1.0);
  out.uv = uv;
  out.color = input.color;
  out.bg = input.bg;
  out.mode = input.mode;
  return out;
}

// sRGB to linear conversion for proper blending
fn srgbToLinear(c: f32) -> f32 {
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return pow((c + 0.055) / 1.055, 2.4);
}

// Linear to sRGB conversion
fn linearToSrgb(c: f32) -> f32 {
  if (c <= 0.0031308) {
    return c * 12.92;
  }
  return 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

fn srgbToLinear3(c: vec3f) -> vec3f {
  return vec3f(srgbToLinear(c.x), srgbToLinear(c.y), srgbToLinear(c.z));
}

fn linearToSrgb3(c: vec3f) -> vec3f {
  return vec3f(linearToSrgb(c.x), linearToSrgb(c.y), linearToSrgb(c.z));
}

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

@fragment
fn fsMain(input: VSOut) -> @location(0) vec4f {
  let atlasSample = textureSample(atlasTex, atlasSampler, input.uv);
  let useLinear = uniforms.blend.x > 0.5;
  let useCorrection = uniforms.blend.y > 0.5;

  if (input.mode > 0.5) {
    var color = atlasSample;
    if (useLinear) {
      color = vec4f(srgbToLinear3(color.rgb), color.a);
    }
    return vec4f(color.rgb * color.a, color.a);
  }

  var alpha = atlasSample.a;

  var fg = input.color;
  var bg = input.bg;
  if (useLinear) {
    fg = vec4f(srgbToLinear3(fg.rgb), fg.a);
    bg = vec4f(srgbToLinear3(bg.rgb), bg.a);
  }
  fg = vec4f(fg.rgb * fg.a, fg.a);
  bg = vec4f(bg.rgb * bg.a, bg.a);

  if (useCorrection && useLinear) {
    let fg_l = luminance(fg.rgb);
    let bg_l = luminance(bg.rgb);
    if (abs(fg_l - bg_l) > 0.001) {
      let blend_l = srgbToLinear(linearToSrgb(fg_l) * alpha + linearToSrgb(bg_l) * (1.0 - alpha));
      alpha = clamp((blend_l - bg_l) / (fg_l - bg_l), 0.0, 1.0);
    }
  }

  var color = fg * alpha;
  return color;
}
`;

/** WebGPU WGSL shader for rendering textured glyph quads with nearest-neighbor atlas sampling. */
export const GLYPH_SHADER_NEAREST = `
struct Uniforms {
  res: vec2f,
  _pad: vec2f,
  blend: vec2f,
  _pad2: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var atlasSampler: sampler;
@group(0) @binding(2) var atlasTex: texture_2d<f32>;

struct VSIn {
  @location(0) quad: vec2f,
  @location(1) pos: vec2f,
  @location(2) size: vec2f,
  @location(3) uv0: vec2f,
  @location(4) uv1: vec2f,
  @location(5) color: vec4f,
  @location(6) bg: vec4f,
  @location(7) slant: f32,
  @location(8) mode: f32,
};

struct VSOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) bg: vec4f,
  @location(3) mode: f32,
};

@vertex
fn vsMain(input: VSIn) -> VSOut {
  let pixel = input.pos +
    vec2f(input.quad.x * input.size.x + input.slant * (1.0 - input.quad.y), input.quad.y * input.size.y);
  let clip = vec2f(
    (pixel.x / uniforms.res.x) * 2.0 - 1.0,
    1.0 - (pixel.y / uniforms.res.y) * 2.0
  );
  let uv = input.uv0 + (input.uv1 - input.uv0) * input.quad;

  var out: VSOut;
  out.position = vec4f(clip.x, clip.y, 0.0, 1.0);
  out.uv = uv;
  out.color = input.color;
  out.bg = input.bg;
  out.mode = input.mode;
  return out;
}

// sRGB to linear conversion for proper blending
fn srgbToLinear(c: f32) -> f32 {
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return pow((c + 0.055) / 1.055, 2.4);
}

// Linear to sRGB conversion
fn linearToSrgb(c: f32) -> f32 {
  if (c <= 0.0031308) {
    return c * 12.92;
  }
  return 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

fn srgbToLinear3(c: vec3f) -> vec3f {
  return vec3f(srgbToLinear(c.x), srgbToLinear(c.y), srgbToLinear(c.z));
}

fn linearToSrgb3(c: vec3f) -> vec3f {
  return vec3f(linearToSrgb(c.x), linearToSrgb(c.y), linearToSrgb(c.z));
}

fn luminance(color: vec3f) -> f32 {
  return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

@fragment
fn fsMain(input: VSOut) -> @location(0) vec4f {
  let atlasSample = textureSample(atlasTex, atlasSampler, input.uv);
  let useLinear = uniforms.blend.x > 0.5;
  let useCorrection = uniforms.blend.y > 0.5;

  if (input.mode > 0.5) {
    var color = atlasSample;
    if (useLinear) {
      color = vec4f(srgbToLinear3(color.rgb), color.a);
    }
    return vec4f(color.rgb * color.a, color.a);
  }

  var alpha = atlasSample.a;

  var fg = input.color;
  var bg = input.bg;
  if (useLinear) {
    fg = vec4f(srgbToLinear3(fg.rgb), fg.a);
    bg = vec4f(srgbToLinear3(bg.rgb), bg.a);
  }
  fg = vec4f(fg.rgb * fg.a, fg.a);
  bg = vec4f(bg.rgb * bg.a, bg.a);

  if (useCorrection && useLinear) {
    let fg_l = luminance(fg.rgb);
    let bg_l = luminance(bg.rgb);
    if (abs(fg_l - bg_l) > 0.001) {
      let blend_l = srgbToLinear(linearToSrgb(fg_l) * alpha + linearToSrgb(bg_l) * (1.0 - alpha));
      alpha = clamp((blend_l - bg_l) / (fg_l - bg_l), 0.0, 1.0);
    }
  }

  var color = fg * alpha;
  return color;
}
`;

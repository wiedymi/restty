/// <reference types="@webgpu/types" />
import type { WebGPUCoreState, WebGPUState, WebGLState } from "./types";
import {
  RECT_SHADER,
  GLYPH_SHADER,
  GLYPH_SHADER_NEAREST,
  RECT_SHADER_GL_VERT,
  RECT_SHADER_GL_FRAG,
  GLYPH_SHADER_GL_VERT,
  GLYPH_SHADER_GL_FRAG,
} from "./shaders";

function getPreferredAndSrgbFormats(): {
  preferredFormat: GPUTextureFormat;
  srgbFormat: GPUTextureFormat;
} {
  const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
  const srgbFormat =
    preferredFormat === "bgra8unorm"
      ? "bgra8unorm-srgb"
      : preferredFormat === "rgba8unorm"
        ? "rgba8unorm-srgb"
        : preferredFormat;
  return { preferredFormat, srgbFormat };
}

function configureContextFormat(
  context: GPUCanvasContext,
  device: GPUDevice,
  preferredFormat: GPUTextureFormat,
  srgbFormat: GPUTextureFormat,
): { format: GPUTextureFormat; srgbSwapchain: boolean } {
  let format = preferredFormat;
  try {
    context.configure({ device, format: srgbFormat, alphaMode: "opaque" });
    format = srgbFormat;
  } catch {
    context.configure({ device, format: preferredFormat, alphaMode: "opaque" });
  }
  return { format, srgbSwapchain: format.endsWith("-srgb") };
}

function createWebGPUCoreState(
  device: GPUDevice,
  format: GPUTextureFormat,
  srgbSwapchain: boolean,
): WebGPUCoreState {
  // Quad vertices for instanced rendering
  const quadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  const vertexBuffer = device.createBuffer({
    size: quadVertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(quadVertices);
  vertexBuffer.unmap();

  // Shader modules
  const rectModule = device.createShaderModule({ code: RECT_SHADER });
  const glyphModule = device.createShaderModule({ code: GLYPH_SHADER });
  const glyphNearestModule = device.createShaderModule({ code: GLYPH_SHADER_NEAREST });

  // Rect pipeline
  const rectPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: rectModule,
      entryPoint: "vsMain",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 32,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x2" },
            { shaderLocation: 2, offset: 8, format: "float32x2" },
            { shaderLocation: 3, offset: 16, format: "float32x4" },
          ],
        },
      ],
    },
    fragment: {
      module: rectModule,
      entryPoint: "fsMain",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });

  // Glyph pipeline
  const glyphPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: glyphModule,
      entryPoint: "vsMain",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 72,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x2" },
            { shaderLocation: 2, offset: 8, format: "float32x2" },
            { shaderLocation: 3, offset: 16, format: "float32x2" },
            { shaderLocation: 4, offset: 24, format: "float32x2" },
            { shaderLocation: 5, offset: 32, format: "float32x4" },
            { shaderLocation: 6, offset: 48, format: "float32x4" },
            { shaderLocation: 7, offset: 64, format: "float32" },
            { shaderLocation: 8, offset: 68, format: "float32" },
          ],
        },
      ],
    },
    fragment: {
      module: glyphModule,
      entryPoint: "fsMain",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });

  const glyphPipelineNearest = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: glyphNearestModule,
      entryPoint: "vsMain",
      buffers: [
        {
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
        },
        {
          arrayStride: 72,
          stepMode: "instance",
          attributes: [
            { shaderLocation: 1, offset: 0, format: "float32x2" },
            { shaderLocation: 2, offset: 8, format: "float32x2" },
            { shaderLocation: 3, offset: 16, format: "float32x2" },
            { shaderLocation: 4, offset: 24, format: "float32x2" },
            { shaderLocation: 5, offset: 32, format: "float32x4" },
            { shaderLocation: 6, offset: 48, format: "float32x4" },
            { shaderLocation: 7, offset: 64, format: "float32" },
            { shaderLocation: 8, offset: 68, format: "float32" },
          ],
        },
      ],
    },
    fragment: {
      module: glyphNearestModule,
      entryPoint: "fsMain",
      targets: [
        {
          format,
          blend: {
            color: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });

  return {
    device,
    format,
    srgbSwapchain,
    rectPipeline,
    glyphPipeline,
    glyphPipelineNearest,
    vertexBuffer,
  };
}

export async function initWebGPUCore(canvas: HTMLCanvasElement): Promise<WebGPUCoreState | null> {
  if (!navigator.gpu) return null;

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return null;

  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) return null;

  const { preferredFormat, srgbFormat } = getPreferredAndSrgbFormats();
  const { format, srgbSwapchain } = configureContextFormat(
    context,
    device,
    preferredFormat,
    srgbFormat,
  );

  return createWebGPUCoreState(device, format, srgbSwapchain);
}

export async function initWebGPU(
  canvas: HTMLCanvasElement,
  options: { core?: WebGPUCoreState | null } = {},
): Promise<WebGPUState | null> {
  const core = options.core ?? (await initWebGPUCore(canvas));
  if (!core) return null;
  const context = canvas.getContext("webgpu");
  if (!context) return null;

  try {
    context.configure({ device: core.device, format: core.format, alphaMode: "opaque" });
  } catch {
    return null;
  }

  // Uniform buffer for resolution and blending flags
  const uniformBuffer = core.device.createBuffer({
    size: 8 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Rect bind group
  const rectBindGroup = core.device.createBindGroup({
    layout: core.rectPipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return {
    core,
    device: core.device,
    context,
    format: core.format,
    srgbSwapchain: core.srgbSwapchain,
    rectPipeline: core.rectPipeline,
    glyphPipeline: core.glyphPipeline,
    glyphPipelineNearest: core.glyphPipelineNearest,
    rectBindGroup,
    uniformBuffer,
    vertexBuffer: core.vertexBuffer,
    rectInstanceBuffer: core.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    }),
    rectCapacity: 4,
    glyphInstanceBuffer: core.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    }),
    glyphCapacity: 4,
    glyphAtlases: new Map(),
  };
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

export function initWebGL(canvas: HTMLCanvasElement): WebGLState | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return null;

  const rectProgram = createProgram(gl, RECT_SHADER_GL_VERT, RECT_SHADER_GL_FRAG);
  const glyphProgram = createProgram(gl, GLYPH_SHADER_GL_VERT, GLYPH_SHADER_GL_FRAG);
  if (!rectProgram || !glyphProgram) return null;

  const rectResolutionLoc = gl.getUniformLocation(rectProgram, "u_resolution");
  const rectBlendLoc = gl.getUniformLocation(rectProgram, "u_blend");
  const glyphResolutionLoc = gl.getUniformLocation(glyphProgram, "u_resolution");
  const glyphBlendLoc = gl.getUniformLocation(glyphProgram, "u_blend");
  const glyphAtlasLoc = gl.getUniformLocation(glyphProgram, "u_atlas");
  if (
    !rectResolutionLoc ||
    !rectBlendLoc ||
    !glyphResolutionLoc ||
    !glyphBlendLoc ||
    !glyphAtlasLoc
  ) {
    return null;
  }

  // Quad vertices
  const quadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

  // Rect VAO
  const rectVao = gl.createVertexArray();
  if (!rectVao) return null;
  gl.bindVertexArray(rectVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const rectInstanceBuffer = gl.createBuffer();
  if (!rectInstanceBuffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, rectInstanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, 1024, gl.DYNAMIC_DRAW);
  // a_pos
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 0);
  gl.vertexAttribDivisor(1, 1);
  // a_size
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 8);
  gl.vertexAttribDivisor(2, 1);
  // a_color
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 16);
  gl.vertexAttribDivisor(3, 1);
  gl.bindVertexArray(null);

  // Glyph VAO
  const glyphVao = gl.createVertexArray();
  if (!glyphVao) return null;
  gl.bindVertexArray(glyphVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const glyphInstanceBuffer = gl.createBuffer();
  if (!glyphInstanceBuffer) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, glyphInstanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, 1024, gl.DYNAMIC_DRAW);
  // a_pos
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 72, 0);
  gl.vertexAttribDivisor(1, 1);
  // a_size
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 72, 8);
  gl.vertexAttribDivisor(2, 1);
  // a_uv0
  gl.enableVertexAttribArray(3);
  gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 72, 16);
  gl.vertexAttribDivisor(3, 1);
  // a_uv1
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 72, 24);
  gl.vertexAttribDivisor(4, 1);
  // a_color
  gl.enableVertexAttribArray(5);
  gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 72, 32);
  gl.vertexAttribDivisor(5, 1);
  // a_bg
  gl.enableVertexAttribArray(6);
  gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 72, 48);
  gl.vertexAttribDivisor(6, 1);
  // a_slant
  gl.enableVertexAttribArray(7);
  gl.vertexAttribPointer(7, 1, gl.FLOAT, false, 72, 64);
  gl.vertexAttribDivisor(7, 1);
  // a_mode
  gl.enableVertexAttribArray(8);
  gl.vertexAttribPointer(8, 1, gl.FLOAT, false, 72, 68);
  gl.vertexAttribDivisor(8, 1);
  gl.bindVertexArray(null);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  return {
    gl,
    rectProgram,
    glyphProgram,
    rectResolutionLoc,
    rectBlendLoc,
    glyphResolutionLoc,
    glyphBlendLoc,
    glyphAtlasLoc,
    quadBuffer,
    rectVao,
    glyphVao,
    rectInstanceBuffer,
    glyphInstanceBuffer,
    rectCapacity: 1024,
    glyphCapacity: 1024,
    glyphAtlases: new Map(),
  };
}

export function ensureInstanceBuffer(
  state: WebGPUState,
  kind: "rect" | "glyph",
  byteLength: number,
): void {
  const bufferKey = kind === "rect" ? "rectInstanceBuffer" : "glyphInstanceBuffer";
  const capKey = kind === "rect" ? "rectCapacity" : "glyphCapacity";

  if (byteLength <= state[capKey]) return;

  const newSize = Math.max(byteLength, state[capKey] * 2, 1024);
  state[bufferKey] = state.device.createBuffer({
    size: newSize,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  state[capKey] = newSize;
}

export function configureContext(state: WebGPUState): void {
  state.context.configure({
    device: state.device,
    format: state.format,
    alphaMode: "opaque",
  });
}

export function ensureGLInstanceBuffer(
  state: WebGLState,
  kind: "rect" | "glyph",
  byteLength: number,
): void {
  const { gl } = state;
  const bufferKey = kind === "rect" ? "rectInstanceBuffer" : "glyphInstanceBuffer";
  const capKey = kind === "rect" ? "rectCapacity" : "glyphCapacity";
  const vaoKey = kind === "rect" ? "rectVao" : "glyphVao";

  if (byteLength <= state[capKey]) return;

  const newSize = Math.max(byteLength, state[capKey] * 2, 1024);
  gl.bindVertexArray(state[vaoKey]);
  gl.bindBuffer(gl.ARRAY_BUFFER, state[bufferKey]);
  gl.bufferData(gl.ARRAY_BUFFER, newSize, gl.DYNAMIC_DRAW);
  state[capKey] = newSize;
  gl.bindVertexArray(null);
}

export function createResizeState(): {
  active: boolean;
  lastAt: number;
  cols: number;
  rows: number;
  dpr: number;
} {
  return {
    active: false,
    lastAt: 0,
    cols: 0,
    rows: 0,
    dpr: 1,
  };
}

export function createScrollbarState(): {
  lastInputAt: number;
  lastTotal: number;
  lastOffset: number;
  lastLen: number;
} {
  return {
    lastInputAt: 0,
    lastTotal: 0,
    lastOffset: 0,
    lastLen: 0,
  };
}

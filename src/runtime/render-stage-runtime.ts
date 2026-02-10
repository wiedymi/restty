import type {
  CompiledWebGPUShaderStage,
  WebGPUStageTargets,
  CompiledWebGLShaderStage,
  WebGLStageTargets,
} from "./create-app-types";
import type { ResttyShaderStage } from "./types";
import { packShaderStageUniforms } from "./shader-stages";
import {
  STAGE_UNIFORM_BUFFER_FLOATS,
  FULLSCREEN_STAGE_VERTEX_SHADER_GL,
  FULLSCREEN_STAGE_SHADER_GL_PREFIX,
  FULLSCREEN_STAGE_SHADER_GL_SUFFIX,
  FULLSCREEN_STAGE_SHADER_WGSL_PREFIX,
  FULLSCREEN_STAGE_SHADER_WGSL_SUFFIX,
} from "./render-stage-shaders";

export function compileShaderStageProgram(options: {
  gl: WebGL2RenderingContext;
  stage: ResttyShaderStage;
  reportError: (stage: ResttyShaderStage, message: string) => void;
}): CompiledWebGLShaderStage | null {
  const { gl, stage, reportError } = options;
  const createShader = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader) ?? "compile error";
      reportError(stage, `GLSL compile failed: ${error}`);
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vert = createShader(gl.VERTEX_SHADER, FULLSCREEN_STAGE_VERTEX_SHADER_GL);
  const frag = createShader(
    gl.FRAGMENT_SHADER,
    `${FULLSCREEN_STAGE_SHADER_GL_PREFIX}${stage.shader.glsl ?? ""}${FULLSCREEN_STAGE_SHADER_GL_SUFFIX}`,
  );
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    reportError(stage, "GLSL link failed: program allocation failed");
    return null;
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program) ?? "link error";
    reportError(stage, `GLSL link failed: ${error}`);
    gl.deleteProgram(program);
    return null;
  }

  const sourceLoc = gl.getUniformLocation(program, "u_source");
  const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
  const timeLoc = gl.getUniformLocation(program, "u_time");
  const params0Loc = gl.getUniformLocation(program, "u_params0");
  const params1Loc = gl.getUniformLocation(program, "u_params1");
  if (!sourceLoc || !resolutionLoc || !timeLoc || !params0Loc || !params1Loc) {
    gl.deleteProgram(program);
    reportError(stage, "GLSL link failed: required uniforms are missing");
    return null;
  }

  return {
    stage,
    program,
    sourceLoc,
    resolutionLoc,
    timeLoc,
    params0Loc,
    params1Loc,
    params: packShaderStageUniforms(stage),
  };
}

export function createWebGLStageTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

export function createWebGLStageFramebuffer(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
): WebGLFramebuffer | null {
  const fb = gl.createFramebuffer();
  if (!fb) return null;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(fb);
    return null;
  }
  return fb;
}

export function createWebGLStageTargets(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): WebGLStageTargets | null {
  const quadBuffer = gl.createBuffer();
  const quadVao = gl.createVertexArray();
  if (!quadBuffer || !quadVao) return null;
  const quadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
  gl.bindVertexArray(quadVao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const sceneTexture = createWebGLStageTexture(gl, width, height);
  const pingTexture = createWebGLStageTexture(gl, width, height);
  const pongTexture = createWebGLStageTexture(gl, width, height);
  if (!sceneTexture || !pingTexture || !pongTexture) {
    return null;
  }
  const sceneFramebuffer = createWebGLStageFramebuffer(gl, sceneTexture);
  const pingFramebuffer = createWebGLStageFramebuffer(gl, pingTexture);
  const pongFramebuffer = createWebGLStageFramebuffer(gl, pongTexture);
  if (!sceneFramebuffer || !pingFramebuffer || !pongFramebuffer) {
    return null;
  }

  return {
    width,
    height,
    quadVao,
    quadBuffer,
    sceneTexture,
    sceneFramebuffer,
    pingTexture,
    pingFramebuffer,
    pongTexture,
    pongFramebuffer,
  };
}

export function compileShaderStagePipelineWebGPU(options: {
  device: GPUDevice;
  format: GPUTextureFormat;
  stage: ResttyShaderStage;
  reportError: (stage: ResttyShaderStage, message: string) => void;
}): CompiledWebGPUShaderStage | null {
  const { device, format, stage, reportError } = options;
  const shaderSource = `${FULLSCREEN_STAGE_SHADER_WGSL_PREFIX}${stage.shader.wgsl ?? ""}${FULLSCREEN_STAGE_SHADER_WGSL_SUFFIX}`;
  const formatError = (
    error:
      | Error
      | { message?: string }
      | string
      | number
      | boolean
      | null
      | undefined,
  ): string => {
    if (error instanceof Error) return error.message;
    return String(error);
  };
  try {
    const module = device.createShaderModule({ code: shaderSource });
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vsMain",
        buffers: [
          { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] },
        ],
      },
      fragment: {
        module,
        entryPoint: "fsMain",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
    });

    const uniformBuffer = device.createBuffer({
      size: STAGE_UNIFORM_BUFFER_FLOATS * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    return {
      stage,
      pipeline,
      uniformBuffer,
      uniformData: new Float32Array(STAGE_UNIFORM_BUFFER_FLOATS),
      params: packShaderStageUniforms(stage),
      sampler,
      bindGroupScene: null,
      bindGroupPing: null,
      bindGroupPong: null,
    };
  } catch (error) {
    reportError(stage, `WGSL compile failed: ${formatError(error)}`);
    return null;
  }
}

export function createWebGPUStageTargets(
  device: GPUDevice,
  format: GPUTextureFormat,
  width: number,
  height: number,
): WebGPUStageTargets {
  const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
  const sceneTexture = device.createTexture({
    size: [width, height, 1],
    format,
    usage,
  });
  const pingTexture = device.createTexture({
    size: [width, height, 1],
    format,
    usage,
  });
  const pongTexture = device.createTexture({
    size: [width, height, 1],
    format,
    usage,
  });

  return {
    width,
    height,
    sceneTexture,
    sceneView: sceneTexture.createView(),
    pingTexture,
    pingView: pingTexture.createView(),
    pongTexture,
    pongView: pongTexture.createView(),
  };
}

export function rebuildWebGPUStageBindGroups(
  device: GPUDevice,
  compiledStages: CompiledWebGPUShaderStage[],
  targets: WebGPUStageTargets,
): void {
  for (let i = 0; i < compiledStages.length; i += 1) {
    const stage = compiledStages[i];
    const layout = stage.pipeline.getBindGroupLayout(0);
    stage.bindGroupScene = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: stage.sampler },
        { binding: 1, resource: targets.sceneView },
        { binding: 2, resource: { buffer: stage.uniformBuffer } },
      ],
    });
    stage.bindGroupPing = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: stage.sampler },
        { binding: 1, resource: targets.pingView },
        { binding: 2, resource: { buffer: stage.uniformBuffer } },
      ],
    });
    stage.bindGroupPong = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: stage.sampler },
        { binding: 1, resource: targets.pongView },
        { binding: 2, resource: { buffer: stage.uniformBuffer } },
      ],
    });
  }
}

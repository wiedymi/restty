import type { ResttyShaderStage } from "../core/models";

export type CompiledWebGPUShaderStage = {
  stage: ResttyShaderStage;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  uniformData: Float32Array;
  params: Float32Array;
  sampler: GPUSampler;
  bindGroupScene: GPUBindGroup | null;
  bindGroupPing: GPUBindGroup | null;
  bindGroupPong: GPUBindGroup | null;
};

export type WebGPUStageTargets = {
  width: number;
  height: number;
  sceneTexture: GPUTexture;
  sceneView: GPUTextureView;
  pingTexture: GPUTexture;
  pingView: GPUTextureView;
  pongTexture: GPUTexture;
  pongView: GPUTextureView;
};

export type CompiledWebGLShaderStage = {
  stage: ResttyShaderStage;
  program: WebGLProgram;
  sourceLoc: WebGLUniformLocation;
  resolutionLoc: WebGLUniformLocation;
  timeLoc: WebGLUniformLocation;
  params0Loc: WebGLUniformLocation;
  params1Loc: WebGLUniformLocation;
  params: Float32Array;
};

export type WebGLStageTargets = {
  width: number;
  height: number;
  quadVao: WebGLVertexArrayObject;
  quadBuffer: WebGLBuffer;
  sceneTexture: WebGLTexture;
  sceneFramebuffer: WebGLFramebuffer;
  pingTexture: WebGLTexture;
  pongTexture: WebGLTexture;
  pingFramebuffer: WebGLFramebuffer;
  pongFramebuffer: WebGLFramebuffer;
};

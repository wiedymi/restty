import type { ResttyShaderStage } from "../types";

export type LocalFontsPermissionDescriptor = PermissionDescriptor & { name: "local-fonts" };

export type LocalFontFaceData = {
  family?: string;
  fullName?: string;
  postscriptName?: string;
  blob: () => Promise<Blob>;
};

export type NavigatorWithLocalFontAccess = Navigator & {
  queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  permissions?: {
    query?: (permissionDesc: LocalFontsPermissionDescriptor) => Promise<PermissionStatus>;
  };
};

export type GlobalWithLocalFontAccess = typeof globalThis & {
  queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  navigator?: NavigatorWithLocalFontAccess;
};

export type ResttyDebugWindow = Window &
  typeof globalThis & {
    diagnoseCodepoint?: (cp: number) => void;
    dumpGlyphMetrics?: (cp: number) => { fontIndex: number; glyphId: number } | null;
    dumpAtlasRegion?: (
      fontIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => Promise<ImageData | null>;
    dumpGlyphRender?: (cp: number, constraintWidth?: number) => Promise<unknown>;
  };

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

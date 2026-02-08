/// <reference types="@webgpu/types" />
import type { Color } from "./shapes";

/**
 * Full WebGPU renderer state including device, pipelines, buffers, and atlas cache.
 */
export type WebGPUState = {
  core: WebGPUCoreState;
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  srgbSwapchain: boolean;
  rectPipeline: GPURenderPipeline;
  glyphPipeline: GPURenderPipeline;
  glyphPipelineNearest: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  rectBindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
  rectInstanceBuffer: GPUBuffer;
  rectCapacity: number;
  glyphInstanceBuffer: GPUBuffer;
  glyphCapacity: number;
  glyphAtlases: Map<number, AtlasState>;
};

/**
 * Shared WebGPU objects needed by sub-renderers (device, format, pipelines, vertex buffer).
 */
export type WebGPUCoreState = {
  device: GPUDevice;
  format: GPUTextureFormat;
  srgbSwapchain: boolean;
  rectPipeline: GPURenderPipeline;
  glyphPipeline: GPURenderPipeline;
  glyphPipelineNearest: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
};

/**
 * WebGPU glyph atlas state for a single font size/DPR combination.
 */
export type AtlasState = {
  texture: GPUTexture;
  sampler?: GPUSampler;
  samplerNearest?: GPUSampler;
  samplerLinear?: GPUSampler;
  bindGroup: GPUBindGroup;
  bindGroupNearest?: GPUBindGroup;
  bindGroupLinear?: GPUBindGroup;
  width: number;
  height: number;
  inset: number;
  colorGlyphs?: Set<number>;
  constrainedGlyphWidths?: Map<number, number>;
  nearest?: boolean;
};

/**
 * Full WebGL2 renderer state including context, programs, buffers, and atlas cache.
 */
export type WebGLState = {
  gl: WebGL2RenderingContext;
  rectProgram: WebGLProgram;
  glyphProgram: WebGLProgram;
  rectResolutionLoc: WebGLUniformLocation;
  rectBlendLoc: WebGLUniformLocation;
  glyphResolutionLoc: WebGLUniformLocation;
  glyphBlendLoc: WebGLUniformLocation;
  glyphAtlasLoc: WebGLUniformLocation;
  quadBuffer: WebGLBuffer;
  rectVao: WebGLVertexArrayObject;
  glyphVao: WebGLVertexArrayObject;
  rectInstanceBuffer: WebGLBuffer;
  glyphInstanceBuffer: WebGLBuffer;
  rectCapacity: number;
  glyphCapacity: number;
  glyphAtlases: Map<number, WebGLAtlasState>;
};

/**
 * WebGL glyph atlas state for a single font size/DPR combination.
 */
export type WebGLAtlasState = {
  texture: WebGLTexture;
  width: number;
  height: number;
  inset: number;
  colorGlyphs?: Set<number>;
  constrainedGlyphWidths?: Map<number, number>;
  nearest?: boolean;
};

/**
 * Active renderer backend state.
 * - WebGPUState: WebGPU backend is active
 * - WebGLState: WebGL2 fallback is active
 * - null: no renderer initialized
 */
export type RendererState = WebGPUState | WebGLState | null;

/**
 * Renderer color configuration.
 */
export type RendererConfig = {
  /** Default background color. */
  defaultBg: Color;
  /** Default foreground color. */
  defaultFg: Color;
  /** Selection highlight overlay color. */
  selectionColor: Color;
  /** Cursor color used when the application does not specify one. */
  cursorFallback: Color;
};

/**
 * Tracks in-progress resize operations for debouncing and state diffing.
 */
export type ResizeState = {
  /** Whether a resize is currently in progress. */
  active: boolean;
  /** Timestamp of the last resize event. */
  lastAt: number;
  /** Column count after the last resize. */
  cols: number;
  /** Row count after the last resize. */
  rows: number;
  /** Device pixel ratio after the last resize. */
  dpr: number;
};

/**
 * Cached scrollbar position state for change detection and fade timing.
 */
export type ScrollbarState = {
  /** Timestamp of the last user scroll input. */
  lastInputAt: number;
  /** Total number of scrollback lines at last update. */
  lastTotal: number;
  /** Scroll offset (lines from bottom) at last update. */
  lastOffset: number;
  /** Visible viewport length (rows) at last update. */
  lastLen: number;
};

import type { WebGPUState } from "../../renderer";
import type { KittyPlacement, ResttyWasm } from "../../wasm";

export type KittyDrawSlice = {
  imageId: number;
  key: string;
  source: CanvasImageSource;
  pixels?: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  z: number;
};

export type KittyDrawPlan = {
  underlay: KittyDrawSlice[];
  overlay: KittyDrawSlice[];
};

export type KittyRenderRuntimeOptions = {
  getWasm: () => ResttyWasm | null;
  markNeedsRender: () => void;
};

export type KittyRenderRuntime = {
  collectKittyDrawPlan: (
    placements: KittyPlacement[],
    cellW: number,
    cellH: number,
  ) => KittyDrawPlan;
  resolveKittyWebGLTexture: (
    gl: WebGL2RenderingContext,
    slice: KittyDrawSlice,
  ) => WebGLTexture | null;
  resolveKittyWebGPUBindGroup: (
    state: WebGPUState,
    slice: KittyDrawSlice,
    nearest?: boolean,
  ) => GPUBindGroup | null;
  clearWebGLKittyTextures: () => void;
  clearWebGPUKittyTextures: () => void;
  clearKittyRenderCaches: () => void;
};

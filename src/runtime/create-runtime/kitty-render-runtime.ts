import type { WebGPUState } from "../../renderer";
import type { KittyPlacement } from "../../wasm";
import { toKittySlice } from "./kitty-overlay-utils";
import { createKittyImageCache } from "./interaction-runtime/kitty-image-cache";
import type {
  KittyDrawPlan,
  KittyDrawSlice,
  KittyRenderRuntime,
  KittyRenderRuntimeOptions,
} from "./kitty-render-runtime.types";

type KittyWebGLTextureEntry = {
  gl: WebGL2RenderingContext;
  key: string;
  texture: WebGLTexture;
};

type KittyWebGPUTextureEntry = {
  device: GPUDevice;
  key: string;
  texture: GPUTexture;
  bindGroupNearest: GPUBindGroup;
  bindGroupLinear: GPUBindGroup;
};

const GPU_TEXTURE_USAGE = 0x0004 | 0x0002; // TEXTURE_BINDING | COPY_DST

export function createKittyRenderRuntime(options: KittyRenderRuntimeOptions): KittyRenderRuntime {
  const kittyImageCache = createKittyImageCache(options);
  const webglTextures = new Map<number, KittyWebGLTextureEntry>();
  const webgpuTextures = new Map<number, KittyWebGPUTextureEntry>();
  const webgpuSamplerCache = new WeakMap<GPUDevice, { nearest: GPUSampler; linear: GPUSampler }>();
  const webglUploadWarnings = new Set<string>();
  const webgpuUploadWarnings = new Set<string>();

  const releaseWebGLTexture = (entry: KittyWebGLTextureEntry | undefined) => {
    if (!entry) return;
    try {
      entry.gl.deleteTexture(entry.texture);
    } catch {
      // ignore cleanup failures
    }
  };

  const releaseWebGPUTexture = (entry: KittyWebGPUTextureEntry | undefined) => {
    if (!entry) return;
    try {
      entry.texture.destroy();
    } catch {
      // ignore cleanup failures
    }
  };

  const pruneWebGLTextures = (activeImageIds: Set<number>) => {
    for (const [imageId, entry] of webglTextures.entries()) {
      if (activeImageIds.has(imageId)) continue;
      releaseWebGLTexture(entry);
      webglTextures.delete(imageId);
    }
  };

  const pruneWebGPUTextures = (activeImageIds: Set<number>) => {
    for (const [imageId, entry] of webgpuTextures.entries()) {
      if (activeImageIds.has(imageId)) continue;
      releaseWebGPUTexture(entry);
      webgpuTextures.delete(imageId);
    }
  };

  const clearWebGLKittyTextures = () => {
    for (const entry of webglTextures.values()) {
      releaseWebGLTexture(entry);
    }
    webglTextures.clear();
  };

  const clearWebGPUKittyTextures = () => {
    for (const entry of webgpuTextures.values()) {
      releaseWebGPUTexture(entry);
    }
    webgpuTextures.clear();
  };

  const clearKittyRenderCaches = () => {
    clearWebGLKittyTextures();
    clearWebGPUKittyTextures();
    kittyImageCache.clearKittyImageCache();
  };

  const collectKittyDrawPlan = (
    placements: KittyPlacement[],
    cellW: number,
    cellH: number,
  ): KittyDrawPlan => {
    const underlay: KittyDrawSlice[] = [];
    const overlay: KittyDrawSlice[] = [];
    const activeImageIds = new Set<number>();

    const orderedPlacements = placements
      .map((placement, index) => ({ placement, index }))
      .sort((a, b) => {
        const z = (a.placement.z | 0) - (b.placement.z | 0);
        return z !== 0 ? z : a.index - b.index;
      });

    for (const { placement } of orderedPlacements) {
      activeImageIds.add(placement.imageId);
      const decoded = kittyImageCache.resolveKittyImage(placement);
      if (!decoded) continue;
      const slice = toKittySlice(placement, decoded, cellW, cellH);
      if (!slice) continue;
      const target = (placement.z | 0) < 0 ? underlay : overlay;
      target.push({
        imageId: placement.imageId,
        key: decoded.key,
        source: decoded.source,
        pixels: decoded.pixels,
        imageWidth: decoded.width,
        imageHeight: decoded.height,
        sx: slice.sx,
        sy: slice.sy,
        sw: slice.sw,
        sh: slice.sh,
        dx: slice.dx,
        dy: slice.dy,
        dw: slice.dw,
        dh: slice.dh,
        z: placement.z | 0,
      });
    }

    kittyImageCache.pruneInactiveImages(activeImageIds);
    pruneWebGLTextures(activeImageIds);
    pruneWebGPUTextures(activeImageIds);
    return { underlay, overlay };
  };

  const resolveKittyWebGLTexture = (
    gl: WebGL2RenderingContext,
    slice: KittyDrawSlice,
  ): WebGLTexture | null => {
    const cached = webglTextures.get(slice.imageId);
    if (cached && cached.key === slice.key && cached.gl === gl) {
      return cached.texture;
    }
    if (cached) {
      releaseWebGLTexture(cached);
      webglTextures.delete(slice.imageId);
    }

    const texture = gl.createTexture();
    if (!texture) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        slice.source as TexImageSource,
      );
    } catch {
      if (!webglUploadWarnings.has(slice.key)) {
        webglUploadWarnings.add(slice.key);
        console.warn("[kitty] WebGL texture upload failed", {
          imageId: slice.imageId,
          key: slice.key,
          width: slice.imageWidth,
          height: slice.imageHeight,
        });
      }
      gl.deleteTexture(texture);
      return null;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    webglTextures.set(slice.imageId, { gl, key: slice.key, texture });
    return texture;
  };

  const getWebGPUSamplers = (device: GPUDevice) => {
    const cached = webgpuSamplerCache.get(device);
    if (cached) return cached;
    const samplers = {
      nearest: device.createSampler({
        minFilter: "nearest",
        magFilter: "nearest",
        mipmapFilter: "nearest",
      }),
      linear: device.createSampler({
        minFilter: "linear",
        magFilter: "linear",
        mipmapFilter: "linear",
      }),
    };
    webgpuSamplerCache.set(device, samplers);
    return samplers;
  };

  const alignTo256 = (value: number) => (value + 255) & ~255;

  const uploadKittyPixelsToWebGPU = (
    device: GPUDevice,
    texture: GPUTexture,
    width: number,
    height: number,
    pixels: Uint8Array,
  ) => {
    const rowBytes = width * 4;
    const alignedRowBytes = alignTo256(rowBytes);
    const needsPadding = alignedRowBytes !== rowBytes;
    const data = needsPadding ? new Uint8Array(alignedRowBytes * height) : pixels;
    if (needsPadding) {
      for (let row = 0; row < height; row += 1) {
        const srcStart = row * rowBytes;
        const srcEnd = srcStart + rowBytes;
        data.set(pixels.subarray(srcStart, srcEnd), row * alignedRowBytes);
      }
    }
    device.queue.writeTexture(
      { texture },
      data,
      { offset: 0, bytesPerRow: alignedRowBytes, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 },
    );
  };

  const resolveKittyWebGPUBindGroup = (
    state: WebGPUState,
    slice: KittyDrawSlice,
    nearest = false,
  ): GPUBindGroup | null => {
    const { device } = state;
    const cached = webgpuTextures.get(slice.imageId);
    if (cached && cached.key === slice.key && cached.device === device) {
      return nearest ? cached.bindGroupNearest : cached.bindGroupLinear;
    }
    if (cached) {
      releaseWebGPUTexture(cached);
      webgpuTextures.delete(slice.imageId);
    }

    const width = Math.max(1, slice.imageWidth | 0);
    const height = Math.max(1, slice.imageHeight | 0);
    const texture = device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      format: "rgba8unorm",
      usage: GPU_TEXTURE_USAGE,
    });
    try {
      const pixelCount = width * height * 4;
      if (slice.pixels && slice.pixels.length >= pixelCount) {
        uploadKittyPixelsToWebGPU(device, texture, width, height, slice.pixels);
      } else {
        device.queue.copyExternalImageToTexture(
          { source: slice.source as GPUImageCopyExternalImage["source"] },
          { texture },
          { width, height, depthOrArrayLayers: 1 },
        );
      }
    } catch {
      if (!webgpuUploadWarnings.has(slice.key)) {
        webgpuUploadWarnings.add(slice.key);
        console.warn("[kitty] WebGPU texture upload failed", {
          imageId: slice.imageId,
          key: slice.key,
          width,
          height,
        });
      }
      texture.destroy();
      return null;
    }

    const textureView = texture.createView();
    const samplers = getWebGPUSamplers(device);
    const bindGroupNearest = device.createBindGroup({
      layout: state.glyphPipelineNearest.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: state.uniformBuffer } },
        { binding: 1, resource: samplers.nearest },
        { binding: 2, resource: textureView },
      ],
    });
    const bindGroupLinear = device.createBindGroup({
      layout: state.glyphPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: state.uniformBuffer } },
        { binding: 1, resource: samplers.linear },
        { binding: 2, resource: textureView },
      ],
    });

    webgpuTextures.set(slice.imageId, {
      device,
      key: slice.key,
      texture,
      bindGroupNearest,
      bindGroupLinear,
    });

    return nearest ? bindGroupNearest : bindGroupLinear;
  };

  return {
    collectKittyDrawPlan,
    resolveKittyWebGLTexture,
    resolveKittyWebGPUBindGroup,
    clearWebGLKittyTextures,
    clearWebGPUKittyTextures,
    clearKittyRenderCaches,
  };
}

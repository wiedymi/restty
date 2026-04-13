import type { KittyPlacement } from "../../../wasm";
import type {
  CreateKittyImageCacheOptions,
  KittyDecodedImage,
  KittyImageCache,
} from "./kitty-image-cache.types";

const KITTY_FMT_GRAY = 1;
const KITTY_FMT_GRAY_ALPHA = 2;
const KITTY_FMT_RGB = 3;
const KITTY_FMT_RGBA = 4;
const KITTY_FMT_PNG = 100;

export type {
  CreateKittyImageCacheOptions,
  KittyDecodedImage,
  KittyImageCache,
} from "./kitty-image-cache.types";

export function createKittyImageCache(options: CreateKittyImageCacheOptions): KittyImageCache {
  const { getWasm, markNeedsRender } = options;

  const kittyImageCache = new Map<number, KittyDecodedImage>();
  const kittyImageKeyById = new Map<number, string>();
  const kittyDecodePending = new Set<string>();
  const kittyDecodeWarnings = new Set<string>();

  const releaseKittyImage = (entry: KittyDecodedImage | undefined) => {
    const source = entry?.source as ImageBitmap | undefined;
    if (source && typeof source.close === "function") {
      try {
        source.close();
      } catch {
        // ignore cleanup errors
      }
    }
  };

  const decodeRawKittyImage = (
    placement: KittyPlacement,
    key: string,
    bytes: Uint8Array,
  ): KittyDecodedImage | null => {
    const width = placement.imageWidth >>> 0;
    const height = placement.imageHeight >>> 0;
    if (!width || !height || typeof document === "undefined") return null;

    const pixelCount = width * height;
    const out = new Uint8ClampedArray(pixelCount * 4);
    if (placement.imageFormat === KITTY_FMT_GRAY) {
      if (bytes.length < pixelCount) return null;
      for (let i = 0; i < pixelCount; i += 1) {
        const v = bytes[i] ?? 0;
        const o = i * 4;
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
        out[o + 3] = 255;
      }
    } else if (placement.imageFormat === KITTY_FMT_GRAY_ALPHA) {
      if (bytes.length < pixelCount * 2) return null;
      for (let i = 0; i < pixelCount; i += 1) {
        const o = i * 4;
        const s = i * 2;
        const v = bytes[s] ?? 0;
        out[o] = v;
        out[o + 1] = v;
        out[o + 2] = v;
        out[o + 3] = bytes[s + 1] ?? 255;
      }
    } else if (placement.imageFormat === KITTY_FMT_RGB) {
      if (bytes.length < pixelCount * 3) return null;
      for (let i = 0; i < pixelCount; i += 1) {
        const o = i * 4;
        const s = i * 3;
        out[o] = bytes[s] ?? 0;
        out[o + 1] = bytes[s + 1] ?? 0;
        out[o + 2] = bytes[s + 2] ?? 0;
        out[o + 3] = 255;
      }
    } else if (placement.imageFormat === KITTY_FMT_RGBA) {
      if (bytes.length < pixelCount * 4) return null;
      out.set(bytes.subarray(0, pixelCount * 4));
    } else {
      return null;
    }

    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const ctx = surface.getContext("2d");
    if (!ctx) return null;
    ctx.putImageData(new ImageData(out, width, height), 0, 0);
    return {
      key,
      width,
      height,
      source: surface,
      pixels: new Uint8Array(out.buffer, out.byteOffset, out.byteLength),
    };
  };

  const extractPngPixels = (bitmap: ImageBitmap): Uint8Array | undefined => {
    if (typeof document === "undefined") return undefined;
    const surface = document.createElement("canvas");
    surface.width = bitmap.width;
    surface.height = bitmap.height;
    const ctx = surface.getContext("2d", { willReadFrequently: true });
    if (!ctx) return undefined;
    try {
      ctx.drawImage(bitmap, 0, 0);
      const rgba = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      return new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength);
    } catch {
      return undefined;
    }
  };

  const resolveKittyImage = (placement: KittyPlacement): KittyDecodedImage | null => {
    const wasm = getWasm();
    if (!wasm) return null;
    const ptr = placement.imageDataPtr >>> 0;
    const len = placement.imageDataLen >>> 0;
    if (!ptr || !len) return null;
    const key = [
      placement.imageId,
      placement.imageFormat,
      placement.imageWidth,
      placement.imageHeight,
      ptr,
      len,
    ].join(":");
    kittyImageKeyById.set(placement.imageId, key);

    const cached = kittyImageCache.get(placement.imageId);
    if (cached?.key === key) return cached;

    const memory = wasm.memory.buffer;
    if (ptr + len > memory.byteLength) return null;
    const copy = new Uint8Array(len);
    copy.set(new Uint8Array(memory, ptr, len));

    if (placement.imageFormat === KITTY_FMT_PNG) {
      if (kittyDecodePending.has(key)) return null;
      kittyDecodePending.add(key);
      createImageBitmap(new Blob([copy], { type: "image/png" }))
        .then((bitmap) => {
          kittyDecodePending.delete(key);
          if (kittyImageKeyById.get(placement.imageId) !== key) {
            bitmap.close();
            return;
          }
          const current = kittyImageCache.get(placement.imageId);
          if (current && current.key !== key) releaseKittyImage(current);
          kittyImageCache.set(placement.imageId, {
            key,
            width: bitmap.width,
            height: bitmap.height,
            source: bitmap,
            pixels: extractPngPixels(bitmap),
          });
          markNeedsRender();
        })
        .catch((error) => {
          kittyDecodePending.delete(key);
          if (!kittyDecodeWarnings.has(key)) {
            kittyDecodeWarnings.add(key);
            console.warn("[kitty] image decode failed", {
              imageId: placement.imageId,
              key,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });
      return null;
    }

    const decoded = decodeRawKittyImage(placement, key, copy);
    if (!decoded) return null;
    if (cached && cached.key !== key) releaseKittyImage(cached);
    kittyImageCache.set(placement.imageId, decoded);
    return decoded;
  };

  const pruneInactiveImages = (activeImageIds: Set<number>) => {
    let cacheDirty = false;
    for (const [imageId, entry] of kittyImageCache.entries()) {
      if (activeImageIds.has(imageId)) continue;
      releaseKittyImage(entry);
      kittyImageCache.delete(imageId);
      kittyImageKeyById.delete(imageId);
      cacheDirty = true;
    }
    return cacheDirty;
  };

  const clearKittyImageCache = () => {
    for (const entry of kittyImageCache.values()) {
      releaseKittyImage(entry);
    }
    kittyImageCache.clear();
    kittyImageKeyById.clear();
    kittyDecodePending.clear();
  };

  return {
    resolveKittyImage,
    clearKittyImageCache,
    pruneInactiveImages,
  };
}

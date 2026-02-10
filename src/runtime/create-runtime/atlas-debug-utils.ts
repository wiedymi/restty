import type { FontAtlas, FontAtlasGlyphMetrics, FontEntry } from "../../fonts";

export function atlasRegionToImageData(
  atlas: FontAtlas,
  x: number,
  y: number,
  width: number,
  height: number,
  pixelModeGray: number,
  pixelModeRgba: number,
): ImageData {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const pixelMode = atlas.bitmap?.pixelMode ?? pixelModeGray;
  const rgbaBitmap = pixelMode === pixelModeRgba || pixelMode === 4;
  for (let row = 0; row < height; row += 1) {
    const dstRow = row * width * 4;
    if (rgbaBitmap) {
      const srcRow = (y + row) * atlas.bitmap.pitch + x * 4;
      for (let col = 0; col < width; col += 1) {
        const srcIdx = srcRow + col * 4;
        const dstIdx = dstRow + col * 4;
        rgba[dstIdx] = atlas.bitmap.buffer[srcIdx] ?? 0;
        rgba[dstIdx + 1] = atlas.bitmap.buffer[srcIdx + 1] ?? 0;
        rgba[dstIdx + 2] = atlas.bitmap.buffer[srcIdx + 2] ?? 0;
        rgba[dstIdx + 3] = atlas.bitmap.buffer[srcIdx + 3] ?? 0;
      }
      continue;
    }
    const srcRow = (y + row) * atlas.bitmap.pitch + x;
    for (let col = 0; col < width; col += 1) {
      const alpha = atlas.bitmap.buffer[srcRow + col] ?? 0;
      const dstIdx = dstRow + col * 4;
      rgba[dstIdx] = 255;
      rgba[dstIdx + 1] = 255;
      rgba[dstIdx + 2] = 255;
      rgba[dstIdx + 3] = alpha;
    }
  }
  return new ImageData(rgba, width, height);
}

export function padAtlasRGBA(rgba: Uint8Array, atlas: FontAtlas, padding: number): Uint8Array {
  if (!padding || padding <= 0 || !atlas?.glyphs) return rgba;
  const width = atlas.bitmap?.width ?? 0;
  const height = atlas.bitmap?.rows ?? 0;
  if (!width || !height) return rgba;
  const out = new Uint8Array(rgba);
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const writePixel = (dstX: number, dstY: number, srcX: number, srcY: number) => {
    if (dstX < 0 || dstY < 0 || dstX >= width || dstY >= height) return;
    if (srcX < 0 || srcY < 0 || srcX >= width || srcY >= height) return;
    const srcIdx = (srcY * width + srcX) * 4;
    const dstIdx = (dstY * width + dstX) * 4;
    out[dstIdx] = out[srcIdx];
    out[dstIdx + 1] = out[srcIdx + 1];
    out[dstIdx + 2] = out[srcIdx + 2];
    out[dstIdx + 3] = out[srcIdx + 3];
  };

  const padMetrics = (metrics: FontAtlasGlyphMetrics) => {
    const x0 = metrics.atlasX;
    const y0 = metrics.atlasY;
    const x1 = metrics.atlasX + metrics.width - 1;
    const y1 = metrics.atlasY + metrics.height - 1;
    if (x0 < 0 || y0 < 0 || x1 < x0 || y1 < y0) return;
    const pad = padding;

    for (let y = y0; y <= y1; y += 1) {
      for (let px = 1; px <= pad; px += 1) {
        writePixel(x0 - px, y, x0, y);
        writePixel(x1 + px, y, x1, y);
      }
    }
    for (let x = x0 - pad; x <= x1 + pad; x += 1) {
      const clampedX = clamp(x, 0, width - 1);
      for (let py = 1; py <= pad; py += 1) {
        writePixel(clampedX, y0 - py, clampedX, y0);
        writePixel(clampedX, y1 + py, clampedX, y1);
      }
    }
  };

  for (const metrics of atlas.glyphs.values()) {
    padMetrics(metrics);
  }

  const glyphsByWidth = atlas.glyphsByWidth;
  if (glyphsByWidth && typeof glyphsByWidth.values === "function") {
    for (const map of glyphsByWidth.values()) {
      if (!map?.values) continue;
      for (const metrics of map.values()) {
        padMetrics(metrics);
      }
    }
  }

  return out;
}

export function resolveGlyphPixelMode(
  entry: FontEntry,
  pixelModeGray: number,
  pixelModeRgba: number,
  isColorEmojiFont: (entry: FontEntry) => boolean,
): number {
  if (pixelModeRgba !== undefined && pixelModeRgba !== null && isColorEmojiFont(entry)) {
    return pixelModeRgba;
  }
  return pixelModeGray;
}

export function atlasBitmapToRGBA(
  atlas: FontAtlas,
  pixelModeRgba: number,
  atlasToRGBA: (atlas: FontAtlas) => Uint8Array,
): Uint8Array | null {
  const bitmap = atlas?.bitmap;
  if (!bitmap?.width || !bitmap?.rows) return null;
  if (bitmap.pixelMode === pixelModeRgba || bitmap.pixelMode === 4) {
    const width = bitmap.width;
    const height = bitmap.rows;
    const rgba = new Uint8Array(width * height * 4);
    for (let row = 0; row < height; row += 1) {
      const srcStart = row * bitmap.pitch;
      const srcEnd = srcStart + width * 4;
      const dstStart = row * width * 4;
      rgba.set(bitmap.buffer.subarray(srcStart, srcEnd), dstStart);
    }
    return rgba;
  }
  return atlasToRGBA(atlas);
}

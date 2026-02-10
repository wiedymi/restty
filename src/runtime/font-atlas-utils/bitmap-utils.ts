import type { FontAtlasBitmap } from "../../fonts";

export function bitmapBytesPerPixel(pixelMode: number): number {
  if (pixelMode === 2 || pixelMode === 3) return 3;
  if (pixelMode === 4) return 4;
  return 1;
}

export function createAtlasBitmap(
  width: number,
  height: number,
  pixelMode: FontAtlasBitmap["pixelMode"],
): FontAtlasBitmap {
  const bytesPerPixel = bitmapBytesPerPixel(pixelMode);
  const pitch = Math.max(1, Math.ceil(width * bytesPerPixel));
  const size = pitch * height;
  return {
    width,
    rows: height,
    pitch,
    buffer: new Uint8Array(size),
    pixelMode,
    numGrays: pixelMode === 0 ? 2 : 256,
  };
}

export function cloneBitmap(
  bitmap: FontAtlasBitmap | null | undefined,
  defaultPixelMode: FontAtlasBitmap["pixelMode"] = 1,
): FontAtlasBitmap {
  const pitch = bitmap?.pitch ?? 0;
  const rows = bitmap?.rows ?? 0;
  const size = pitch * rows;
  const buffer = new Uint8Array(size);
  if (bitmap?.buffer) {
    buffer.set(bitmap.buffer.subarray(0, size));
  }
  return {
    width: bitmap?.width ?? 0,
    rows,
    pitch,
    buffer,
    pixelMode: bitmap?.pixelMode ?? defaultPixelMode,
    numGrays: bitmap?.numGrays ?? 256,
  };
}

export function copyBitmapToAtlas(
  src: FontAtlasBitmap,
  dst: FontAtlasBitmap,
  dstX: number,
  dstY: number,
): void {
  const bytesPerPixel = bitmapBytesPerPixel(src.pixelMode ?? 1);
  const rowBytes = src.width * bytesPerPixel;
  for (let y = 0; y < src.rows; y += 1) {
    const srcRow = y * src.pitch;
    const dstRow = (dstY + y) * dst.pitch + dstX * bytesPerPixel;
    dst.buffer.set(src.buffer.subarray(srcRow, srcRow + rowBytes), dstRow);
  }
}

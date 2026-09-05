import type { KittyPlacement, ResttyWasmExports } from "./types";

const KITTY_PLACEMENT_STRIDE_V1 = 68;
const KITTY_PLACEMENT_STRIDE_V2 = 76;
const KITTY_PLACEMENT_STRIDE_V3 = 84;

export function readKittyPlacements(
  exports: ResttyWasmExports,
  memory: WebAssembly.Memory,
  handle: number,
): KittyPlacement[] {
  if (!exports.restty_kitty_placement_count || !exports.restty_kitty_placements_ptr) {
    return [];
  }
  const count = exports.restty_kitty_placement_count(handle) >>> 0;
  if (!count) return [];
  const ptr = exports.restty_kitty_placements_ptr(handle) >>> 0;
  if (!ptr) return [];
  const stride = exports.restty_kitty_placement_stride
    ? exports.restty_kitty_placement_stride() >>> 0
    : KITTY_PLACEMENT_STRIDE_V1;
  if (!stride) return [];

  const view = new DataView(memory.buffer, ptr, count * stride);
  const placements: KittyPlacement[] = new Array(count);
  const hasPlacementIdentity = stride >= KITTY_PLACEMENT_STRIDE_V2;
  for (let i = 0; i < count; i += 1) {
    const base = i * stride;
    placements[i] = {
      imageId: view.getUint32(base + 0, true),
      imageRevision:
        stride >= KITTY_PLACEMENT_STRIDE_V3
          ? view.getBigUint64(base + 76, true).toString()
          : undefined,
      placementId: hasPlacementIdentity ? view.getUint32(base + 68, true) : 0,
      placementExternal: hasPlacementIdentity ? view.getUint8(base + 72) !== 0 : false,
      imageFormat: view.getUint8(base + 4),
      imageWidth: view.getUint32(base + 8, true),
      imageHeight: view.getUint32(base + 12, true),
      imageDataPtr: view.getUint32(base + 16, true),
      imageDataLen: view.getUint32(base + 20, true),
      x: view.getInt32(base + 24, true),
      y: view.getInt32(base + 28, true),
      z: view.getInt32(base + 32, true),
      width: view.getUint32(base + 36, true),
      height: view.getUint32(base + 40, true),
      cellOffsetX: view.getUint32(base + 44, true),
      cellOffsetY: view.getUint32(base + 48, true),
      sourceX: view.getUint32(base + 52, true),
      sourceY: view.getUint32(base + 56, true),
      sourceWidth: view.getUint32(base + 60, true),
      sourceHeight: view.getUint32(base + 64, true),
    };
  }
  return placements;
}

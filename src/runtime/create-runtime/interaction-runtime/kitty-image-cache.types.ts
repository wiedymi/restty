import type { KittyPlacement, ResttyWasm } from "../../../wasm";

export type KittyDecodedImage = {
  key: string;
  width: number;
  height: number;
  source: CanvasImageSource;
  pixels?: Uint8Array;
};

export type KittyImageCache = {
  resolveKittyImage: (placement: KittyPlacement) => KittyDecodedImage | null;
  clearKittyImageCache: () => void;
  pruneInactiveImages: (activeImageIds: Set<number>) => boolean;
};

export type CreateKittyImageCacheOptions = {
  getWasm: () => ResttyWasm | null;
  markNeedsRender: () => void;
};

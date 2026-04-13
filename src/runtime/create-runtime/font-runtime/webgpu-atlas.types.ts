import type { FontManagerState } from "../../../fonts";
import type { ResttyFontHintTarget } from "../../core/models";
import type {
  AtlasBitmapToRGBA,
  BuildAtlasFn,
  BuildColorEmojiAtlasWithCanvas,
  PadAtlasRGBAFn,
  RasterizeGlyphFn,
  RasterizeGlyphWithTransformFn,
  ResolveGlyphPixelMode,
} from "./types";

export type CreateRuntimeWebGPUAtlasHelpersOptions = {
  fontState: FontManagerState;
  getFontHinting: () => boolean;
  getFontHintTarget: () => ResttyFontHintTarget;
  fontScaleOverrides: Array<{ match: RegExp; scale: number }>;
  resolveGlyphPixelMode: ResolveGlyphPixelMode;
  atlasBitmapToRGBA: AtlasBitmapToRGBA;
  padAtlasRGBA: PadAtlasRGBAFn;
  buildAtlas: BuildAtlasFn;
  buildColorEmojiAtlasWithCanvas: BuildColorEmojiAtlasWithCanvas;
  rasterizeGlyph: RasterizeGlyphFn;
  rasterizeGlyphWithTransform: RasterizeGlyphWithTransformFn;
  pixelModeRgbaValue: number;
  atlasPadding: number;
  symbolAtlasPadding: number;
  symbolAtlasMaxSize: number;
};

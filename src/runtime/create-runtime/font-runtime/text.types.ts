import type { FontManagerState } from "../../../fonts";
import type {
  GlyphBufferToShapedGlyphsFn,
  RasterizeGlyphFn,
  ShapeFn,
  UnicodeBufferCtor,
} from "./types";

export type CreateFontRuntimeTextHelpersOptions = {
  fontState: FontManagerState;
  glyphShapeCacheLimit: number;
  fontPickCacheLimit: number;
  UnicodeBuffer: UnicodeBufferCtor;
  shape: ShapeFn;
  glyphBufferToShapedGlyphs: GlyphBufferToShapedGlyphsFn;
  rasterizeGlyph: RasterizeGlyphFn;
};

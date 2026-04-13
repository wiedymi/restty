import type { FontManagerState } from "../../../fonts";
import type { GlyphBufferToShapedGlyphsFn, ShapeFn, UnicodeBufferCtor } from "./types";

export type CreateFontRuntimeTextHelpersOptions = {
  fontState: FontManagerState;
  glyphShapeCacheLimit: number;
  fontPickCacheLimit: number;
  UnicodeBuffer: UnicodeBufferCtor;
  shape: ShapeFn;
  glyphBufferToShapedGlyphs: GlyphBufferToShapedGlyphsFn;
};

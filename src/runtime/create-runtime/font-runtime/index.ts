import type { CreateRuntimeFontRuntimeHelpersOptions } from "./types";
import { createFontRuntimeGridHelpers } from "./grid";
import { createFontRuntimeTextHelpers } from "./text";
import { createRuntimeWebGPUAtlasHelpers } from "./webgpu-atlas";

export type { CreateRuntimeFontRuntimeHelpersOptions } from "./types";

export function createRuntimeFontRuntimeHelpers(options: CreateRuntimeFontRuntimeHelpersOptions) {
  const {
    fontState,
    fontConfig,
    gridState,
    getCanvas,
    getCurrentDpr,
    getActiveState,
    getWasmReady,
    getWasm,
    getWasmHandle,
    ptyTransport,
    setNeedsRender,
    markSearchDirty,
    getFontHinting,
    getFontHintTarget,
    fontScaleOverrides,
    resolveGlyphPixelMode,
    atlasBitmapToRGBA,
    padAtlasRGBA,
    buildAtlas,
    buildColorEmojiAtlasWithCanvas,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    pixelModeRgbaValue,
    atlasPadding,
    symbolAtlasPadding,
    symbolAtlasMaxSize,
    glyphShapeCacheLimit,
    fontPickCacheLimit,
    UnicodeBuffer,
    shape,
    glyphBufferToShapedGlyphs,
  } = options;

  const textHelpers = createFontRuntimeTextHelpers({
    fontState,
    glyphShapeCacheLimit,
    fontPickCacheLimit,
    UnicodeBuffer,
    shape,
    glyphBufferToShapedGlyphs,
    rasterizeGlyph,
  });

  const gridHelpers = createFontRuntimeGridHelpers({
    fontState,
    fontConfig,
    gridState,
    getCanvas,
    getCurrentDpr,
    getActiveState,
    getWasmReady,
    getWasm,
    getWasmHandle,
    ptyTransport,
    setNeedsRender,
    markSearchDirty,
    shapeClusterWithFont: textHelpers.shapeClusterWithFont,
  });

  const { ensureAtlasForFont } = createRuntimeWebGPUAtlasHelpers({
    fontState,
    getFontHinting,
    getFontHintTarget,
    fontScaleOverrides,
    resolveGlyphPixelMode,
    atlasBitmapToRGBA,
    padAtlasRGBA,
    buildAtlas,
    buildColorEmojiAtlasWithCanvas,
    rasterizeGlyph,
    rasterizeGlyphWithTransform,
    pixelModeRgbaValue,
    atlasPadding,
    symbolAtlasPadding,
    symbolAtlasMaxSize,
  });

  return {
    ...textHelpers,
    ...gridHelpers,
    ensureAtlasForFont,
  };
}

import type { CreateRuntimeFontRuntimeHelpersOptions } from "./font-runtime-helpers.types";
import { createFontRuntimeGridHelpers } from "./font-runtime-grid-helpers";
import { createFontRuntimeTextHelpers } from "./font-runtime-text-helpers";
import { createRuntimeWebGPUAtlasHelpers } from "./font-runtime-webgpu-atlas";

export type { CreateRuntimeFontRuntimeHelpersOptions } from "./font-runtime-helpers.types";

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

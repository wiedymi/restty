import {
  isSymbolFont,
  fontScaleOverride,
  type FontEntry,
  type FontManagerState,
} from "../../fonts";
import type { WebGPUState } from "../../renderer";
import {
  buildFontAtlasIfNeeded,
  type AtlasConstraintContext,
  type GlyphConstraintMeta,
} from "../atlas-builder";
import { buildGlyphAtlasWithConstraints } from "../font-atlas-utils/glyph-atlas-builder";
import { nerdConstraintSignature } from "../font-atlas-utils/nerd-metrics-utils";
import type { ResttyFontHintTarget } from "../types";
import type {
  AtlasBitmapToRGBA,
  BuildAtlasFn,
  BuildColorEmojiAtlasWithCanvas,
  PadAtlasRGBAFn,
  RasterizeGlyphFn,
  RasterizeGlyphWithTransformFn,
  ResolveGlyphPixelMode,
} from "./font-runtime-helpers.types";

type CreateRuntimeWebGPUAtlasHelpersOptions = {
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

export function createRuntimeWebGPUAtlasHelpers(options: CreateRuntimeWebGPUAtlasHelpersOptions) {
  const {
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
  } = options;

  function ensureAtlasForFont(
    device: GPUDevice,
    state: WebGPUState,
    entry: FontEntry,
    neededGlyphIds: Set<number>,
    fontSizePx: number,
    fontIndex: number,
    atlasScale: number,
    glyphMeta?: Map<number, GlyphConstraintMeta>,
    constraintContext?: AtlasConstraintContext | null,
  ): boolean {
    const built = buildFontAtlasIfNeeded({
      entry,
      neededGlyphIds,
      glyphMeta,
      fontSizePx,
      atlasScale,
      fontIndex,
      constraintContext,
      deps: {
        fontScaleOverrides,
        sizeMode: fontState.sizeMode,
        isSymbolFont,
        fontScaleOverride,
        resolveGlyphPixelMode,
        atlasBitmapToRGBA,
        padAtlasRGBA,
        buildAtlas,
        buildGlyphAtlasWithConstraints,
        buildColorEmojiAtlasWithCanvas,
        rasterizeGlyph,
        rasterizeGlyphWithTransform,
        hinting: getFontHinting(),
        hintTarget: getFontHintTarget(),
        nerdConstraintSignature,
        constants: {
          atlasPadding,
          symbolAtlasPadding,
          symbolAtlasMaxSize,
          defaultAtlasMaxSize: 2048,
          pixelModeRgbaValue,
        },
        resolvePreferNearest: ({ fontIndex: idx, isSymbol, atlasScale: scale }) => {
          const scaleHint = scale ?? 1;
          return idx === 0 || isSymbol || scaleHint >= 0.99;
        },
      },
    });
    if (!built.rebuilt || !built.atlas || !built.rgba) return false;

    const atlas = built.atlas;
    const colorGlyphs = built.colorGlyphs;
    const preferNearest = built.preferNearest;
    const rgba = built.rgba;

    const texture = device.createTexture({
      size: [atlas.bitmap.width, atlas.bitmap.rows, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const width = atlas.bitmap.width;
    const height = atlas.bitmap.rows;
    const bytesPerRow = width * 4;
    const alignedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
    let upload = rgba;
    if (alignedBytesPerRow !== bytesPerRow) {
      const padded = new Uint8Array(alignedBytesPerRow * height);
      for (let row = 0; row < height; row += 1) {
        const srcStart = row * bytesPerRow;
        const srcEnd = srcStart + bytesPerRow;
        const dstStart = row * alignedBytesPerRow;
        padded.set(rgba.subarray(srcStart, srcEnd), dstStart);
      }
      upload = padded;
    }
    device.queue.writeTexture(
      { texture },
      upload,
      { bytesPerRow: alignedBytesPerRow, rowsPerImage: height },
      { width, height, depthOrArrayLayers: 1 },
    );

    const samplerNearest = device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    const samplerLinear = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    const bindGroupNearest = device.createBindGroup({
      layout: state.glyphPipelineNearest.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: state.uniformBuffer } },
        { binding: 1, resource: samplerNearest },
        { binding: 2, resource: texture.createView() },
      ],
    });

    const bindGroupLinear = device.createBindGroup({
      layout: state.glyphPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: state.uniformBuffer } },
        { binding: 1, resource: samplerLinear },
        { binding: 2, resource: texture.createView() },
      ],
    });

    if (!state.glyphAtlases) state.glyphAtlases = new Map();
    const inset = Number.isFinite(atlas.inset) ? atlas.inset : 0;
    state.glyphAtlases.set(fontIndex, {
      texture,
      sampler: preferNearest ? undefined : samplerLinear,
      samplerNearest,
      samplerLinear,
      bindGroup: preferNearest ? bindGroupNearest : bindGroupLinear,
      bindGroupNearest,
      bindGroupLinear,
      width: atlas.bitmap.width,
      height: atlas.bitmap.rows,
      inset,
      colorGlyphs,
      nearest: preferNearest,
    });

    return true;
  }

  return {
    ensureAtlasForFont,
  };
}

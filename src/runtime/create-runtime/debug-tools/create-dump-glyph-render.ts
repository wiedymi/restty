import type { GlyphConstraintMeta } from "../../fonts/atlas-builder";
import type { CreateRuntimeDebugToolsOptions } from "./types";
import { readTextureToImageData } from "./read-texture-to-image-data";

export function createDumpGlyphRender(options: CreateRuntimeDebugToolsOptions) {
  const {
    getActiveState,
    pickFontIndexForText,
    fontState,
    getCanvas,
    gridState,
    fontConfig,
    fontHeightUnits,
    fontScaleOverride,
    fontScaleOverrides,
    isSymbolFont,
    isColorEmojiFont,
    fontAdvanceUnits,
    fontMaxCellSpan,
    clamp,
    buildNerdMetrics,
    nerdIconScale,
    ensureAtlasForFont,
    formatCodepoint,
    shapeClusterWithFont,
  } = options;

  return async function dumpGlyphRender(cp: number, constraintWidth = 1) {
    const state = getActiveState();
    if (!state || !("device" in state)) {
      console.warn("WebGPU not active");
      return null;
    }

    const text = String.fromCodePoint(cp);
    const span = Math.max(1, constraintWidth || 1);
    const fontIndex = pickFontIndexForText(text, span);
    const entry = fontState.fonts[fontIndex];
    if (!entry?.font) {
      console.warn("font not ready");
      return null;
    }

    const glyphId = entry.font.glyphIdForChar(text);
    if (!glyphId) {
      console.warn("missing glyph");
      return null;
    }

    const runtimeCanvas = getCanvas();
    const cellW = gridState.cellW || runtimeCanvas.width / Math.max(1, gridState.cols || 1);
    const cellH = gridState.cellH || runtimeCanvas.height / Math.max(1, gridState.rows || 1);
    const fontSizePx = gridState.fontSizePx || fontConfig.sizePx;
    const primaryEntry = fontState.fonts[0];
    const primaryScale = primaryEntry?.font
      ? primaryEntry.font.scaleForSize(fontSizePx, fontState.sizeMode)
      : 1;
    const lineHeight = primaryEntry?.font
      ? fontHeightUnits(primaryEntry.font) * primaryScale
      : cellH;
    const baselineOffset = primaryEntry?.font ? primaryEntry.font.ascender * primaryScale : 0;
    const yPad = gridState.yPad ?? (cellH - lineHeight) * 0.5;

    const baseScale =
      entry.font.scaleForSize(fontSizePx, fontState.sizeMode) *
      fontScaleOverride(entry, fontScaleOverrides);
    let fontScale = baseScale;
    let metricBaselineAdjust: number | null = null;
    if (!isSymbolFont(entry) && !isColorEmojiFont(entry)) {
      type FallbackScaleMetric = "ic_width" | "ex_height" | "cap_height" | "line_height";
      const resolveFallbackMetric = (
        font: typeof entry.font | null | undefined,
        metric: FallbackScaleMetric,
      ): number => {
        if (!font) return 0;
        if (metric === "ic_width") {
          const ideographGlyph = font.glyphIdForChar("水");
          if (!ideographGlyph) return 0;
          const advance = font.advanceWidth(ideographGlyph);
          if (!Number.isFinite(advance) || advance <= 0) return 0;
          const bounds = font.getGlyphBounds(ideographGlyph);
          if (
            bounds &&
            Number.isFinite(bounds.xMax - bounds.xMin) &&
            bounds.xMax - bounds.xMin > advance
          ) {
            return 0;
          }
          return advance;
        }
        if (metric === "ex_height") {
          const exHeight = font.os2?.sxHeight ?? 0;
          return Number.isFinite(exHeight) && exHeight > 0 ? exHeight : 0;
        }
        if (metric === "cap_height") {
          const capHeight = font.os2?.sCapHeight ?? 0;
          return Number.isFinite(capHeight) && capHeight > 0 ? capHeight : 0;
        }
        const lineHeightUnits = font.height;
        return Number.isFinite(lineHeightUnits) && lineHeightUnits > 0 ? lineHeightUnits : 0;
      };
      const metricOrder: FallbackScaleMetric[] = [
        "ic_width",
        "ex_height",
        "cap_height",
        "line_height",
      ];
      let metricAdjust = 1;
      for (let i = 0; i < metricOrder.length; i += 1) {
        const metric = metricOrder[i];
        const primaryMetric = resolveFallbackMetric(primaryEntry?.font, metric);
        const fallbackMetric = resolveFallbackMetric(entry.font, metric);
        if (primaryMetric <= 0 || fallbackMetric <= 0) continue;
        const factor = primaryMetric / fallbackMetric;
        if (Number.isFinite(factor) && factor > 0) {
          metricAdjust = factor;
          break;
        }
      }
      metricAdjust = clamp(metricAdjust, 1, 2);
      fontScale = baseScale * metricAdjust;
      const maxSpan = fontMaxCellSpan(entry);
      if (maxSpan > 1) {
        const advanceUnits = fontAdvanceUnits(entry, shapeClusterWithFont);
        const widthPx = advanceUnits * fontScale;
        const widthAdjustRaw = widthPx > 0 ? (cellW * maxSpan) / widthPx : 1;
        const widthAdjust = clamp(widthAdjustRaw, 0.5, 2);
        fontScale *= widthAdjust;
      }
      const adjustedHeightPx = fontHeightUnits(entry.font) * fontScale;
      if (adjustedHeightPx > lineHeight && adjustedHeightPx > 0) {
        fontScale *= lineHeight / adjustedHeightPx;
      }
      for (let i = 0; i < metricOrder.length; i += 1) {
        const metric = metricOrder[i];
        const primaryMetric = resolveFallbackMetric(primaryEntry?.font, metric);
        const fallbackMetric = resolveFallbackMetric(entry.font, metric);
        if (primaryMetric <= 0 || fallbackMetric <= 0) continue;
        metricBaselineAdjust = primaryMetric * primaryScale - fallbackMetric * fontScale;
        break;
      }
    }
    const baselineAdjust =
      metricBaselineAdjust ??
      (primaryEntry?.font
        ? primaryEntry.font.ascender * primaryScale - entry.font.ascender * fontScale
        : 0);
    const atlasScale = clamp(fontScale / (baseScale || 1), 0.5, 2);

    const meta = new Map<number, GlyphConstraintMeta>();
    meta.set(glyphId, {
      cp,
      constraintWidth: span,
      widths: new Set([span]),
      variable: false,
    });

    const constraintContext = {
      cellW,
      cellH,
      yPad,
      baselineOffset,
      baselineAdjust,
      fontScale,
      nerdMetrics: buildNerdMetrics(
        cellW,
        cellH,
        lineHeight,
        primaryEntry?.font,
        primaryScale,
        nerdIconScale,
      ),
      fontEntry: entry,
    };

    ensureAtlasForFont(
      state.device,
      state,
      entry,
      new Set([glyphId]),
      fontSizePx,
      fontIndex,
      atlasScale,
      meta,
      constraintContext,
    );

    const atlas = entry.atlas;
    const atlasState = state.glyphAtlases?.get(fontIndex);
    if (!atlas || !atlasState) {
      console.warn("atlas not ready");
      return null;
    }

    const widthMap = atlas.glyphsByWidth?.get(span);
    const metrics = widthMap?.get(glyphId) ?? atlas.glyphs.get(glyphId);
    if (!metrics) {
      console.warn("metrics missing");
      return null;
    }

    const atlasW = atlas.bitmap.width;
    const atlasH = atlas.bitmap.rows;
    const baseInset = Number.isFinite(atlas.inset) ? atlas.inset : 0;
    const uvInset = baseInset + (atlasState.nearest ? 0.5 : 0);
    const insetX = Math.min(uvInset, (metrics.width - 1) * 0.5);
    const insetY = Math.min(uvInset, (metrics.height - 1) * 0.5);
    const u0 = (metrics.atlasX + insetX) / atlasW;
    const v0 = (metrics.atlasY + insetY) / atlasH;
    const u1 = (metrics.atlasX + metrics.width - insetX) / atlasW;
    const v1 = (metrics.atlasY + metrics.height - insetY) / atlasH;

    const outW = Math.max(1, metrics.width);
    const outH = Math.max(1, metrics.height);
    const uniformBuffer = state.device.createBuffer({
      size: 8 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniforms = new Float32Array([outW, outH, 0, 0, 0, 0, 0, 0]);
    state.device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const instance = new Float32Array([0, 0, outW, outH, u0, v0, u1, v1, 1, 1, 1, 1, 0, 0, 0, 1]);
    const instanceBuffer = state.device.createBuffer({
      size: instance.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(instanceBuffer.getMappedRange()).set(instance);
    instanceBuffer.unmap();

    const renderTarget = state.device.createTexture({
      size: [outW, outH, 1],
      format: state.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const pipeline = atlasState.nearest ? state.glyphPipelineNearest : state.glyphPipeline;
    const bindGroup = state.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: atlasState.nearest
        ? [
            { binding: 0, resource: { buffer: uniformBuffer } },
            {
              binding: 1,
              resource:
                atlasState.samplerNearest ??
                state.device.createSampler({
                  magFilter: "nearest",
                  minFilter: "nearest",
                  addressModeU: "clamp-to-edge",
                  addressModeV: "clamp-to-edge",
                }),
            },
            { binding: 2, resource: atlasState.texture.createView() },
          ]
        : [
            { binding: 0, resource: { buffer: uniformBuffer } },
            {
              binding: 1,
              resource:
                atlasState.sampler ??
                state.device.createSampler({
                  magFilter: "linear",
                  minFilter: "linear",
                  addressModeU: "clamp-to-edge",
                  addressModeV: "clamp-to-edge",
                }),
            },
            { binding: 2, resource: atlasState.texture.createView() },
          ],
    });

    const encoder = state.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTarget.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, state.vertexBuffer);
    pass.setVertexBuffer(1, instanceBuffer);
    pass.draw(6, 1, 0, 0);
    pass.end();
    state.device.queue.submit([encoder.finish()]);

    const image = await readTextureToImageData(state.device, renderTarget, outW, outH);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.putImageData(image, 0, 0);
    canvas.style.border = "1px solid #555";
    canvas.style.margin = "6px";
    canvas.style.imageRendering = "pixelated";
    canvas.style.width = `${outW * 3}px`;
    canvas.style.height = `${outH * 3}px`;
    document.body.appendChild(canvas);

    console.log("dumpGlyphRender", {
      cp: formatCodepoint(cp),
      fontIndex,
      glyphId,
      constraintWidth: span,
      metrics,
      atlasW,
      atlasH,
      format: state.format,
      u0,
      v0,
      u1,
      v1,
      nearest: atlasState.nearest,
    });

    return image;
  };
}

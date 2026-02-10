import type { ResttyDebugWindow } from "../../create-app-types";
import type { FontAtlasGlyphMetrics } from "../../../fonts";
import type { CreateRuntimeDebugToolsOptions } from "./types";
import { createDumpGlyphRender } from "./create-dump-glyph-render";
import { readTextureToImageData } from "./read-texture-to-image-data";

export function createSetupDebugExpose(
  options: CreateRuntimeDebugToolsOptions,
  diagnoseCodepoint: (cp: number) => void,
) {
  const { debugExpose, getWindow } = options;

  return function setupDebugExpose() {
    if (!debugExpose) return;
    const runtimeWindow = getWindow();
    if (!runtimeWindow) return;

    const debugWindow = runtimeWindow as ResttyDebugWindow;
    debugWindow.diagnoseCodepoint = diagnoseCodepoint;
    debugWindow.dumpGlyphMetrics = createDumpGlyphMetrics(options);
    debugWindow.dumpAtlasRegion = createDumpAtlasRegion(options);
    debugWindow.dumpGlyphRender = createDumpGlyphRender(options);
  };

  function createDumpGlyphMetrics({ pickFontIndexForText, fontState }: CreateRuntimeDebugToolsOptions) {
    return (cp: number) => {
      const text = String.fromCodePoint(cp);
      const fontIndex = pickFontIndexForText(text, 1);
      const entry = fontState.fonts[fontIndex];
      if (!entry?.font || !entry.atlas) {
        console.warn("font/atlas not ready");
        return null;
      }

      const glyphId = entry.font.glyphIdForChar(text);
      const atlas = entry.atlas;
      const atlasW = atlas.bitmap.width;
      const atlasH = atlas.bitmap.rows;
      const report = (label: string, metrics: FontAtlasGlyphMetrics | undefined) => {
        if (!metrics) {
          console.log(`${label}: missing`);
          return;
        }
        const u0 = metrics.atlasX / atlasW;
        const v0 = metrics.atlasY / atlasH;
        const u1 = (metrics.atlasX + metrics.width) / atlasW;
        const v1 = (metrics.atlasY + metrics.height) / atlasH;
        console.log(`${label}:`, {
          glyphId,
          atlasX: metrics.atlasX,
          atlasY: metrics.atlasY,
          width: metrics.width,
          height: metrics.height,
          bearingX: metrics.bearingX,
          bearingY: metrics.bearingY,
          u0,
          v0,
          u1,
          v1,
          atlasW,
          atlasH,
        });
      };
      console.group(`Glyph metrics U+${cp.toString(16).toUpperCase()}`);
      report("default", atlas.glyphs.get(glyphId));
      if (atlas.glyphsByWidth) {
        report("width=1", atlas.glyphsByWidth.get(1)?.get(glyphId));
        report("width=2", atlas.glyphsByWidth.get(2)?.get(glyphId));
      }
      console.groupEnd();
      return { fontIndex, glyphId };
    };
  }

  function createDumpAtlasRegion({
    getActiveState,
  }: CreateRuntimeDebugToolsOptions) {
    return async (fontIndex: number, x: number, y: number, width: number, height: number) => {
      const state = getActiveState();
      if (!state || !("device" in state)) {
        console.warn("WebGPU not active");
        return null;
      }

      const atlasState = state.glyphAtlases?.get(fontIndex);
      if (!atlasState) {
        console.warn("atlas not ready");
        return null;
      }

      const image = await readTextureToImageData(
        state.device,
        atlasState.texture,
        width,
        height,
        { x, y },
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.putImageData(image, 0, 0);
      canvas.style.border = "1px solid #555";
      canvas.style.margin = "6px";
      document.body.appendChild(canvas);
      return image;
    };
  }
}

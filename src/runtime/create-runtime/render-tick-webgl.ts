import type { WebGLState } from "../../renderer";
import { buildWebGLTickContext } from "./render-tick-webgl-context";
import { renderWebGLGlyphPipeline } from "./render-tick-webgl-glyph-pipeline";
import { populateWebGLOverlays } from "./render-tick-webgl-overlays";
import { populateWebGLSceneData } from "./render-tick-webgl-scene";
import type { WebGLTickDeps } from "./render-tick-webgl.types";

export function tickWebGL(deps: WebGLTickDeps, state: WebGLState) {
  const ctx = buildWebGLTickContext(deps, state);
  if (!ctx) return;

  populateWebGLSceneData(ctx);
  populateWebGLOverlays(ctx);
  renderWebGLGlyphPipeline(ctx);

  const kittyPlacements = deps.wasm && deps.wasmHandle ? deps.wasm.getKittyPlacements(deps.wasmHandle) : [];
  deps.drawKittyOverlay(kittyPlacements, ctx.cellW, ctx.cellH);
}

import type { WebGPUState, WebGLState } from "../../renderer";
import type {
  CompiledWebGPUShaderStage,
  WebGPUStageTargets,
  CompiledWebGLShaderStage,
  WebGLStageTargets,
} from "./render-stage-runtime.types";
import type { ResttyShaderStage } from "../core/models";
import type { ShaderStageRuntime, ShaderStageRuntimeOptions } from "./shader-stage-runtime.types";
import {
  cloneShaderStages,
  isShaderStageEnabledForBackend,
  normalizeShaderStages,
  sortShaderStages,
} from "../shader-stages";
import {
  compileShaderStageProgram,
  compileShaderStagePipelineWebGPU,
  createWebGLStageTargets,
  createWebGPUStageTargets,
  rebuildWebGPUStageBindGroups,
} from "./render-stage-runtime";

type ShaderBackend = "webgpu" | "webgl2";

export function createShaderStageRuntime(options: ShaderStageRuntimeOptions): ShaderStageRuntime {
  let shaderStages: ResttyShaderStage[] = [];
  let compiledWebGPUShaderStages: CompiledWebGPUShaderStage[] = [];
  let compiledWebGLShaderStages: CompiledWebGLShaderStage[] = [];
  let webgpuStageTargets: WebGPUStageTargets | null = null;
  let webglStageTargets: WebGLStageTargets | null = null;
  let shaderStagesDirty = true;

  function reportShaderStageError(stage: ResttyShaderStage, message: string): void {
    const text = `[shader-stage:${stage.id}] ${message}`;
    console.warn(text);
    try {
      stage.onError?.(text);
    } catch {
      // Ignore user callback errors from per-stage handlers.
    }
  }

  function parseShaderStages(stages: ResttyShaderStage[]): ResttyShaderStage[] {
    return sortShaderStages(normalizeShaderStages(cloneShaderStages(stages)));
  }

  function getActiveShaderStagesForBackend(target: ShaderBackend): ResttyShaderStage[] {
    const out: ResttyShaderStage[] = [];
    for (let i = 0; i < shaderStages.length; i += 1) {
      const stage = shaderStages[i];
      if (!isShaderStageEnabledForBackend(stage, target)) continue;
      if (stage.mode === "replace-main") {
        reportShaderStageError(stage, "replace-main is not supported yet; stage skipped");
        continue;
      }
      if (target === "webgpu" && !stage.shader.wgsl) {
        reportShaderStageError(stage, "missing WGSL source for webgpu backend; stage skipped");
        continue;
      }
      if (target === "webgl2" && !stage.shader.glsl) {
        reportShaderStageError(stage, "missing GLSL source for webgl2 backend; stage skipped");
        continue;
      }
      out.push(stage);
    }
    return out;
  }

  function clearWebGPUShaderStages(): void {
    for (let i = 0; i < compiledWebGPUShaderStages.length; i += 1) {
      try {
        compiledWebGPUShaderStages[i].uniformBuffer.destroy();
      } catch {
        // Ignore GPU cleanup errors during backend switches.
      }
    }
    compiledWebGPUShaderStages = [];
  }

  function clearWebGLShaderStages(state?: WebGLState | null): void {
    const gl = state?.gl ?? options.getActiveWebGLState()?.gl ?? null;
    if (!gl) {
      compiledWebGLShaderStages = [];
      return;
    }
    for (let i = 0; i < compiledWebGLShaderStages.length; i += 1) {
      gl.deleteProgram(compiledWebGLShaderStages[i].program);
    }
    compiledWebGLShaderStages = [];
  }

  function destroyWebGPUStageTargets(): void {
    if (!webgpuStageTargets) return;
    try {
      webgpuStageTargets.sceneTexture.destroy();
      webgpuStageTargets.pingTexture.destroy();
      webgpuStageTargets.pongTexture.destroy();
    } catch {
      // Ignore GPU cleanup errors during backend switches.
    }
    webgpuStageTargets = null;
  }

  function destroyWebGLStageTargets(state?: WebGLState | null): void {
    if (!webglStageTargets) return;
    const gl = state?.gl ?? options.getActiveWebGLState()?.gl ?? null;
    if (gl) {
      gl.deleteVertexArray(webglStageTargets.quadVao);
      gl.deleteBuffer(webglStageTargets.quadBuffer);
      gl.deleteFramebuffer(webglStageTargets.sceneFramebuffer);
      gl.deleteFramebuffer(webglStageTargets.pingFramebuffer);
      gl.deleteFramebuffer(webglStageTargets.pongFramebuffer);
      gl.deleteTexture(webglStageTargets.sceneTexture);
      gl.deleteTexture(webglStageTargets.pingTexture);
      gl.deleteTexture(webglStageTargets.pongTexture);
    }
    webglStageTargets = null;
  }

  function ensureWebGLStageTargets(state: WebGLState): WebGLStageTargets | null {
    const { width, height } = options.getCanvasSize();
    if (
      webglStageTargets &&
      webglStageTargets.width === width &&
      webglStageTargets.height === height
    ) {
      return webglStageTargets;
    }
    destroyWebGLStageTargets(state);
    webglStageTargets = createWebGLStageTargets(state.gl, width, height);
    return webglStageTargets;
  }

  function ensureWebGPUStageTargets(state: WebGPUState): WebGPUStageTargets | null {
    const { width, height } = options.getCanvasSize();
    if (
      webgpuStageTargets &&
      webgpuStageTargets.width === width &&
      webgpuStageTargets.height === height
    ) {
      return webgpuStageTargets;
    }
    destroyWebGPUStageTargets();
    webgpuStageTargets = createWebGPUStageTargets(state.device, state.format, width, height);
    if (compiledWebGPUShaderStages.length) {
      rebuildWebGPUStageBindGroups(state.device, compiledWebGPUShaderStages, webgpuStageTargets);
    }
    return webgpuStageTargets;
  }

  function rebuildWebGPUShaderStages(state: WebGPUState): void {
    clearWebGPUShaderStages();
    const nextStages = getActiveShaderStagesForBackend("webgpu");
    for (let i = 0; i < nextStages.length; i += 1) {
      const compiled = compileShaderStagePipelineWebGPU({
        device: state.device,
        format: state.format,
        stage: nextStages[i],
        reportError: reportShaderStageError,
      });
      if (compiled) compiledWebGPUShaderStages.push(compiled);
    }
    if (!compiledWebGPUShaderStages.length) {
      destroyWebGPUStageTargets();
      return;
    }
    const targets = ensureWebGPUStageTargets(state);
    if (!targets) return;
    rebuildWebGPUStageBindGroups(state.device, compiledWebGPUShaderStages, targets);
  }

  function rebuildWebGLShaderStages(state: WebGLState): void {
    clearWebGLShaderStages(state);
    const nextStages = getActiveShaderStagesForBackend("webgl2");
    for (let i = 0; i < nextStages.length; i += 1) {
      const compiled = compileShaderStageProgram({
        gl: state.gl,
        stage: nextStages[i],
        reportError: reportShaderStageError,
      });
      if (compiled) compiledWebGLShaderStages.push(compiled);
    }
    if (!compiledWebGLShaderStages.length) {
      destroyWebGLStageTargets(state);
    }
  }

  function setShaderStages(stages: ResttyShaderStage[]): void {
    try {
      shaderStages = parseShaderStages(stages ?? []);
    } catch (error: unknown) {
      const text = `[shader-stage] invalid configuration: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.warn(text);
      shaderStages = [];
    }
    shaderStagesDirty = true;
    options.onShaderStagesChanged();
  }

  return {
    setShaderStages,
    getShaderStages: () => cloneShaderStages(shaderStages),
    isShaderStagesDirty: () => shaderStagesDirty,
    setShaderStagesDirty: (value: boolean) => {
      shaderStagesDirty = value;
    },
    getCompiledWebGPUShaderStages: () => compiledWebGPUShaderStages,
    getCompiledWebGLShaderStages: () => compiledWebGLShaderStages,
    clearWebGPUShaderStages,
    clearWebGLShaderStages,
    destroyWebGPUStageTargets,
    destroyWebGLStageTargets,
    ensureWebGPUStageTargets,
    ensureWebGLStageTargets,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
  };
}

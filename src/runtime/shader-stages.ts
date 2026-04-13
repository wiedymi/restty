import type {
  ResttyShaderStage,
  ResttyShaderStageBackend,
  ResttyShaderStageMode,
} from "./core/models";

export const RESTTY_SHADER_STAGE_UNIFORM_CAP = 8;

const MODE_RANK: Record<ResttyShaderStageMode, number> = {
  "before-main": 0,
  "after-main": 1,
  "replace-main": 2,
};

function isStageMode(value: unknown): value is ResttyShaderStageMode {
  return value === "before-main" || value === "after-main" || value === "replace-main";
}

function isStageBackend(value: unknown): value is ResttyShaderStageBackend {
  return value === "webgpu" || value === "webgl2" || value === "both";
}

export function cloneShaderStage(stage: ResttyShaderStage): ResttyShaderStage {
  return {
    ...stage,
    shader: { ...stage.shader },
    uniforms: stage.uniforms ? [...stage.uniforms] : undefined,
  };
}

export function cloneShaderStages(stages: ResttyShaderStage[]): ResttyShaderStage[] {
  return stages.map((stage) => cloneShaderStage(stage));
}

export function normalizeShaderStage(stage: ResttyShaderStage): ResttyShaderStage {
  if (!stage || typeof stage !== "object") {
    throw new Error("Restty shader stage must be an object");
  }
  const id = stage.id?.trim?.() ?? "";
  if (!id) {
    throw new Error("Restty shader stage id is required");
  }

  const mode: ResttyShaderStageMode = isStageMode(stage.mode) ? stage.mode : "after-main";
  const backend: ResttyShaderStageBackend = isStageBackend(stage.backend) ? stage.backend : "both";
  const priority = Number.isFinite(stage.priority) ? Number(stage.priority) : 0;
  const enabled = stage.enabled ?? true;
  const uniforms = (stage.uniforms ?? [])
    .filter((value) => Number.isFinite(value))
    .slice(0, RESTTY_SHADER_STAGE_UNIFORM_CAP);
  const shader = {
    wgsl: stage.shader?.wgsl?.trim?.() || undefined,
    glsl: stage.shader?.glsl?.trim?.() || undefined,
  };

  return {
    id,
    mode,
    backend,
    priority,
    enabled: Boolean(enabled),
    uniforms,
    shader,
    onError: stage.onError,
  };
}

export function normalizeShaderStages(stages: ResttyShaderStage[]): ResttyShaderStage[] {
  const normalized: ResttyShaderStage[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < stages.length; i += 1) {
    const stage = normalizeShaderStage(stages[i]);
    if (ids.has(stage.id)) {
      throw new Error(`Restty shader stage id ${stage.id} is duplicated`);
    }
    ids.add(stage.id);
    normalized.push(stage);
  }
  return normalized;
}

export function sortShaderStages(stages: ResttyShaderStage[]): ResttyShaderStage[] {
  const indexed = stages.map((stage, index) => ({ stage, index }));
  indexed.sort((a, b) => {
    const modeDiff =
      MODE_RANK[a.stage.mode ?? "after-main"] - MODE_RANK[b.stage.mode ?? "after-main"];
    if (modeDiff !== 0) return modeDiff;
    const priorityDiff = (a.stage.priority ?? 0) - (b.stage.priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return a.index - b.index;
  });
  return indexed.map((entry) => entry.stage);
}

export function packShaderStageUniforms(stage: ResttyShaderStage): Float32Array {
  const out = new Float32Array(RESTTY_SHADER_STAGE_UNIFORM_CAP);
  const input = stage.uniforms ?? [];
  const count =
    input.length > RESTTY_SHADER_STAGE_UNIFORM_CAP ? RESTTY_SHADER_STAGE_UNIFORM_CAP : input.length;
  for (let i = 0; i < count; i += 1) {
    const value = input[i];
    if (Number.isFinite(value)) out[i] = Number(value);
  }
  return out;
}

export function isShaderStageEnabledForBackend(
  stage: ResttyShaderStage,
  backend: "webgpu" | "webgl2",
): boolean {
  if (stage.enabled === false) return false;
  const target = stage.backend ?? "both";
  if (target === "both") return true;
  return target === backend;
}

import type { ResttyManagedPane } from "../panes/managed-pane-types";
import type { ResttyRenderStageHandle } from "../plugins/types";
import type { ResttyShaderStage } from "../../runtime/core/models";
import type { ResttyManagedShaderStage } from "../plugins/runtime";
import {
  cloneShaderStages,
  normalizeShaderStage,
  normalizeShaderStages,
  sortShaderStages,
} from "../../runtime/shader-stages";

type ResttyShaderOpsDeps = {
  getPanes: () => ResttyManagedPane[];
  getPaneById: (id: number) => ResttyManagedPane | null;
};

export class ResttyShaderOps {
  private readonly paneBaseShaderStages = new Map<number, ResttyShaderStage[]>();
  private readonly globalShaderStages = new Map<string, ResttyManagedShaderStage>();
  private nextShaderStageOrder = 1;
  private readonly deps: ResttyShaderOpsDeps;

  constructor(deps: ResttyShaderOpsDeps, shaderStages?: ResttyShaderStage[]) {
    this.deps = deps;
    if (shaderStages?.length) {
      const normalized = sortShaderStages(normalizeShaderStages(shaderStages));
      for (let i = 0; i < normalized.length; i += 1) {
        const stage = normalized[i];
        this.globalShaderStages.set(stage.id, {
          id: stage.id,
          stage,
          order: this.nextShaderStageOrder++,
          ownerPluginId: null,
        });
      }
    }
  }

  setShaderStages(stages: ResttyShaderStage[]): void {
    this.globalShaderStages.clear();
    const normalized = sortShaderStages(normalizeShaderStages(stages ?? []));
    for (let i = 0; i < normalized.length; i += 1) {
      const stage = normalized[i];
      this.globalShaderStages.set(stage.id, {
        id: stage.id,
        stage,
        order: this.nextShaderStageOrder++,
        ownerPluginId: null,
      });
    }
    this.syncPaneShaderStages();
  }

  getShaderStages(): ResttyShaderStage[] {
    return cloneShaderStages(this.listGlobalShaderStages().map((entry) => entry.stage));
  }

  addShaderStage(stage: ResttyShaderStage): ResttyRenderStageHandle {
    const normalized = normalizeShaderStage(stage);
    return this.addManagedShaderStage(normalized, null);
  }

  addManagedShaderStage(
    stage: ResttyShaderStage,
    ownerPluginId: string | null,
  ): ResttyRenderStageHandle {
    const normalized = normalizeShaderStage(stage);
    this.globalShaderStages.set(normalized.id, {
      id: normalized.id,
      stage: normalized,
      order: this.nextShaderStageOrder++,
      ownerPluginId,
    });
    this.syncPaneShaderStages();
    return {
      id: normalized.id,
      setUniforms: (uniforms: number[]) => {
        const current = this.globalShaderStages.get(normalized.id);
        if (!current) return;
        const next = normalizeShaderStage({
          ...current.stage,
          uniforms,
        });
        this.globalShaderStages.set(normalized.id, {
          ...current,
          stage: next,
        });
        this.syncPaneShaderStages();
      },
      setEnabled: (value: boolean) => {
        const current = this.globalShaderStages.get(normalized.id);
        if (!current) return;
        const next = normalizeShaderStage({
          ...current.stage,
          enabled: Boolean(value),
        });
        this.globalShaderStages.set(normalized.id, {
          ...current,
          stage: next,
        });
        this.syncPaneShaderStages();
      },
      dispose: () => {
        this.removeShaderStage(normalized.id);
      },
    };
  }

  removeShaderStage(id: string): boolean {
    const stageId = id?.trim?.() ?? "";
    if (!stageId) return false;
    const removed = this.globalShaderStages.delete(stageId);
    if (removed) {
      this.syncPaneShaderStages();
    }
    return removed;
  }

  normalizePaneShaderStages(
    stages: ResttyShaderStage[] | undefined,
    paneId: number,
  ): ResttyShaderStage[] {
    if (!stages?.length) return [];
    try {
      return sortShaderStages(normalizeShaderStages(stages));
    } catch (error) {
      console.warn(`[restty shader-stage] invalid pane stage config for pane ${paneId}:`, error);
      return [];
    }
  }

  setPaneBaseShaderStages(paneId: number, stages: ResttyShaderStage[]): void {
    this.paneBaseShaderStages.set(paneId, stages);
  }

  removePaneBaseShaderStages(paneId: number): void {
    this.paneBaseShaderStages.delete(paneId);
  }

  buildMergedShaderStages(baseStages: ResttyShaderStage[]): ResttyShaderStage[] {
    const merged = new Map<string, ResttyShaderStage>();
    for (let i = 0; i < baseStages.length; i += 1) {
      const stage = baseStages[i];
      merged.set(stage.id, stage);
    }
    const globals = this.listGlobalShaderStages();
    for (let i = 0; i < globals.length; i += 1) {
      const stage = globals[i].stage;
      if (merged.has(stage.id)) merged.delete(stage.id);
      merged.set(stage.id, stage);
    }
    return sortShaderStages(Array.from(merged.values()));
  }

  syncPaneShaderStages(paneId?: number): void {
    const panes: ResttyManagedPane[] = [];
    if (paneId === undefined) {
      panes.push(...this.deps.getPanes());
    } else {
      const pane = this.deps.getPaneById(paneId);
      if (pane) panes.push(pane);
    }
    for (let i = 0; i < panes.length; i += 1) {
      const pane = panes[i];
      const base = this.paneBaseShaderStages.get(pane.id) ?? [];
      pane.app.render.setShaderStages(this.buildMergedShaderStages(base));
    }
  }

  clear(): void {
    this.globalShaderStages.clear();
    this.paneBaseShaderStages.clear();
  }

  private listGlobalShaderStages(): ResttyManagedShaderStage[] {
    return Array.from(this.globalShaderStages.values()).sort((a, b) => a.order - b.order);
  }
}

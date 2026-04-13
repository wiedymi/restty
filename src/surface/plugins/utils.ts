export type ResttyPluginApiRangeLike = {
  min: number;
  max?: number;
};

export type ResttyPluginRequiresLike = {
  pluginApi?: number | ResttyPluginApiRangeLike;
};

export type ResttyPluginLike = {
  id: string;
  version?: string;
  apiVersion?: number;
  requires?: ResttyPluginRequiresLike;
};

export type ResttyPluginCleanupLike =
  | void
  | (() => void)
  | {
      dispose: () => void;
    };

export function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || "Unknown error";
  return String(error);
}

export function normalizePluginMetadata<T extends ResttyPluginLike>(
  plugin: T,
  pluginId: string,
): T {
  return {
    ...plugin,
    id: pluginId,
    version: plugin.version?.trim?.() || undefined,
    apiVersion: Number.isFinite(plugin.apiVersion)
      ? Math.trunc(Number(plugin.apiVersion))
      : undefined,
    requires: plugin.requires ?? undefined,
  };
}

export function assertPluginCompatibility(
  pluginId: string,
  plugin: ResttyPluginLike,
  pluginApiVersion: number,
): void {
  const version = plugin.version?.trim?.();
  if (version !== undefined && !version) {
    throw new Error(`Restty plugin ${pluginId} has an empty version`);
  }

  if (plugin.apiVersion !== undefined) {
    if (!Number.isInteger(plugin.apiVersion) || plugin.apiVersion < 1) {
      throw new Error(
        `Restty plugin ${pluginId} has invalid apiVersion ${String(plugin.apiVersion)}`,
      );
    }
    if (plugin.apiVersion !== pluginApiVersion) {
      throw new Error(
        `Restty plugin ${pluginId} requires apiVersion ${plugin.apiVersion}, current is ${pluginApiVersion}`,
      );
    }
  }

  const requirement = plugin.requires?.pluginApi;
  if (requirement === undefined) return;
  if (typeof requirement === "number") {
    if (!Number.isInteger(requirement) || requirement < 1) {
      throw new Error(`Restty plugin ${pluginId} has invalid requires.pluginApi value`);
    }
    if (requirement !== pluginApiVersion) {
      throw new Error(
        `Restty plugin ${pluginId} requires pluginApi ${requirement}, current is ${pluginApiVersion}`,
      );
    }
    return;
  }

  const min = requirement.min;
  const max = requirement.max;
  if (!Number.isInteger(min) || min < 1) {
    throw new Error(`Restty plugin ${pluginId} has invalid requires.pluginApi.min`);
  }
  if (max !== undefined && (!Number.isInteger(max) || max < min)) {
    throw new Error(`Restty plugin ${pluginId} has invalid requires.pluginApi.max`);
  }
  if (pluginApiVersion < min || (max !== undefined && pluginApiVersion > max)) {
    const range = max === undefined ? `>=${min}` : `${min}-${max}`;
    throw new Error(
      `Restty plugin ${pluginId} requires pluginApi range ${range}, current is ${pluginApiVersion}`,
    );
  }
}

export function lookupPluginRegistryEntry<T>(
  registry: ReadonlyMap<string, T> | Record<string, T>,
  pluginId: string,
): T | null {
  if (registry instanceof Map) {
    return registry.get(pluginId) ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(registry, pluginId)) {
    return registry[pluginId];
  }
  return null;
}

export async function resolvePluginRegistryEntry<T>(entry: T | (() => T | Promise<T>)): Promise<T> {
  if (typeof entry === "function") {
    return await (entry as () => T | Promise<T>)();
  }
  return entry;
}

export function normalizePluginCleanup(cleanup: ResttyPluginCleanupLike): (() => void) | null {
  if (!cleanup) return null;
  if (typeof cleanup === "function") return cleanup;
  if (typeof cleanup === "object" && typeof cleanup.dispose === "function") {
    return () => cleanup.dispose();
  }
  return null;
}

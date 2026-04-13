import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = process.cwd();
const runtimeRoot = resolve(repoRoot, "src/runtime");
const runtimeCreateRuntimeRoot = resolve(repoRoot, "src/runtime/create-runtime");
const runtimeTypesEntry = resolve(runtimeRoot, "types.ts");
const surfaceRoot = resolve(repoRoot, "src/surface");
const managedPaneManagerEntry = resolve(surfaceRoot, "panes/managed-pane-manager.ts");
const playgroundRoot = resolve(repoRoot, "playground");
const playgroundPublicRoot = resolve(playgroundRoot, "public");
const playgroundDistRoot = resolve(playgroundRoot, "dist");
const internalEntry = resolve(repoRoot, "src/internal.ts");
const internalRoot = resolve(repoRoot, "src/internal");

function listTsFiles(root: string, options: { exclude?: string[] } = {}): string[] {
  const excludeRoots = (options.exclude ?? []).map((path) => resolve(path));
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = resolve(dir, entry.name);
      if (
        excludeRoots.some(
          (excluded) => fullPath === excluded || fullPath.startsWith(`${excluded}/`),
        )
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && fullPath.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  }

  walk(resolve(root));
  return files.sort();
}

function extractModuleSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const staticPattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[\w*\s{},$]+?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

  for (const pattern of [staticPattern, dynamicPattern]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers];
}

function resolveLocalSpecifier(sourceFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;

  const basePath = resolve(dirname(sourceFile), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    join(basePath, "index.ts"),
    join(basePath, "index.tsx"),
    join(basePath, "index.js"),
    join(basePath, "index.mjs"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return resolve(candidate);
    }
  }

  return null;
}

function collectResolvedImports(
  files: string[],
): Array<{ file: string; specifier: string; resolved: string }> {
  const imports: Array<{ file: string; specifier: string; resolved: string }> = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const specifier of extractModuleSpecifiers(source)) {
      const resolved = resolveLocalSpecifier(file, specifier);
      if (resolved) {
        imports.push({ file, specifier, resolved });
      }
    }
  }

  return imports;
}

test("runtime source does not import surface modules", () => {
  const runtimeFiles = listTsFiles(runtimeRoot);
  const offenders = collectResolvedImports(runtimeFiles).filter(({ resolved }) => {
    return resolved === surfaceRoot || resolved.startsWith(`${surfaceRoot}/`);
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("runtime internals do not import src/runtime/types.ts", () => {
  const runtimeFiles = listTsFiles(runtimeRoot).filter((file) => {
    return file !== runtimeTypesEntry && file !== resolve(runtimeRoot, "create-runtime.ts");
  });
  const offenders = collectResolvedImports(runtimeFiles).filter(({ resolved }) => {
    return resolved === runtimeTypesEntry;
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("runtime internals do not use interaction-runtime/index.ts as a type barrel", () => {
  const runtimeFiles = listTsFiles(runtimeCreateRuntimeRoot).filter((file) => {
    return file !== resolve(runtimeCreateRuntimeRoot, "interaction-runtime/index.ts");
  });
  const offenders = collectResolvedImports(runtimeFiles).filter(({ resolved }) => {
    return resolved === resolve(runtimeCreateRuntimeRoot, "interaction-runtime/index.ts");
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("legacy mixed interaction-runtime types barrel is removed", () => {
  expect(existsSync(resolve(runtimeCreateRuntimeRoot, "interaction-runtime/types.ts"))).toBe(false);
});

test("runtime controller and reporting point at split interaction contracts", () => {
  const controllerApiTypes = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.api.types.ts"),
    "utf8",
  );
  const reportingTypes = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-reporting.types.ts"),
    "utf8",
  );

  expect(controllerApiTypes).toContain("./interaction-runtime/runtime.types");
  expect(reportingTypes).toContain("./interaction-runtime/state.types");
});

test("runtime controller delegates public api projection to a dedicated module", () => {
  const runtimeController = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.ts"),
    "utf8",
  );
  const runtimeControllerPublicApi = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.public-api.ts"),
    "utf8",
  );

  expect(runtimeController).toContain('./runtime-controller.public-api"');
  expect(runtimeController).not.toContain("function createPublicApi(");
  expect(runtimeControllerPublicApi).toContain("export function createRuntimePublicApi");
  expect(runtimeControllerPublicApi).toContain("deps.runtimeEvents.subscribe(listener)");
});

test("runtime controller delegates lifecycle orchestration to a dedicated module", () => {
  const runtimeController = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.ts"),
    "utf8",
  );
  const runtimeControllerLifecycle = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.lifecycle.ts"),
    "utf8",
  );

  expect(runtimeController).toContain('./runtime-controller.lifecycle"');
  expect(runtimeController).not.toContain("async function init(");
  expect(runtimeController).not.toContain("function destroy()");
  expect(runtimeControllerLifecycle).toContain("export function createRuntimeControllerLifecycle");
  expect(runtimeControllerLifecycle).toContain('setLifecycleState("initializing")');
});

test("legacy combined runtime controller types file is removed", () => {
  expect(existsSync(resolve(runtimeCreateRuntimeRoot, "runtime-controller.types.ts"))).toBe(false);
});

test("scrollbar runtime contract is split from generic interaction state", () => {
  const interactionStateTypes = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "interaction-runtime/state.types.ts"),
    "utf8",
  );
  const scrollbarRuntime = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "interaction-runtime/scrollbar-runtime.ts"),
    "utf8",
  );

  expect(interactionStateTypes).not.toContain("CreateScrollbarRuntimeOptions");
  expect(interactionStateTypes).not.toContain("ScrollbarRuntime");
  expect(scrollbarRuntime).toContain("./scrollbar-runtime.types");
});

test("max scrollback contract is split from implementation", () => {
  const maxScrollback = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "max-scrollback.ts"),
    "utf8",
  );

  expect(maxScrollback).not.toContain("type MaxScrollbackOptions =");
  expect(maxScrollback).toContain("./max-scrollback.types");
});

test("font runtime webgpu atlas contract is split from implementation", () => {
  const webgpuAtlas = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "font-runtime/webgpu-atlas.ts"),
    "utf8",
  );

  expect(webgpuAtlas).not.toContain("type CreateRuntimeWebGPUAtlasHelpersOptions =");
  expect(webgpuAtlas).toContain("./webgpu-atlas.types");
});

test("font runtime text helper contract is split from implementation", () => {
  const textHelpers = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "font-runtime/text.ts"),
    "utf8",
  );

  expect(textHelpers).not.toContain("type CreateFontRuntimeTextHelpersOptions =");
  expect(textHelpers).toContain("./text.types");
});

test("kitty image cache contract is split from implementation", () => {
  const kittyImageCache = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "interaction-runtime/kitty-image-cache.ts"),
    "utf8",
  );

  expect(kittyImageCache).not.toContain("type CreateKittyImageCacheOptions =");
  expect(kittyImageCache).toContain("./kitty-image-cache.types");
});

test("runtime internals do not use render-tick-webgl-context.ts as a type barrel", () => {
  const runtimeFiles = listTsFiles(runtimeCreateRuntimeRoot).filter((file) => {
    return (
      file !== resolve(runtimeCreateRuntimeRoot, "render-tick-webgl-context.ts") &&
      file !== resolve(runtimeCreateRuntimeRoot, "render-tick-webgl.ts")
    );
  });
  const offenders = collectResolvedImports(runtimeFiles).filter(({ resolved }) => {
    return resolved === resolve(runtimeCreateRuntimeRoot, "render-tick-webgl-context.ts");
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("shader stage runtime contracts do not import render stage types through create-app-types", () => {
  expect(existsSync(resolve(runtimeCreateRuntimeRoot, "create-app-types.ts"))).toBe(false);
});

test("shader stage runtime contracts point directly at render-stage-runtime types", () => {
  const source = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "shader-stage-runtime.types.ts"),
    "utf8",
  );

  expect(source).toContain("./render-stage-runtime.types");
});

test("legacy runtime debug-tools directory is removed", () => {
  expect(existsSync(resolve(runtimeCreateRuntimeRoot, "debug-tools.ts"))).toBe(false);
  expect(existsSync(resolve(runtimeCreateRuntimeRoot, "debug-tools/setup-debug-expose.ts"))).toBe(
    false,
  );
});

test("legacy runtime logger helper is removed", () => {
  expect(existsSync(resolve(runtimeCreateRuntimeRoot, "runtime-logger.ts"))).toBe(false);
  expect(existsSync(resolve(runtimeCreateRuntimeRoot, "runtime-logger.types.ts"))).toBe(false);
});

test("surface source does not import runtime create-runtime internals", () => {
  const surfaceFiles = listTsFiles(surfaceRoot);
  const offenders = collectResolvedImports(surfaceFiles).filter(({ resolved }) => {
    return resolved.startsWith(`${runtimeCreateRuntimeRoot}/`);
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("surface config helpers do not depend on manager option indexed access types", () => {
  const paneHelperFiles = [
    resolve(surfaceRoot, "panes/managed-pane-create.ts"),
    resolve(surfaceRoot, "panes/managed-pane-runtime.ts"),
    resolve(surfaceRoot, "panes/managed-pane-runtime-config.ts"),
    resolve(surfaceRoot, "restty/manager-options.ts"),
  ];
  const offenders = paneHelperFiles.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const matches = source.match(
      /CreateResttyManagedPaneManagerOptions\["(?:terminal|services)"\]/g,
    );
    return matches ? [`${relative(repoRoot, file)} -> ${matches[0]}`] : [];
  });

  expect(offenders).toEqual([]);
});

test("surface manager options contracts are split from implementation", () => {
  const managerOptions = readFileSync(resolve(surfaceRoot, "restty/manager-options.ts"), "utf8");

  expect(managerOptions).not.toContain("type PaneManagerEventHandlers =");
  expect(managerOptions).not.toContain("type MergedPaneTerminalConfigDeps =");
  expect(managerOptions).not.toContain("type MergedPaneServicesConfigDeps =");
  expect(managerOptions).not.toContain("type PaneManagerCallbacksDeps =");
  expect(managerOptions).toContain("./manager-options.types");
});

test("surface managed pane creation and runtime contracts are split from implementation", () => {
  const managedPaneCreate = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-create.ts"),
    "utf8",
  );
  const managedPaneRuntime = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-runtime.ts"),
    "utf8",
  );

  expect(managedPaneCreate).not.toContain("export type ManagedPaneDomClassNames =");
  expect(managedPaneCreate).not.toContain("export type CreateManagedPaneOptions =");
  expect(managedPaneCreate).toContain("./managed-pane-create.types");

  expect(managedPaneRuntime).not.toContain("export type CreateManagedPaneRuntimeOptions =");
  expect(managedPaneRuntime).toContain("./managed-pane-runtime.types");
});

test("surface managed pane runtime config contract is split from implementation", () => {
  const managedPaneRuntimeConfig = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-runtime-config.ts"),
    "utf8",
  );

  expect(managedPaneRuntimeConfig).not.toContain(
    "export type CreateManagedPaneRuntimeConfigOptions =",
  );
  expect(managedPaneRuntimeConfig).toContain("./managed-pane-runtime-config.types");
});

test("surface managed pane option resolution uses a narrow local contract", () => {
  const managedPaneOptions = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-options.ts"),
    "utf8",
  );

  expect(managedPaneOptions).not.toContain('CreateResttyManagedPaneManagerOptions["shortcuts"]');
  expect(managedPaneOptions).not.toContain("Pick<CreateResttyManagedPaneManagerOptions");
  expect(managedPaneOptions).toContain("./managed-pane-options.types");
});

test("surface public config and events do not expose ResttyManagedPane", () => {
  const surfaceConfig = readFileSync(resolve(surfaceRoot, "restty/config.ts"), "utf8");
  const surfaceEvents = readFileSync(resolve(surfaceRoot, "restty/events.ts"), "utf8");
  const surfaceRestty = readFileSync(resolve(surfaceRoot, "restty.ts"), "utf8");
  const managedPaneTypes = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-types.ts"),
    "utf8",
  );

  expect(surfaceConfig).not.toContain("ResttyPaneContextMenuOptions<ResttyManagedPane>");
  expect(surfaceEvents).not.toContain("onPaneCreated?: (pane: ResttyManagedPane)");
  expect(surfaceEvents).not.toContain("onPaneClosed?: (pane: ResttyManagedPane)");
  expect(surfaceEvents).not.toContain("sourcePane: ResttyManagedPane");
  expect(surfaceEvents).not.toContain("createdPane: ResttyManagedPane");
  expect(surfaceEvents).not.toContain("onActivePaneChange?: (pane: ResttyManagedPane | null)");
  expect(surfaceEvents).toContain("export type ResttySurfacePane = ResttyPaneWithRuntime;");
  expect(managedPaneTypes).not.toContain("canOpen?: (event: MouseEvent, pane: ResttyManagedPane)");
  expect(surfaceRestty).toContain('type { ResttySurfacePane } from "./restty/events"');
  expect(surfaceRestty).not.toContain("getPanes(): ResttyManagedPane[]");
  expect(surfaceRestty).not.toContain("getPaneById(id: number): ResttyManagedPane | null");
  expect(surfaceRestty).not.toContain("getActivePane(): ResttyManagedPane | null");
  expect(surfaceRestty).not.toContain("getFocusedPane(): ResttyManagedPane | null");
});

test("surface plugin runtime and dispatcher contracts are split from implementation", () => {
  const pluginRuntime = readFileSync(resolve(surfaceRoot, "plugins/runtime.ts"), "utf8");
  const pluginDispatcher = readFileSync(resolve(surfaceRoot, "plugins/dispatcher.ts"), "utf8");

  expect(pluginRuntime).not.toContain("export type ResttyPluginRuntime =");
  expect(pluginRuntime).not.toContain("export type ResttyPluginDiagnostic =");
  expect(pluginRuntime).toContain("./runtime.types");

  expect(pluginDispatcher).not.toContain("export type ResttyPluginHostDeps =");
  expect(pluginDispatcher).toContain("./dispatcher.types");
});

test("surface plugin context contracts are split from the plugin barrel", () => {
  const pluginTypes = readFileSync(resolve(surfaceRoot, "plugins/types.ts"), "utf8");

  expect(pluginTypes).not.toContain("export type ResttyPluginContext =");
  expect(pluginTypes).not.toContain("export type ResttyPlugin =");
  expect(pluginTypes).not.toContain("export type ResttyRenderStageHandle =");
  expect(pluginTypes).not.toContain("export type ResttyPluginDisposable =");
  expect(pluginTypes).toContain("./context.types");
});

test("surface plugin context depends on a plugin host api instead of the full Restty class", () => {
  const pluginContext = readFileSync(resolve(surfaceRoot, "plugins/context.types.ts"), "utf8");
  const pluginDispatcherDeps = readFileSync(
    resolve(surfaceRoot, "plugins/dispatcher.types.ts"),
    "utf8",
  );

  expect(pluginContext).not.toContain('type { Restty } from "../restty"');
  expect(pluginContext).not.toContain("restty: Restty;");
  expect(pluginContext).toContain("export type ResttyPluginHostApi =");
  expect(pluginContext).toContain("restty: ResttyPluginHostApi;");

  expect(pluginDispatcherDeps).not.toContain('type { Restty } from "../restty"');
  expect(pluginDispatcherDeps).toContain('from "./context.types"');
});

test("surface restty delegates plugin bridge wiring to the restty controller", () => {
  const resttySource = readFileSync(resolve(surfaceRoot, "restty.ts"), "utf8");
  const resttyController = readFileSync(resolve(surfaceRoot, "restty/controller.ts"), "utf8");

  expect(resttySource).toContain(
    'import { ResttyController, createResttyPluginSurfaceApi } from "./restty/controller"',
  );
  expect(resttySource).not.toContain('from "./plugins/host"');
  expect(resttySource).not.toContain("private createPluginSurfaceApi()");

  expect(resttyController).toContain("export function createResttyPluginSurfaceApi");
  expect(resttyController).toContain("new ResttyPluginHost(deps)");
});

test("surface restty helpers do not import managed-pane-manager for type access", () => {
  const helperFiles = [
    resolve(surfaceRoot, "restty/pane-handle.ts"),
    resolve(surfaceRoot, "restty/active-pane-api.ts"),
    resolve(surfaceRoot, "restty/config.ts"),
    resolve(surfaceRoot, "restty/events.ts"),
    resolve(surfaceRoot, "restty/pane-ops.ts"),
    resolve(surfaceRoot, "restty/shader-ops.ts"),
  ];
  const offenders = collectResolvedImports(helperFiles).filter(({ resolved }) => {
    return resolved === managedPaneManagerEntry;
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("surface restty facade imports managed-pane-manager for factory only", () => {
  const resttyFile = resolve(surfaceRoot, "restty.ts");
  const source = readFileSync(resttyFile, "utf8");

  expect(source).not.toMatch(/createResttyManagedPaneManager,\s*type\s+/);
  expect(source).toMatch(
    /import\s+\{\s*createResttyManagedPaneManager\s*,?\s*\}\s+from\s+"\.\/panes\/managed-pane-manager"/,
  );
});

test("surface public entrypoints do not use managed-pane-manager as a type barrel", () => {
  const indexSource = readFileSync(resolve(repoRoot, "src/index.ts"), "utf8");
  const internalSurfaceSource = readFileSync(resolve(internalRoot, "surface.ts"), "utf8");

  expect(indexSource).not.toContain("./surface/managed-pane-manager");
  expect(internalSurfaceSource).not.toMatch(
    /export\s+type\s*\{[^}]+\}\s+from\s+"..\/surface\/panes\/managed-pane-manager"/s,
  );
  expect(internalSurfaceSource).toContain(
    'createResttyManagedPaneManager } from "../surface/panes/managed-pane-manager"',
  );
});

test("playground source does not import src/internal.ts", () => {
  const playgroundFiles = listTsFiles(playgroundRoot, {
    exclude: [playgroundPublicRoot, playgroundDistRoot],
  });
  const offenders = collectResolvedImports(playgroundFiles).filter(({ resolved }) => {
    return resolved === internalEntry;
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("src/internal.ts does not import runtime or surface modules directly", () => {
  const offenders = collectResolvedImports([internalEntry]).filter(({ resolved }) => {
    return (
      resolved === runtimeRoot ||
      resolved.startsWith(`${runtimeRoot}/`) ||
      resolved === surfaceRoot ||
      resolved.startsWith(`${surfaceRoot}/`)
    );
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
  expect(existsSync(resolve(internalRoot, "runtime.ts"))).toBe(true);
  expect(existsSync(resolve(internalRoot, "surface.ts"))).toBe(true);
});

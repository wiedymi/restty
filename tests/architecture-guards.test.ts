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
  const runtimeControllerPublicApiCapabilities = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.public-api.capabilities.ts"),
    "utf8",
  );

  expect(runtimeController).toContain('./runtime-controller.public-api"');
  expect(runtimeController).not.toContain("function createPublicApi(");
  expect(runtimeControllerPublicApi).toContain("export function createRuntimePublicApi");
  expect(runtimeControllerPublicApi).toContain('./runtime-controller.public-api.capabilities"');
  expect(runtimeControllerPublicApi).not.toContain("function setRenderer(");
  expect(runtimeControllerPublicApi).not.toContain("const terminal =");
  expect(runtimeControllerPublicApiCapabilities).toContain(
    "export function createRuntimeTerminalView",
  );
  expect(runtimeControllerPublicApiCapabilities).toContain(
    "export function createRuntimeEventsView",
  );
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

test("runtime controller delegates render loop orchestration to a dedicated module", () => {
  const runtimeController = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.ts"),
    "utf8",
  );
  const runtimeControllerRenderLoop = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.render-loop.ts"),
    "utf8",
  );

  expect(runtimeController).toContain('./runtime-controller.render-loop"');
  expect(runtimeController).not.toContain("function loop(");
  expect(runtimeController).not.toContain("function canRenderFrame(");
  expect(runtimeControllerRenderLoop).toContain(
    "export function createRuntimeControllerRenderLoop",
  );
  expect(runtimeControllerRenderLoop).toContain("requestAnimationFrame(() => loop(state))");
});

test("runtime controller delegates keyboard event binding to a dedicated module", () => {
  const runtimeController = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.ts"),
    "utf8",
  );
  const runtimeControllerKeyboard = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.keyboard.ts"),
    "utf8",
  );

  expect(runtimeController).toContain('./runtime-controller.keyboard"');
  expect(runtimeController).not.toContain("const onKeyDown =");
  expect(runtimeController).not.toContain("const onKeyUp =");
  expect(runtimeControllerKeyboard).toContain(
    "export function attachRuntimeControllerKeyboardEvents",
  );
  expect(runtimeControllerKeyboard).toContain('window.addEventListener("keydown", onKeyDown)');
});

test("runtime controller delegates wasm input forwarding to a dedicated module", () => {
  const runtimeController = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.ts"),
    "utf8",
  );
  const runtimeControllerInput = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.input.ts"),
    "utf8",
  );

  expect(runtimeController).toContain('./runtime-controller.input"');
  expect(runtimeController).not.toContain("function writeToWasm(");
  expect(runtimeController).not.toContain("function flushWasmOutputToPty(");
  expect(runtimeController).not.toContain("function sendInput(");
  expect(runtimeControllerInput).toContain("export function createRuntimeControllerInput");
  expect(runtimeControllerInput).toContain('sendInput("\\x1b[2J\\x1b[H")');
});

test("runtime controller delegates clipboard behavior to a dedicated module", () => {
  const runtimeController = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.ts"),
    "utf8",
  );
  const runtimeControllerClipboard = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.clipboard.ts"),
    "utf8",
  );

  expect(runtimeController).toContain('./runtime-controller.clipboard"');
  expect(runtimeController).not.toContain("async function copySelectionToClipboard()");
  expect(runtimeController).not.toContain("async function pasteFromClipboard()");
  expect(runtimeControllerClipboard).toContain("export function createRuntimeControllerClipboard");
  expect(runtimeControllerClipboard).toContain("options.ptyInputRuntime.sendPasteText(text)");
});

test("runtime controller options are grouped by capability", () => {
  const runtimeControllerApiTypes = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.api.types.ts"),
    "utf8",
  );
  const runtimeController = readFileSync(
    resolve(runtimeCreateRuntimeRoot, "runtime-controller.ts"),
    "utf8",
  );

  expect(runtimeControllerApiTypes).toContain("export type RuntimeControllerRuntimeDeps =");
  expect(runtimeControllerApiTypes).toContain("export type RuntimeControllerStateDeps =");
  expect(runtimeControllerApiTypes).toContain("export type RuntimeControllerPlatformDeps =");
  expect(runtimeControllerApiTypes).toContain("export type RuntimeControllerHookDeps =");
  expect(runtimeControllerApiTypes).toContain("export type RuntimeControllerRenderDeps =");
  expect(runtimeControllerApiTypes).toContain("export type RuntimeControllerLifecycleDeps =");
  expect(runtimeController).toContain("runtime,");
  expect(runtimeController).toContain("state,");
  expect(runtimeController).toContain("platform,");
  expect(runtimeController).toContain("hooks,");
  expect(runtimeController).toContain("render,");
  expect(runtimeController).toContain("lifecycle: lifecycleDeps");
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
  const resttyBootstrap = readFileSync(resolve(surfaceRoot, "restty/bootstrap.ts"), "utf8");
  const resttyAssembly = readFileSync(resolve(surfaceRoot, "restty/assembly.ts"), "utf8");
  const resttyPaneManagerAssembly = readFileSync(
    resolve(surfaceRoot, "restty/pane-manager-assembly.ts"),
    "utf8",
  );
  const resttyPluginSurface = readFileSync(
    resolve(surfaceRoot, "restty/plugin-surface.ts"),
    "utf8",
  );

  expect(resttySource).toContain('import { ResttyController } from "./restty/controller"');
  expect(resttySource).toContain('./restty/bootstrap"');
  expect(resttySource).not.toContain('./restty/plugin-surface"');
  expect(resttySource).not.toContain("createResttyPluginSurfaceApi({");
  expect(resttySource).not.toContain("createResttyManagedPaneManager({");
  expect(resttySource).not.toContain("createMergedPaneTerminalConfig({");
  expect(resttySource).not.toContain('from "./plugins/host"');
  expect(resttySource).not.toContain("private createPluginSurfaceApi()");

  expect(resttyController).toContain("export function createResttyPluginSurfaceApi");
  expect(resttyController).toContain("new ResttyPluginHost(deps)");
  expect(resttyBootstrap).toContain("export function bootstrapResttySurface");
  expect(resttyBootstrap).toContain("createResttyManagedPaneManager({");
  expect(resttyBootstrap).toContain('./assembly"');
  expect(resttyBootstrap).not.toContain("createResttyPluginSurfaceBridge(restty)");
  expect(resttyBootstrap).not.toContain("createMergedPaneTerminalConfig({");
  expect(resttyBootstrap).not.toContain("createMergedPaneServicesConfig({");
  expect(resttyPluginSurface).toContain("export function createResttyPluginSurfaceBridge");
  expect(resttyPluginSurface).toContain("createResttyPluginSurfaceApi({");
  expect(resttyAssembly).toContain("export function createResttySurfaceAssembly");
  expect(resttyAssembly).toContain("createResttyPluginSurfaceBridge(restty)");
  expect(resttyAssembly).toContain('./pane-manager-assembly"');
  expect(resttyAssembly).not.toContain("createMergedPaneTerminalConfig({");
  expect(resttyAssembly).not.toContain("createMergedPaneServicesConfig({");
  expect(resttyPaneManagerAssembly).toContain("export function createResttyPaneManagerAssembly");
  expect(resttyPaneManagerAssembly).toContain("createMergedPaneTerminalConfig({");
  expect(resttyPaneManagerAssembly).toContain("createMergedPaneServicesConfig({");
});

test("surface restty delegates pane lookup wiring to a dedicated module", () => {
  const resttySource = readFileSync(resolve(surfaceRoot, "restty.ts"), "utf8");
  const resttyPaneLookup = readFileSync(resolve(surfaceRoot, "restty/pane-lookup.ts"), "utf8");

  expect(resttySource).toContain('./restty/pane-lookup"');
  expect(resttySource).toContain("private readonly paneLookupOps:");
  expect(resttySource).not.toContain("private paneLookup()");
  expect(resttyPaneLookup).toContain("export function createResttyPaneLookup");
  expect(resttyPaneLookup).toContain("openPaneSearch: (id, searchOptions) =>");
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

test("surface restty bootstrap imports managed-pane-manager for factory only", () => {
  const resttyBootstrap = resolve(surfaceRoot, "restty/bootstrap.ts");
  const source = readFileSync(resttyBootstrap, "utf8");

  expect(source).not.toMatch(/createResttyManagedPaneManager,\s*type\s+/);
  expect(source).toMatch(
    /import\s+\{\s*createResttyManagedPaneManager\s*,?\s*\}\s+from\s+"\.\.\/panes\/managed-pane-manager"/,
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

test("playground app bootstrap delegates restty construction to the surface bootstrap", () => {
  const appBootstrap = readFileSync(resolve(playgroundRoot, "lib/app-bootstrap.ts"), "utf8");
  const orchestrator = readFileSync(
    resolve(playgroundRoot, "lib/playground-orchestrator.ts"),
    "utf8",
  );

  expect(appBootstrap).toContain('./playground-orchestrator.ts"');
  expect(appBootstrap).not.toContain("new Restty(");
  expect(orchestrator).toContain('./surface-bootstrap.ts"');
  expect(orchestrator).not.toContain("new Restty(");
  expect(orchestrator).toContain("startup: {");
  expect(orchestrator).toContain("state: {");
  expect(orchestrator).toContain("shell: {");
  expect(orchestrator).toContain("controllers: {");
});

test("playground surface bootstrap delegates startup lifecycle", () => {
  const surfaceBootstrap = readFileSync(
    resolve(playgroundRoot, "lib/surface-bootstrap.ts"),
    "utf8",
  );
  const surfaceAssembly = readFileSync(
    resolve(playgroundRoot, "lib/surface-bootstrap-assembly.ts"),
    "utf8",
  );
  const surfaceEvents = readFileSync(
    resolve(playgroundRoot, "lib/surface-bootstrap-events.ts"),
    "utf8",
  );
  const surfaceRuntime = readFileSync(
    resolve(playgroundRoot, "lib/surface-bootstrap-runtime.ts"),
    "utf8",
  );
  const surfaceStartup = readFileSync(resolve(playgroundRoot, "lib/surface-startup.ts"), "utf8");

  expect(surfaceBootstrap).toContain('./surface-startup.ts"');
  expect(surfaceBootstrap).toContain('./surface-bootstrap-assembly.ts"');
  expect(surfaceBootstrap).not.toContain("appearanceController.applyCurrentShaderPreset()");
  expect(surfaceBootstrap).not.toContain('target.addEventListener("resize"');
  expect(surfaceBootstrap).not.toContain("createInitialPane({ focus: true })");
  expect(surfaceBootstrap).not.toContain("createRestty({");
  expect(surfaceBootstrap).not.toContain("onPaneCreated:");
  expect(surfaceBootstrap).not.toContain("terminal: ({ id, sourcePane }) =>");
  expect(surfaceBootstrap).toContain("assemblePlaygroundSurface({");
  expect(surfaceStartup).toContain("export function createPlaygroundSurfaceStartup");
  expect(surfaceStartup).toContain("appearanceController.applyCurrentShaderPreset()");
  expect(surfaceStartup).toContain('target.addEventListener("resize"');
  expect(surfaceStartup).toContain("createInitialPane({ focus: true })");
  expect(surfaceAssembly).toContain("export function assemblePlaygroundSurface");
  expect(surfaceAssembly).toContain('./surface-bootstrap-events.ts"');
  expect(surfaceAssembly).toContain('./surface-bootstrap-runtime.ts"');
  expect(surfaceAssembly).toContain("createRestty({");
  expect(surfaceAssembly).not.toContain("onPaneCreated:");
  expect(surfaceAssembly).not.toContain("terminal: ({ id, sourcePane }) =>");
  expect(surfaceAssembly).not.toContain("services: () => ({");
  expect(surfaceAssembly).toContain("events: surfaceEvents");
  expect(surfaceAssembly).toContain("...runtimeFactories");
  expect(surfaceEvents).toContain("export function createPlaygroundSurfaceEvents");
  expect(surfaceEvents).toContain("onPaneCreated:");
  expect(surfaceEvents).toContain("onActivePaneChange:");
  expect(surfaceRuntime).toContain("export function createPlaygroundSurfaceRuntimeFactories");
  expect(surfaceRuntime).toContain("terminal: ({ id, sourcePane }) =>");
  expect(surfaceRuntime).toContain("services: () => ({");
});

test("playground app bootstrap delegates shell element lookup", () => {
  const appBootstrap = readFileSync(resolve(playgroundRoot, "lib/app-bootstrap.ts"), "utf8");

  expect(appBootstrap).toContain('./elements.ts"');
  expect(appBootstrap).toContain("queryPlaygroundElements");
  expect(appBootstrap).not.toContain("document.getElementById(");
  expect(appBootstrap).not.toContain("dataset.playgroundShell");
  expect(appBootstrap).not.toContain("createEmptyLegacyPlaygroundElements");
  expect(appBootstrap).not.toContain("querySharedPlaygroundElements");
  expect(appBootstrap).not.toContain("queryLegacyPlaygroundElements");
});

test("playground app entrypoint delegates controller orchestration to app bootstrap", () => {
  const appSource = readFileSync(resolve(playgroundRoot, "app.ts"), "utf8");
  const appBootstrap = readFileSync(resolve(playgroundRoot, "lib/app-bootstrap.ts"), "utf8");

  expect(appSource).toContain('./lib/app-bootstrap.ts"');
  expect(appSource).not.toContain("./lib/control-bindings");
  expect(appSource).not.toContain("./lib/appearance-controller");
  expect(appSource).not.toContain("./lib/connection-controller");
  expect(appSource).not.toContain("./lib/pane-lifecycle");
  expect(appBootstrap).toContain('./playground-orchestrator.ts"');
  expect(appBootstrap).not.toContain("bindConnectionControls(");
  expect(appBootstrap).not.toContain("bindTerminalControls(");
  expect(appBootstrap).not.toContain("bindAppearanceControls(");
});

test("playground app bootstrap delegates controller composition to a dedicated orchestrator", () => {
  const appBootstrap = readFileSync(resolve(playgroundRoot, "lib/app-bootstrap.ts"), "utf8");
  const orchestrator = readFileSync(
    resolve(playgroundRoot, "lib/playground-orchestrator.ts"),
    "utf8",
  );
  const session = readFileSync(resolve(playgroundRoot, "lib/playground-session.ts"), "utf8");

  expect(appBootstrap).toContain('./playground-orchestrator.ts"');
  expect(appBootstrap).not.toContain("createConnectionController(");
  expect(appBootstrap).not.toContain("createPaneAppearanceController(");
  expect(appBootstrap).not.toContain("createPaneLifecycleController(");
  expect(appBootstrap).not.toContain("usesSvelteShell");
  expect(appBootstrap).not.toContain("legacyElements");
  expect(orchestrator).toContain('./playground-session.ts"');
  expect(orchestrator).not.toContain("createConnectionController(");
  expect(orchestrator).not.toContain("createPaneAppearanceController(");
  expect(orchestrator).not.toContain("createPaneLifecycleController(");
  expect(orchestrator).not.toContain("getConnectionBackend(");
  expect(orchestrator).not.toContain("legacyElements");
  expect(orchestrator).not.toContain("LegacyPlaygroundElements");
  expect(orchestrator).toContain("DEFAULT_CONNECTION_BACKEND");
  expect(session).toContain('./playground-session-controllers.ts"');
  expect(session).toContain("createPlaygroundSessionControllers(");
  expect(session).not.toContain("createConnectionController(");
  expect(session).not.toContain("createPaneAppearanceController(");
  expect(session).not.toContain("createPaneLifecycleController(");
  expect(session).not.toContain("LegacyPlaygroundElements");
  expect(session).not.toContain("btnPause");
  expect(session).not.toContain("rendererSelect");
  expect(session).not.toContain("fontSizeInput");
});

test("playground orchestrator delegates shell control wiring to a dedicated module", () => {
  const orchestrator = readFileSync(
    resolve(playgroundRoot, "lib/playground-orchestrator.ts"),
    "utf8",
  );
  const wiring = readFileSync(resolve(playgroundRoot, "lib/playground-wiring.ts"), "utf8");
  const wiringTypes = readFileSync(
    resolve(playgroundRoot, "lib/playground-wiring.types.ts"),
    "utf8",
  );

  expect(orchestrator).toContain('./playground-wiring.ts"');
  expect(orchestrator).not.toContain("bindConnectionControls(");
  expect(orchestrator).not.toContain("bindTerminalControls(");
  expect(orchestrator).not.toContain("bindAppearanceControls(");
  expect(orchestrator).toContain("shell: {");
  expect(orchestrator).toContain("controllers: {");
  expect(orchestrator).toContain("state: {");
  expect(wiring).toContain("bindConnectionShellEffects(");
  expect(wiring).toContain("bindTerminalShellEffects(");
  expect(wiring).toContain("bindAppearanceShellEffects(");
  expect(wiringTypes).toContain("export type PlaygroundControlShell =");
  expect(wiringTypes).toContain("export type PlaygroundControlControllers =");
  expect(wiringTypes).toContain("export type PlaygroundControlState =");
  expect(wiringTypes).not.toContain("usesSvelteShell");
  expect(wiringTypes).not.toContain("legacyElements");
  expect(existsSync(resolve(playgroundRoot, "lib/playground-wiring.legacy.ts"))).toBe(false);
  expect(existsSync(resolve(playgroundRoot, "lib/playground-wiring.svelte.ts"))).toBe(false);
});

test("playground orchestrator delegates controller session setup to a dedicated module", () => {
  const orchestrator = readFileSync(
    resolve(playgroundRoot, "lib/playground-orchestrator.ts"),
    "utf8",
  );
  const session = readFileSync(resolve(playgroundRoot, "lib/playground-session.ts"), "utf8");
  const sessionControllers = readFileSync(
    resolve(playgroundRoot, "lib/playground-session-controllers.ts"),
    "utf8",
  );
  const sessionState = readFileSync(
    resolve(playgroundRoot, "lib/playground-session-state.ts"),
    "utf8",
  );
  const sessionShell = readFileSync(
    resolve(playgroundRoot, "lib/playground-session-shell.ts"),
    "utf8",
  );

  expect(orchestrator).toContain('./playground-session.ts"');
  expect(orchestrator).not.toContain("createConnectionController(");
  expect(orchestrator).not.toContain("createPaneAppearanceController(");
  expect(orchestrator).not.toContain("createPaneLifecycleController(");
  expect(orchestrator).not.toContain("createPlaygroundShellAdapter(");
  expect(session).toContain('./playground-session-controllers.ts"');
  expect(session).toContain('./playground-session-state.ts"');
  expect(session).toContain("createPlaygroundSessionControllers(");
  expect(session).toContain("createPlaygroundSessionState()");
  expect(session).not.toContain("createConnectionController(");
  expect(session).not.toContain("createPaneAppearanceController(");
  expect(session).not.toContain("createPaneLifecycleController(");
  expect(session).toContain('./playground-session-shell.ts"');
  expect(session).toContain("createPlaygroundSessionShell(");
  expect(session).not.toContain("createPlaygroundShellAdapter(");
  expect(session).not.toContain("createPaneShellSync(");
  expect(orchestrator).toContain("deps: {");
  expect(orchestrator).toContain("startup: {");
  expect(orchestrator).toContain("shell: {");
  expect(session).toContain("type PlaygroundSessionDeps =");
  expect(session).toContain("type PlaygroundSessionStartup =");
  expect(session).toContain("state,");
  expect(session).toContain("shell: {");
  expect(session).toContain("controllers = createPlaygroundSessionControllers(");
  expect(session).toContain("controllers,");
  expect(session).toContain("notifications: {");
  expect(sessionControllers).toContain("createConnectionController(");
  expect(sessionControllers).toContain("createPaneAppearanceController(");
  expect(sessionControllers).toContain("createPaneLifecycleController(");
  expect(sessionState).toContain("export function createPlaygroundSessionState");
  expect(sessionState).toContain("new Map<number, PaneState>()");
  expect(sessionState).toContain("let activePaneId: number | null = null");
  expect(sessionShell).toContain("createPlaygroundShellAdapter(");
  expect(sessionShell).toContain("createPaneShellSync(");
  expect(orchestrator).toContain("session.state.paneStates");
  expect(orchestrator).toContain("session.shell.shellAdapter");
  expect(orchestrator).toContain("session.controllers.paneLifecycle");
  expect(orchestrator).toContain("session.notifications.handleDesktopNotification");
});

test("playground no longer ships legacy runtime status or log widgets", () => {
  const playgroundApp = readFileSync(resolve(playgroundRoot, "app.ts"), "utf8");
  const playgroundIndex = readFileSync(resolve(playgroundPublicRoot, "index.html"), "utf8");
  const webcontainerPty = readFileSync(resolve(playgroundRoot, "lib/webcontainer-pty.ts"), "utf8");

  expect(playgroundApp).not.toContain('getElementById("backend")');
  expect(playgroundApp).not.toContain('getElementById("termSize")');
  expect(playgroundApp).not.toContain('getElementById("ptyStatus")');
  expect(playgroundApp).not.toContain("pane.runtime.events.subscribe(");

  expect(playgroundIndex).not.toContain('id="backend"');
  expect(playgroundIndex).not.toContain('id="termSize"');
  expect(playgroundIndex).not.toContain('id="ptyStatus"');
  expect(playgroundIndex).not.toContain('class="status-bar"');
  expect(playgroundIndex).not.toContain('class="pty-status"');

  expect(webcontainerPty).not.toContain("onLog?:");
  expect(webcontainerPty).not.toContain("[webcontainer]");
});

test("webcontainer pty delegates seed script bootstrap", () => {
  const webcontainerPty = readFileSync(resolve(playgroundRoot, "lib/webcontainer-pty.ts"), "utf8");
  const webcontainerLaunch = readFileSync(
    resolve(playgroundRoot, "lib/webcontainer-launch.ts"),
    "utf8",
  );
  const seedScripts = readFileSync(
    resolve(playgroundRoot, "lib/webcontainer-seed-scripts.ts"),
    "utf8",
  );

  expect(webcontainerPty).not.toContain('./webcontainer-seed-scripts.ts"');
  expect(webcontainerLaunch).toContain('./webcontainer-seed-scripts.ts"');
  expect(webcontainerLaunch).not.toContain("normalizeFetchedScript(");
  expect(webcontainerLaunch).not.toContain("restty demo fallback");
  expect(seedScripts).toContain("normalizeFetchedScript(");
  expect(seedScripts).toContain("restty demo fallback");
});

test("webcontainer pty delegates process lifecycle", () => {
  const webcontainerPty = readFileSync(resolve(playgroundRoot, "lib/webcontainer-pty.ts"), "utf8");
  const processController = readFileSync(
    resolve(playgroundRoot, "lib/webcontainer-process.ts"),
    "utf8",
  );

  expect(webcontainerPty).toContain('./webcontainer-process.ts"');
  expect(webcontainerPty).not.toContain("startOutputPump");
  expect(webcontainerPty).not.toContain("resetStreams");
  expect(webcontainerPty).not.toContain("handleConnectError =");
  expect(processController).toContain("startOutputPump");
  expect(processController).toContain("resetStreams");
  expect(processController).toContain("handleConnectError");
});

test("webcontainer pty delegates launch orchestration", () => {
  const webcontainerPty = readFileSync(resolve(playgroundRoot, "lib/webcontainer-pty.ts"), "utf8");
  const webcontainerLaunch = readFileSync(
    resolve(playgroundRoot, "lib/webcontainer-launch.ts"),
    "utf8",
  );

  expect(webcontainerPty).toContain('./webcontainer-launch.ts"');
  expect(webcontainerPty).not.toContain("WebContainer.boot(");
  expect(webcontainerPty).not.toContain("ensureWebContainerSeedScripts(");
  expect(webcontainerPty).not.toContain("normalizeWebContainerCwd(");
  expect(webcontainerLaunch).toContain("WebContainer.boot(");
  expect(webcontainerLaunch).toContain("ensureSeedScripts = ensureWebContainerSeedScripts");
  expect(webcontainerLaunch).toContain("normalizeWebContainerCwd(");
  expect(webcontainerLaunch).toContain("parseWebContainerCommand(");
});

test("appearance controller delegates theme and shader policy", () => {
  const appearanceController = readFileSync(
    resolve(playgroundRoot, "lib/appearance-controller.ts"),
    "utf8",
  );
  const themeController = readFileSync(resolve(playgroundRoot, "lib/theme-controller.ts"), "utf8");

  expect(appearanceController).toContain('./theme-controller.ts"');
  expect(appearanceController).not.toContain("applyBuiltinThemeToPane(");
  expect(appearanceController).not.toContain("applyThemeToPane(");
  expect(appearanceController).not.toContain("resetThemeForPane(");
  expect(appearanceController).not.toContain("parseGhosttyTheme");
  expect(themeController).toContain("applyBuiltinThemeToPane(");
  expect(themeController).toContain("applyThemeToPane(");
  expect(themeController).toContain("parseGhosttyTheme");
});

test("appearance controller delegates font policy", () => {
  const appearanceController = readFileSync(
    resolve(playgroundRoot, "lib/appearance-controller.ts"),
    "utf8",
  );
  const fontController = readFileSync(resolve(playgroundRoot, "lib/font-controller.ts"), "utf8");
  const fontControls = readFileSync(resolve(playgroundRoot, "lib/font-controls.ts"), "utf8");
  const fontLocalPicker = readFileSync(resolve(playgroundRoot, "lib/font-local-picker.ts"), "utf8");

  expect(appearanceController).toContain('./font-controller.ts"');
  expect(appearanceController).not.toContain("applyFontSourcesToAllPanes(");
  expect(appearanceController).not.toContain("applyFontRenderingOptionsToAllPanes(");
  expect(fontController).toContain("applyFontSourcesToAllPanes(");
  expect(fontController).toContain("applyFontRenderingOptionsToAllPanes(");
  expect(fontController).toContain("detectLocalFontState");
  expect(fontController).toContain('./font-local-picker.ts"');
  expect(fontControls).toContain("buildFontSourcesForSelection");
  expect(fontControls).not.toContain("detectLocalFontState");
  expect(fontControls).not.toContain("supportsLocalFontPicker");
  expect(fontLocalPicker).toContain("detectLocalFontState");
  expect(fontLocalPicker).toContain("supportsLocalFontPicker");
});

test("appearance controller delegates terminal policy", () => {
  const appearanceController = readFileSync(
    resolve(playgroundRoot, "lib/appearance-controller.ts"),
    "utf8",
  );
  const terminalController = readFileSync(
    resolve(playgroundRoot, "lib/terminal-controller.ts"),
    "utf8",
  );

  expect(appearanceController).toContain('./terminal-controller.ts"');
  expect(appearanceController).not.toContain("setRenderer(value)");
  expect(appearanceController).not.toContain("setMouseMode(selectedMouseModeDefault)");
  expect(appearanceController).not.toContain("getMouseStatus()");
  expect(terminalController).toContain("setRenderer(value)");
  expect(terminalController).toContain("setMouseMode(selectedMouseModeDefault)");
  expect(terminalController).toContain("getMouseStatus()");
});

test("shell bridge centralizes custom event dispatch and listeners", () => {
  const shellAdapter = readFileSync(resolve(playgroundRoot, "lib/shell-adapter.ts"), "utf8");
  const shellEffects = readFileSync(resolve(playgroundRoot, "lib/shell-effects.ts"), "utf8");
  const paneShellSync = readFileSync(resolve(playgroundRoot, "lib/pane-shell-sync.ts"), "utf8");
  const settingsShell = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/components/SettingsShell.svelte"),
    "utf8",
  );
  const terminalSection = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/components/TerminalSection.svelte"),
    "utf8",
  );
  const connectionSection = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/components/ConnectionSection.svelte"),
    "utf8",
  );
  const appearanceSection = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/components/AppearanceSection.svelte"),
    "utf8",
  );
  const demoSection = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/components/DemoSection.svelte"),
    "utf8",
  );
  const settingsShellEffects = readFileSync(
    resolve(playgroundRoot, "lib/settings-shell-effects.ts"),
    "utf8",
  );
  const shellStateBridge = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/shell-state-bridge.ts"),
    "utf8",
  );
  const shellState = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/stores/shell-state.ts"),
    "utf8",
  );
  const shellStateReducers = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/stores/shell-state-reducers.ts"),
    "utf8",
  );
  const shellBridge = readFileSync(resolve(playgroundRoot, "lib/shell-bridge.ts"), "utf8");

  expect(shellAdapter).toContain('./shell-effects.ts"');
  expect(shellAdapter).not.toContain("legacy-shell-adapter");
  expect(paneShellSync).toContain('./shell-bridge.ts"');
  expect(shellEffects).toContain('./shell-bridge.ts"');
  expect(existsSync(resolve(playgroundRoot, "lib/legacy-shell-adapter.ts"))).toBe(false);
  expect(settingsShell).toContain("../../../../lib/shell-bridge.ts");
  expect(terminalSection).toContain("../../../../lib/shell-bridge.ts");
  expect(connectionSection).toContain("../../../../lib/shell-bridge.ts");
  expect(appearanceSection).toContain("../../../../lib/shell-bridge.ts");
  expect(demoSection).toContain("../../../../lib/shell-bridge.ts");
  expect(existsSync(resolve(playgroundRoot, "svelte/src/lib/shell-dispatch.ts"))).toBe(false);
  expect(settingsShellEffects).toContain('./shell-bridge.ts"');
  expect(shellStateBridge).toContain('../../../lib/shell-bridge.ts"');
  expect(shellStateBridge).toContain('./stores/shell-state-reducers.ts"');
  expect(shellState).not.toContain('../../../../lib/shell-bridge.ts"');
  expect(shellAdapter).not.toContain("new CustomEvent(");
  expect(shellEffects).not.toContain("new CustomEvent(");
  expect(paneShellSync).not.toContain("new CustomEvent(");
  expect(settingsShellEffects).not.toContain("new CustomEvent(");
  expect(settingsShellEffects).not.toContain("SHELL_COMMAND_EVENT");
  expect(shellState).not.toContain("addEventListener(ACTIVE_PANE_STATE_EVENT");
  expect(shellState).not.toContain("addEventListener(CONNECTION_STATE_EVENT");
  expect(shellState).not.toContain("listenActivePaneState(");
  expect(shellState).not.toContain("listenConnectionState(");
  expect(shellState).not.toContain("applyConnectionShellState(");
  expect(shellState).not.toContain("applyAppearanceShellState(");
  expect(shellState).not.toContain("applyActivePaneShellState(");
  expect(shellStateReducers).toContain('./shell-state.ts"');
  expect(shellStateReducers).toContain("applyConnectionShellState");
  expect(shellStateReducers).toContain("applyAppearanceShellState");
  expect(shellStateReducers).toContain("applyActivePaneShellState");
  expect(shellBridge).toContain("dispatchShellEvent(");
  expect(shellBridge).toContain("listenActivePaneState(");
  expect(shellBridge).toContain("listenConnectionState(");
  expect(shellBridge).toContain("listenShellCommand(");
  expect(shellBridge).toContain("listenConnectionInput(");
  expect(shellBridge).toContain("listenAppearanceInput(");
  expect(shellBridge).toContain("listenTerminalAction(");
  expect(settingsShellEffects).toContain("listenShellCommand");
  expect(existsSync(resolve(playgroundRoot, "lib/settings-bindings.ts"))).toBe(false);
});

test("playground wiring uses settings shell effects only", () => {
  const wiring = readFileSync(resolve(playgroundRoot, "lib/playground-wiring.ts"), "utf8");
  const settingsShellEffects = readFileSync(
    resolve(playgroundRoot, "lib/settings-shell-effects.ts"),
    "utf8",
  );

  expect(wiring).toContain('./settings-shell-effects.ts"');
  expect(wiring).toContain("bindSettingsShellEffects({");
  expect(settingsShellEffects).toContain("export function bindSettingsShellEffects");
  expect(existsSync(resolve(playgroundRoot, "lib/settings-bindings.ts"))).toBe(false);
});

test("playground wiring uses shell control effects only", () => {
  const wiring = readFileSync(resolve(playgroundRoot, "lib/playground-wiring.ts"), "utf8");
  const shellEffects = readFileSync(
    resolve(playgroundRoot, "lib/control-shell-effects.ts"),
    "utf8",
  );

  expect(wiring).toContain('./control-shell-effects.ts"');
  expect(wiring).toContain("bindConnectionShellEffects({");
  expect(wiring).toContain("bindTerminalShellEffects({");
  expect(wiring).toContain("bindAppearanceShellEffects({");
  expect(shellEffects).toContain("export function bindConnectionShellEffects");
  expect(shellEffects).toContain("export function bindTerminalShellEffects");
  expect(shellEffects).toContain("export function bindAppearanceShellEffects");
  expect(shellEffects).toContain("listenConnectionInput");
  expect(shellEffects).toContain("listenTerminalAction");
  expect(shellEffects).toContain("listenAppearanceInput");
  expect(existsSync(resolve(playgroundRoot, "lib/control-bindings.ts"))).toBe(false);
});

test("svelte app delegates settings shell lifecycle to a dedicated component", () => {
  const appSvelte = readFileSync(resolve(playgroundRoot, "svelte/src/App.svelte"), "utf8");
  const shellMain = readFileSync(resolve(playgroundRoot, "svelte/src/main.ts"), "utf8");
  const shellState = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/stores/shell-state.ts"),
    "utf8",
  );
  const settingsShell = readFileSync(
    resolve(playgroundRoot, "svelte/src/lib/components/SettingsShell.svelte"),
    "utf8",
  );

  expect(appSvelte).toContain('./lib/components/SettingsShell.svelte"');
  expect(appSvelte).toContain("<SettingsShell>");
  expect(appSvelte).not.toContain("onMount");
  expect(appSvelte).not.toContain("startShellStateBridge");
  expect(appSvelte).not.toContain("dispatchSettingsOpen");
  expect(appSvelte).not.toContain("dispatchSettingsClose");
  expect(appSvelte).not.toContain("settingsShellState");
  expect(appSvelte).not.toContain("settingsDialog");
  expect(shellMain).toContain('./lib/shell-state-bridge.ts"');
  expect(shellMain).toContain('document.documentElement.dataset.playgroundShell = "svelte"');
  expect(shellMain).toContain("startShellStateBridge()");
  expect(shellMain).not.toContain('./lib/stores/shell-state.ts"');
  expect(settingsShell).toContain("../../../../lib/shell-bridge.ts");
  expect(settingsShell).not.toContain("../stores/shell-state.ts");
  expect(settingsShell).not.toContain("startShellStateBridge");
  expect(settingsShell).not.toContain(
    'document.documentElement.dataset.playgroundShell = "svelte"',
  );
  expect(settingsShell).toContain("let isOpen = false");
  expect(settingsShell).toContain('id="settingsFab"');
  expect(settingsShell).toContain('id="settingsDialog"');
  expect(existsSync(resolve(playgroundRoot, "svelte/src/lib/components/ShellBridge.svelte"))).toBe(
    false,
  );
  expect(shellState).not.toContain("settingsShellState");
  expect(shellState).not.toContain("setSettingsOpen");
  expect(shellState).not.toContain("settings:");
});

test("pane shell sync delegates terminal, appearance, and connection reflection", () => {
  const paneShellSync = readFileSync(resolve(playgroundRoot, "lib/pane-shell-sync.ts"), "utf8");
  const terminalEvents = readFileSync(
    resolve(playgroundRoot, "lib/pane-terminal-shell-events.ts"),
    "utf8",
  );
  const appearanceEvents = readFileSync(
    resolve(playgroundRoot, "lib/pane-appearance-shell-events.ts"),
    "utf8",
  );
  const connectionEvents = readFileSync(
    resolve(playgroundRoot, "lib/pane-connection-shell-events.ts"),
    "utf8",
  );
  expect(paneShellSync).toContain('./pane-terminal-shell-events.ts"');
  expect(paneShellSync).toContain('./pane-appearance-shell-events.ts"');
  expect(paneShellSync).toContain('./pane-connection-shell-events.ts"');
  expect(paneShellSync).toContain("dispatchActivePaneState(");
  expect(paneShellSync).not.toContain("pane-terminal-shell-sync");
  expect(paneShellSync).not.toContain("pane-appearance-shell-sync");
  expect(paneShellSync).not.toContain("pane-connection-shell-sync");
  expect(paneShellSync).not.toContain("usesSvelteShell");
  expect(paneShellSync).not.toContain("PaneShellSyncElements");
  expect(paneShellSync).not.toContain("elements:");
  expect(paneShellSync).not.toContain("if (terminalEvents && appearanceEvents && options.target)");
  expect(paneShellSync).not.toContain("syncHintingControls(");
  expect(paneShellSync).not.toContain("syncFontFamilyControls(");
  expect(paneShellSync).toContain('./pane-terminal-shell-events.ts"');
  expect(existsSync(resolve(playgroundRoot, "lib/pane-terminal-shell-sync.ts"))).toBe(false);
  expect(existsSync(resolve(playgroundRoot, "lib/pane-appearance-shell-sync.ts"))).toBe(false);
  expect(existsSync(resolve(playgroundRoot, "lib/pane-connection-shell-sync.ts"))).toBe(false);
  expect(terminalEvents).toContain("export function createPaneTerminalShellEvents");
  expect(terminalEvents).toContain("dispatchActivePaneState");
  expect(appearanceEvents).toContain("export function createPaneAppearanceShellEvents");
  expect(appearanceEvents).toContain("dispatchActivePaneState");
  expect(connectionEvents).toContain("export function createPaneConnectionShellEvents");
  expect(connectionEvents).toContain("dispatchConnectionState");
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

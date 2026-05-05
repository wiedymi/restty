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

      if (entry.isFile() && (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx"))) {
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
  const createRuntime = readFileSync(resolve(runtimeRoot, "create-runtime.ts"), "utf8");
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
  expect(runtimeController).toContain('runtime.ptyInputRuntime.setPtyStatus("disconnected")');
  expect(runtimeController).toContain("runtime.ptyInputRuntime.updateMouseStatus()");
  expect(createRuntime).toContain("runtimeController?.sendInput(text, source, config)");
  expect(createRuntime).not.toContain("runtimeApi?.sendInput(text, source, config)");
  expect(runtimeControllerPublicApi).toContain("export function createRuntimePublicApi");
  expect(runtimeControllerPublicApi).toContain('./runtime-controller.public-api.capabilities"');
  expect(runtimeControllerPublicApi).not.toContain("function setRenderer(");
  expect(runtimeControllerPublicApi).not.toContain("const terminal =");
  expect(runtimeControllerPublicApi).not.toContain('setPtyStatus("disconnected")');
  expect(runtimeControllerPublicApi).not.toContain("updateMouseStatus()");
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

test("terminal config supports an initial theme before runtime ready", () => {
  const runtimeCoreConfig = readFileSync(resolve(runtimeRoot, "core/config.ts"), "utf8");
  const createRuntime = readFileSync(resolve(runtimeRoot, "create-runtime.ts"), "utf8");

  expect(runtimeCoreConfig).toContain('import type { GhosttyTheme } from "../../theme"');
  expect(runtimeCoreConfig).toContain("theme?: GhosttyTheme");
  expect(createRuntime).toContain("let activeTheme: GhosttyTheme | null = terminal.theme ?? null");
  expect(createRuntime).toContain(
    'applyTheme(terminal.theme, terminal.theme.name ?? "initial theme")',
  );
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

test("surface managed pane runtime uses runtime terminology instead of app wording", () => {
  const surfaceConfig = readFileSync(resolve(surfaceRoot, "restty/config.ts"), "utf8");
  const managedPaneTypes = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-types.ts"),
    "utf8",
  );
  const managedPaneRuntime = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-runtime.ts"),
    "utf8",
  );

  expect(surfaceConfig).toContain("runtime.lifecycle.init()");
  expect(surfaceConfig).not.toContain("app.init()");
  expect(managedPaneTypes).toContain("runtime.lifecycle.init()");
  expect(managedPaneTypes).not.toContain("app.init()");
  expect(managedPaneRuntime).toContain("const runtime = createResttyRuntime");
  expect(managedPaneRuntime).toContain("void runtime.lifecycle.init()");
  expect(managedPaneRuntime).not.toContain("const app = createResttyRuntime");
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
  expect(pluginContext).toContain("export type ResttyPluginContext = {");
  expect(pluginContext).not.toContain(
    "export type ResttyPluginContext = {\n  restty: ResttyPluginHostApi;\n  options: unknown;\n  panes:",
  );
  expect(pluginContext).not.toContain(
    "export type ResttyPluginContext = {\n  restty: ResttyPluginHostApi;\n  options: unknown;\n  pane:",
  );
  expect(pluginContext).not.toContain(
    "export type ResttyPluginContext = {\n  restty: ResttyPluginHostApi;\n  options: unknown;\n  activePane:",
  );
  expect(pluginContext).not.toContain(
    "export type ResttyPluginContext = {\n  restty: ResttyPluginHostApi;\n  options: unknown;\n  focusedPane:",
  );

  expect(pluginDispatcherDeps).not.toContain("../restty/pane-handle");
  expect(pluginDispatcherDeps).not.toContain('type { Restty } from "../restty"');
  expect(pluginDispatcherDeps).toContain('from "./context.types"');
});

test("plugin dispatcher builds context through ctx.restty without redundant pane aliases", () => {
  const pluginDispatcher = readFileSync(resolve(surfaceRoot, "plugins/dispatcher.ts"), "utf8");

  expect(pluginDispatcher).toContain("restty: this.deps.restty");
  expect(pluginDispatcher).not.toContain("panes: this.deps.panes");
  expect(pluginDispatcher).not.toContain("pane: this.deps.pane");
  expect(pluginDispatcher).not.toContain("activePane: this.deps.activePane");
  expect(pluginDispatcher).not.toContain("focusedPane: this.deps.focusedPane");
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
  expect(resttyController).toContain("readonly lifecycleHooks:");
  expect(resttyController).toContain("readonly lifecycleAndPluginHooks:");
  expect(resttyController).toContain("readonly paneManagerHooks:");
  expect(resttyBootstrap).toContain("export function bootstrapResttySurface");
  expect(resttyBootstrap).toContain("createResttyManagedPaneManager({");
  expect(resttyBootstrap).toContain('./assembly"');
  expect(resttyBootstrap).not.toContain("createResttyPluginSurfaceBridge(restty)");
  expect(resttyBootstrap).not.toContain("createMergedPaneTerminalConfig({");
  expect(resttyBootstrap).not.toContain("createMergedPaneServicesConfig({");
  expect(resttyPluginSurface).toContain("export function createResttyPluginSurfaceBridge");
  expect(resttyPluginSurface).toContain("createResttyPluginSurfaceApi(restty)");
  expect(resttyAssembly).toContain("export function createResttySurfaceAssembly");
  expect(resttyAssembly).toContain("createResttyPluginSurfaceBridge(restty)");
  expect(resttyAssembly).not.toContain("panes: () => restty.panes()");
  expect(resttyAssembly).not.toContain("pane: (id) => restty.pane(id)");
  expect(resttyAssembly).not.toContain("activePane: () => restty.activePane()");
  expect(resttyAssembly).not.toContain("focusedPane: () => restty.focusedPane()");
  expect(resttyAssembly).toContain('./pane-manager-assembly"');
  expect(resttyAssembly).not.toContain("createMergedPaneTerminalConfig({");
  expect(resttyAssembly).not.toContain("createMergedPaneServicesConfig({");
  expect(resttyPaneManagerAssembly).toContain("export function createResttyPaneManagerAssembly");
  expect(resttyPaneManagerAssembly).toContain(
    "const controllerHooks = controller.paneManagerHooks",
  );
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

test("surface active pane api derives from pane handle contract", () => {
  const activePaneApi = readFileSync(resolve(surfaceRoot, "restty/active-pane-api.ts"), "utf8");

  expect(activePaneApi).toContain(
    'import type { ResttyPaneApi, ResttyPaneHandle } from "./pane-handle"',
  );
  expect(activePaneApi).toContain("export type ResttyActivePaneSurfaceApi = Omit<");
  expect(activePaneApi).toContain("ResttyPaneApi,");
  expect(activePaneApi).not.toContain("../../runtime/core/models");
  expect(activePaneApi).not.toContain("../../theme");
  expect(activePaneApi).not.toContain("../../input");
});

test("surface pane handle derives pane api types from runtime contracts", () => {
  const paneHandle = readFileSync(resolve(surfaceRoot, "restty/pane-handle.ts"), "utf8");
  const managedPaneCreate = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-create.ts"),
    "utf8",
  );
  const paneTypes = readFileSync(resolve(surfaceRoot, "panes/types.ts"), "utf8");

  expect(paneHandle).toContain('from "../../runtime/core/api"');
  expect(paneHandle).toContain('setRenderer: ResttyRuntimeTerminalApi["setRenderer"]');
  expect(paneHandle).toContain('sendInput: ResttyRuntimeIoApi["sendInput"]');
  expect(paneHandle).toContain('setMouseMode: ResttyRuntimeInteractionApi["setMouseMode"]');
  expect(paneHandle).toContain('getSearchState: ResttyRuntimeSearchApi["getState"]');
  expect(paneHandle).toContain('setShaderStages: ResttyRuntimeRenderApi["setShaderStages"]');
  expect(paneHandle).not.toContain("../../theme");
  expect(paneHandle).not.toContain("../../input");
  expect(paneHandle).not.toContain("../../runtime/core/models");
  expect(paneTypes).toContain('setRenderer: ResttyRuntimeTerminalApi["setRenderer"]');
  expect(paneTypes).toContain('setPaused: ResttyRuntimeTerminalApi["setPaused"]');
  expect(paneTypes).toContain('sendInput: ResttyRuntimeIoApi["sendInput"]');
  expect(paneTypes).toContain('setMouseMode: ResttyRuntimeInteractionApi["setMouseMode"]');
  expect(paneTypes).toContain('getBackend: ResttyRuntimeRenderApi["getBackend"]');
  expect(paneTypes).toContain('setShaderStages: ResttyRuntimeRenderApi["setShaderStages"]');
  expect(managedPaneCreate).toContain(
    "setRenderer: (value) => runtime.terminal.setRenderer(value)",
  );
  expect(managedPaneCreate).toContain("setPaused: (value) => runtime.terminal.setPaused(value)");
  expect(managedPaneCreate).toContain(
    "setFontSize: (value) => runtime.terminal.setFontSize(value)",
  );
  expect(managedPaneCreate).toContain(
    "setLigatures: (value) => runtime.terminal.setLigatures(value)",
  );
  expect(managedPaneCreate).toContain(
    "setFontHinting: (value) => runtime.terminal.setFontHinting(value)",
  );
  expect(managedPaneCreate).toContain(
    "setFontHintTarget: (value) => runtime.terminal.setFontHintTarget(value)",
  );
  expect(managedPaneCreate).toContain(
    "setFonts: (fonts) => runtime.terminal.setFonts(fonts)",
  );
  expect(managedPaneCreate).toContain(
    "applyTheme: (theme, sourceLabel) => runtime.terminal.applyTheme(theme, sourceLabel)",
  );
  expect(managedPaneCreate).toContain("resetTheme: () => runtime.terminal.resetTheme()");
  expect(managedPaneCreate).toContain(
    "sendInput: (text, source) => runtime.io.sendInput(text, source)",
  );
  expect(managedPaneCreate).toContain(
    "sendKeyInput: (text, source) => runtime.io.sendKeyInput(text, source)",
  );
  expect(managedPaneCreate).toContain(
    "setMouseMode: (value) => runtime.interaction.setMouseMode(value)",
  );
  expect(managedPaneCreate).toContain("getMouseStatus: () => runtime.interaction.getMouseStatus()");
  expect(managedPaneCreate).toContain(
    "runtime.interaction.selectWordAtClientPoint(clientX, clientY)",
  );
  expect(managedPaneCreate).toContain(
    "resize: (cols, rows) => runtime.interaction.resize(cols, rows)",
  );
  expect(managedPaneCreate).toContain("focus: () => runtime.interaction.focus()");
  expect(managedPaneCreate).toContain("blur: () => runtime.interaction.blur()");
  expect(managedPaneCreate).toContain(
    "updateSize: (force) => runtime.interaction.updateSize(force)",
  );
  expect(managedPaneCreate).toContain("getBackend: () => runtime.render.getBackend()");
  expect(managedPaneCreate).toContain(
    "setShaderStages: (stages) => runtime.render.setShaderStages(stages)",
  );
  expect(managedPaneCreate).toContain("getShaderStages: () => runtime.render.getShaderStages()");
  expect(paneHandle).toContain("this.resolvePane().setRenderer(value)");
  expect(paneHandle).toContain("this.resolvePane().setPaused(value)");
  expect(paneHandle).toContain("this.resolvePane().setFontSize(value)");
  expect(paneHandle).toContain("this.resolvePane().setLigatures(value)");
  expect(paneHandle).toContain("this.resolvePane().setFontHinting(value)");
  expect(paneHandle).toContain("this.resolvePane().setFontHintTarget(value)");
  expect(paneHandle).toContain("return this.resolvePane().setFonts(fonts)");
  expect(paneHandle).toContain("this.resolvePane().applyTheme(theme, sourceLabel)");
  expect(paneHandle).toContain("this.resolvePane().resetTheme()");
  expect(paneHandle).toContain("this.resolvePane().sendInput(text, source)");
  expect(paneHandle).toContain("this.resolvePane().sendKeyInput(text, source)");
  expect(paneHandle).toContain("this.resolvePane().togglePause()");
  expect(paneHandle).toContain("this.resolvePane().clearScreen()");
  expect(paneHandle).toContain("this.resolvePane().connectPty(url)");
  expect(paneHandle).toContain("this.resolvePane().disconnectPty()");
  expect(paneHandle).toContain("return this.resolvePane().isPtyConnected()");
  expect(paneHandle).toContain("this.resolvePane().setMouseMode(value)");
  expect(paneHandle).toContain("return this.resolvePane().getMouseStatus()");
  expect(paneHandle).toContain("return this.resolvePane().copySelectionToClipboard()");
  expect(paneHandle).toContain("return this.resolvePane().pasteFromClipboard()");
  expect(paneHandle).toContain(
    "return this.resolvePane().selectWordAtClientPoint(clientX, clientY)",
  );
  expect(paneHandle).toContain("this.resolvePane().setSearchQuery(query)");
  expect(paneHandle).toContain("this.resolvePane().clearSearch()");
  expect(paneHandle).toContain("this.resolvePane().searchNext()");
  expect(paneHandle).toContain("this.resolvePane().searchPrevious()");
  expect(paneHandle).toContain("return this.resolvePane().getSearchState()");
  expect(paneHandle).toContain("this.resolvePane().resize(cols, rows)");
  expect(paneHandle).toContain("this.resolvePane().focus()");
  expect(paneHandle).toContain("this.resolvePane().blur()");
  expect(paneHandle).toContain("this.resolvePane().updateSize(force)");
  expect(paneHandle).toContain("return this.resolvePane().getBackend()");
  expect(paneHandle).toContain("this.resolvePane().setShaderStages(stages)");
  expect(paneHandle).toContain("return this.resolvePane().getShaderStages()");
  expect(paneHandle).not.toContain("runtime.terminal.setRenderer(value)");
  expect(paneHandle).not.toContain("runtime.terminal.setPaused(value)");
  expect(paneHandle).not.toContain("runtime.terminal.setFontSize(value)");
  expect(paneHandle).not.toContain("runtime.terminal.setLigatures(value)");
  expect(paneHandle).not.toContain("runtime.terminal.setFontHinting(value)");
  expect(paneHandle).not.toContain("runtime.terminal.setFontHintTarget(value)");
  expect(paneHandle).not.toContain("runtime.terminal.setFonts(fonts)");
  expect(paneHandle).not.toContain("runtime.terminal.applyTheme(theme, sourceLabel)");
  expect(paneHandle).not.toContain("runtime.terminal.resetTheme()");
  expect(paneHandle).not.toContain("runtime.io.sendInput(text, source)");
  expect(paneHandle).not.toContain("runtime.io.sendKeyInput(text, source)");
  expect(paneHandle).not.toContain("runtime.terminal.togglePause()");
  expect(paneHandle).not.toContain("runtime.terminal.clearScreen()");
  expect(paneHandle).not.toContain("runtime.io.connectPty(url)");
  expect(paneHandle).not.toContain("runtime.io.disconnectPty()");
  expect(paneHandle).not.toContain("runtime.io.isPtyConnected()");
  expect(paneHandle).not.toContain("runtime.interaction.setMouseMode(value)");
  expect(paneHandle).not.toContain("runtime.interaction.getMouseStatus()");
  expect(paneHandle).not.toContain("runtime.interaction.copySelectionToClipboard()");
  expect(paneHandle).not.toContain("runtime.interaction.pasteFromClipboard()");
  expect(paneHandle).not.toContain("runtime.interaction.selectWordAtClientPoint(clientX, clientY)");
  expect(paneHandle).not.toContain("runtime.search.setQuery(query)");
  expect(paneHandle).not.toContain("runtime.search.clear()");
  expect(paneHandle).not.toContain("runtime.search.next()");
  expect(paneHandle).not.toContain("runtime.search.previous()");
  expect(paneHandle).not.toContain("runtime.search.getState()");
  expect(paneHandle).not.toContain("runtime.interaction.resize(cols, rows)");
  expect(paneHandle).not.toContain("runtime.interaction.focus()");
  expect(paneHandle).not.toContain("runtime.interaction.blur()");
  expect(paneHandle).not.toContain("runtime.interaction.updateSize(force)");
  expect(paneHandle).not.toContain("runtime.render.getBackend()");
  expect(paneHandle).not.toContain("runtime.render.setShaderStages(stages)");
  expect(paneHandle).not.toContain("runtime.render.getShaderStages()");
});

test("surface restty routes bulk font updates through pane handles", () => {
  const restty = readFileSync(resolve(surfaceRoot, "restty.ts"), "utf8");

  expect(restty).toContain("this.forEachPane((pane) => {");
  expect(restty).toContain("updates.push(pane.setFonts(this.fonts ?? []))");
  expect(restty).not.toContain("runtime.terminal.setFonts(this.fonts ?? [])");
});

test("surface shader ops route bulk shader updates through pane handles", () => {
  const restty = readFileSync(resolve(surfaceRoot, "restty.ts"), "utf8");
  const shaderOps = readFileSync(resolve(surfaceRoot, "restty/shader-ops.ts"), "utf8");

  expect(restty).toContain("forEachPane: (visitor) => {");
  expect(restty).toContain("this.forEachPane(visitor);");
  expect(restty).toContain("getPaneHandleById: (id) => this.pane(id)");

  expect(shaderOps).toContain(
    'type ShaderStagePane = Pick<ResttyPaneApi, "id" | "setShaderStages">;',
  );
  expect(shaderOps).toContain("this.deps.forEachPane((pane) => {");
  expect(shaderOps).toContain("const pane = this.deps.getPaneHandleById(paneId)");
  expect(shaderOps).toContain("pane.setShaderStages(this.buildMergedShaderStages(base))");
  expect(shaderOps).not.toContain("pane.runtime.render.setShaderStages");
});

test("default context menu routes pane actions through managed pane methods", () => {
  const defaultContextMenu = readFileSync(
    resolve(surfaceRoot, "panes/default-context-menu-items.ts"),
    "utf8",
  );
  const managedPaneCreate = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-create.ts"),
    "utf8",
  );
  const paneTypes = readFileSync(resolve(surfaceRoot, "panes/types.ts"), "utf8");

  expect(paneTypes).toContain(
    "export type ResttyPaneWithRuntimeActions = ResttyPaneWithRuntime & {",
  );
  expect(paneTypes).toContain(
    "export type ResttyPaneWithManagedRuntime = ResttyPaneWithRuntimeActions & {",
  );
  expect(defaultContextMenu).toContain("ResttyPaneWithRuntimeActions");
  expect(defaultContextMenu).toContain("await pane.copySelectionToClipboard()");
  expect(defaultContextMenu).toContain("await pane.pasteFromClipboard()");
  expect(defaultContextMenu).toContain("pane.clearScreen()");
  expect(defaultContextMenu).toContain("pane.isPtyConnected()");
  expect(defaultContextMenu).toContain("pane.disconnectPty()");
  expect(defaultContextMenu).toContain("pane.connectPty(url)");
  expect(defaultContextMenu).toContain("pane.togglePause()");
  expect(defaultContextMenu).not.toContain("pane.runtime.interaction.copySelectionToClipboard()");
  expect(defaultContextMenu).not.toContain("pane.runtime.interaction.pasteFromClipboard()");
  expect(defaultContextMenu).not.toContain("pane.runtime.terminal.clearScreen()");
  expect(defaultContextMenu).not.toContain("pane.runtime.io.isPtyConnected()");
  expect(defaultContextMenu).not.toContain("pane.runtime.io.disconnectPty()");
  expect(defaultContextMenu).not.toContain("pane.runtime.io.connectPty(url)");
  expect(defaultContextMenu).not.toContain("pane.runtime.terminal.togglePause()");

  expect(managedPaneCreate).toContain(
    "copySelectionToClipboard: () => runtime.interaction.copySelectionToClipboard()",
  );
  expect(managedPaneCreate).toContain(
    "pasteFromClipboard: () => runtime.interaction.pasteFromClipboard()",
  );
  expect(managedPaneCreate).toContain("clearScreen: () => runtime.terminal.clearScreen()");
  expect(managedPaneCreate).toContain('connectPty: (url = "") => runtime.io.connectPty(url)');
  expect(managedPaneCreate).toContain("disconnectPty: () => runtime.io.disconnectPty()");
  expect(managedPaneCreate).toContain("isPtyConnected: () => runtime.io.isPtyConnected()");
  expect(managedPaneCreate).toContain("togglePause: () => runtime.terminal.togglePause()");
  expect(paneTypes).not.toContain(
    "export type ResttyPaneWithRuntimeActions = ResttyPaneWithRuntime & {\n  copySelectionToClipboard: () => Promise<void>;\n  pasteFromClipboard: () => Promise<void>;\n  clearScreen: () => void;\n  connectPty: (url?: string) => void;\n  disconnectPty: () => void;\n  isPtyConnected: () => boolean;\n  togglePause: () => void;\n  initRuntime: () => Promise<void>;\n  destroyRuntime: () => void;",
  );
  expect(managedPaneCreate).toContain("initRuntime: () => runtime.lifecycle.init()");
  expect(managedPaneCreate).toContain("destroyRuntime: () => runtime.lifecycle.destroy()");
});

test("surface search ui routes pane search through pane methods", () => {
  const paneTypes = readFileSync(resolve(surfaceRoot, "panes/types.ts"), "utf8");
  const managedPaneCreate = readFileSync(
    resolve(surfaceRoot, "panes/managed-pane-create.ts"),
    "utf8",
  );
  const searchUiTypes = readFileSync(resolve(surfaceRoot, "search-ui/types.ts"), "utf8");
  const searchUiController = readFileSync(resolve(surfaceRoot, "search-ui/controller.ts"), "utf8");

  expect(paneTypes).toContain('setSearchQuery: ResttyRuntimeSearchApi["setQuery"]');
  expect(paneTypes).toContain('clearSearch: ResttyRuntimeSearchApi["clear"]');
  expect(paneTypes).toContain('searchNext: ResttyRuntimeSearchApi["next"]');
  expect(paneTypes).toContain('searchPrevious: ResttyRuntimeSearchApi["previous"]');
  expect(paneTypes).toContain('getSearchState: ResttyRuntimeSearchApi["getState"]');

  expect(managedPaneCreate).toContain("setSearchQuery: (query) => runtime.search.setQuery(query)");
  expect(managedPaneCreate).toContain("clearSearch: () => runtime.search.clear()");
  expect(managedPaneCreate).toContain("searchNext: () => runtime.search.next()");
  expect(managedPaneCreate).toContain("searchPrevious: () => runtime.search.previous()");
  expect(managedPaneCreate).toContain("getSearchState: () => runtime.search.getState()");

  expect(searchUiTypes).toContain('setSearchQuery: ResttyRuntimeSearchApi["setQuery"]');
  expect(searchUiTypes).toContain('clearSearch: ResttyRuntimeSearchApi["clear"]');
  expect(searchUiTypes).toContain('searchNext: ResttyRuntimeSearchApi["next"]');
  expect(searchUiTypes).toContain('searchPrevious: ResttyRuntimeSearchApi["previous"]');
  expect(searchUiTypes).toContain('getSearchState: ResttyRuntimeSearchApi["getState"]');
  expect(searchUiTypes).not.toContain("runtime: SearchUiPaneRuntime");

  expect(searchUiController).toContain("paneState.pane.getSearchState()");
  expect(searchUiController).toContain("pane.getSearchState()");
  expect(searchUiController).toContain("pane.setSearchQuery(input.value)");
  expect(searchUiController).toContain("pane.searchNext()");
  expect(searchUiController).toContain("pane.searchPrevious()");
  expect(searchUiController).toContain("pane.clearSearch()");
  expect(searchUiController).not.toContain("pane.runtime.search.");
});

test("surface pane ops split handle, command, and style helpers", () => {
  const paneOps = readFileSync(resolve(surfaceRoot, "restty/pane-ops.ts"), "utf8");
  const paneHandleOps = readFileSync(resolve(surfaceRoot, "restty/pane-handle-ops.ts"), "utf8");
  const paneCommandOps = readFileSync(resolve(surfaceRoot, "restty/pane-command-ops.ts"), "utf8");
  const paneStyleOps = readFileSync(resolve(surfaceRoot, "restty/pane-style-ops.ts"), "utf8");

  expect(paneOps).toContain('./pane-handle-ops"');
  expect(paneOps).toContain('./pane-command-ops"');
  expect(paneOps).toContain('./pane-style-ops"');
  expect(paneOps).not.toContain("export function makePaneHandle");
  expect(paneOps).not.toContain("export function createInitialPane");
  expect(paneOps).not.toContain("export function getPaneStyleOptions");
  expect(paneHandleOps).toContain("export function makePaneHandle");
  expect(paneCommandOps).toContain("export function createInitialPane");
  expect(paneStyleOps).toContain("export function getPaneStyleOptions");
});

test("surface restty helpers do not import managed-pane-manager for type access", () => {
  const helperFiles = [
    resolve(surfaceRoot, "restty/pane-handle.ts"),
    resolve(surfaceRoot, "restty/active-pane-api.ts"),
    resolve(surfaceRoot, "restty/config.ts"),
    resolve(surfaceRoot, "restty/events.ts"),
    resolve(surfaceRoot, "restty/pane-ops.ts"),
    resolve(surfaceRoot, "restty/pane-handle-ops.ts"),
    resolve(surfaceRoot, "restty/pane-command-ops.ts"),
    resolve(surfaceRoot, "restty/pane-style-ops.ts"),
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

test("playground Vite build defines explicit runtime chunks", () => {
  const viteConfig = readFileSync(resolve(playgroundRoot, "vite.config.ts"), "utf8");

  expect(viteConfig).toContain("react()");
  expect(viteConfig).toContain("fumadocsMdx");
  expect(viteConfig).toContain("manualChunks(id)");
  expect(viteConfig).toContain('return "restty-runtime"');
  expect(viteConfig).toContain('return "webcontainer-pty"');
  expect(viteConfig).toContain("normalizedId.startsWith(runtimeRoot)");
  expect(viteConfig).toContain('open: "/"');
  expect(viteConfig).toContain('input: resolve(playgroundRoot, "index.html")');
});

test("playground is a React Router app with Fumadocs docs", () => {
  const appEntry = readFileSync(resolve(playgroundRoot, "app/main.tsx"), "utf8");
  const docsRoute = readFileSync(resolve(playgroundRoot, "app/routes/docs.tsx"), "utf8");
  const sourceConfig = readFileSync(resolve(playgroundRoot, "source.config.ts"), "utf8");
  const sourceLoader = readFileSync(resolve(playgroundRoot, "app/lib/source.ts"), "utf8");
  const mdxComponents = readFileSync(resolve(playgroundRoot, "app/components/mdx.tsx"), "utf8");
  const layoutOptions = readFileSync(resolve(playgroundRoot, "app/lib/layout.shared.tsx"), "utf8");

  expect(appEntry).toContain("createBrowserRouter");
  expect(appEntry).toContain('path: "/docs/*"');
  expect(appEntry).toContain('from "fumadocs-ui/provider/react-router"');
  expect(appEntry).toContain('search={{ enabled: false }}');
  expect(appEntry).toContain('forcedTheme: "dark"');
  expect(docsRoute).toContain('from "fumadocs-ui/layouts/docs"');
  expect(docsRoute).toContain('from "fumadocs-ui/layouts/docs/page"');
  expect(docsRoute).toContain('from "fumadocs-mdx/runtime/browser"');
  expect(docsRoute).toContain("createClientLoader");
  expect(docsRoute).toContain("clientLoader.useContent");
  expect(sourceConfig).toContain('dir: "content/docs"');
  expect(sourceLoader).toContain("../../content/docs/index.mdx");
  expect(sourceLoader).toContain("getPage(slugs");
  expect(sourceLoader).toContain("getPageTree()");
  expect(mdxComponents).toContain("defaultMdxComponents");
  expect(layoutOptions).toContain("BaseLayoutProps");
  expect(layoutOptions).toContain("themeSwitch: { enabled: false }");
});

test("playground removes old Svelte shell and root legacy entrypoints", () => {
  const packageJson = readFileSync(resolve(repoRoot, "package.json"), "utf8");
  const indexHtml = readFileSync(resolve(playgroundRoot, "index.html"), "utf8");

  expect(existsSync(resolve(playgroundRoot, "src"))).toBe(false);
  expect(existsSync(resolve(playgroundRoot, "lib"))).toBe(false);
  expect(existsSync(resolve(repoRoot, "playground.html"))).toBe(false);
  expect(indexHtml).toContain('id="root"');
  expect(indexHtml).toContain('src="/app/main.tsx"');
  expect(indexHtml).not.toContain('id="paneRoot"');
  expect(indexHtml).not.toContain('id="settingsDialog"');
  expect(packageJson).not.toContain("svelte");
  expect(packageJson).not.toContain("@sveltejs/vite-plugin-svelte");
});

test("playground source uses public restty exports only", () => {
  const playgroundFiles = listTsFiles(playgroundRoot, {
    exclude: [playgroundPublicRoot, playgroundDistRoot],
  });
  const imports = collectResolvedImports(playgroundFiles);
  const offenders = imports.filter(({ resolved }) => {
    if (resolved === internalEntry) return true;
    if (resolved.startsWith(surfaceRoot) && !resolved.endsWith("src/index.ts")) return true;
    if (resolved.startsWith(runtimeRoot) && !resolved.endsWith("src/index.ts")) return true;
    return false;
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("playground keeps generated output out of source and static assets authored", () => {
  const gitignore = readFileSync(resolve(repoRoot, ".gitignore"), "utf8");
  const redirects = readFileSync(resolve(playgroundPublicRoot, "_redirects"), "utf8");

  expect(gitignore).toContain("playground/dist/");
  expect(gitignore).toContain("playground/build/");
  expect(gitignore).toContain("playground/.react-router/");
  expect(gitignore).toContain("playground/.source/");
  expect(redirects).toContain("/* /index.html 200");
  expect(existsSync(resolve(playgroundPublicRoot, "style.css"))).toBe(false);
  expect(existsSync(resolve(playgroundPublicRoot, "esm-test.html"))).toBe(false);
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

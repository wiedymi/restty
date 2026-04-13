import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const repoRoot = process.cwd();
const runtimeRoot = resolve(repoRoot, "src/runtime");
const runtimeCreateRuntimeRoot = resolve(repoRoot, "src/runtime/create-runtime");
const runtimeTypesEntry = resolve(runtimeRoot, "types.ts");
const surfaceRoot = resolve(repoRoot, "src/surface");
const paneAppManagerEntry = resolve(surfaceRoot, "pane-app-manager.ts");
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
    const matches = source.match(/CreateResttyAppPaneManagerOptions\["(?:terminal|services)"\]/g);
    return matches ? [`${relative(repoRoot, file)} -> ${matches[0]}`] : [];
  });

  expect(offenders).toEqual([]);
});

test("surface restty helpers do not import pane-app-manager for type access", () => {
  const helperFiles = [
    resolve(surfaceRoot, "restty-pane-handle.ts"),
    resolve(surfaceRoot, "restty/active-pane-api.ts"),
    resolve(surfaceRoot, "restty/config.ts"),
    resolve(surfaceRoot, "restty/events.ts"),
    resolve(surfaceRoot, "restty/pane-ops.ts"),
    resolve(surfaceRoot, "restty/shader-ops.ts"),
  ];
  const offenders = collectResolvedImports(helperFiles).filter(({ resolved }) => {
    return resolved === paneAppManagerEntry;
  });

  expect(
    offenders.map(({ file, specifier }) => `${relative(repoRoot, file)} -> ${specifier}`),
  ).toEqual([]);
});

test("surface restty facade imports pane-app-manager for factory only", () => {
  const resttyFile = resolve(surfaceRoot, "restty.ts");
  const source = readFileSync(resttyFile, "utf8");

  expect(source).not.toMatch(/createResttyAppPaneManager,\s*type\s+/);
  expect(source).toMatch(
    /import\s+\{\s*createResttyAppPaneManager\s*,?\s*\}\s+from\s+"\.\/pane-app-manager"/,
  );
});

test("surface public entrypoints do not use pane-app-manager as a type barrel", () => {
  const indexSource = readFileSync(resolve(repoRoot, "src/index.ts"), "utf8");
  const internalSurfaceSource = readFileSync(resolve(internalRoot, "surface.ts"), "utf8");

  expect(indexSource).not.toContain("./surface/pane-app-manager");
  expect(internalSurfaceSource).not.toMatch(
    /export\s+type\s*\{[^}]+\}\s+from\s+"..\/surface\/pane-app-manager"/s,
  );
  expect(internalSurfaceSource).toContain(
    'createResttyAppPaneManager } from "../surface/pane-app-manager"',
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

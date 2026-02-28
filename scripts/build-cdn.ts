import { stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

/**
 * Build self-contained, single-file ESM bundles for CDN / no-build usage.
 *
 * Each entry point becomes one standalone .js file with all dependencies
 * (including text-shaper and the embedded WASM) inlined. These files can
 * be loaded directly from a CDN via <script type="module"> or a bare
 * import without any build tooling on the consumer side.
 *
 * Output files:
 *   dist/cdn/restty.esm.js        – public API  (minified)
 *   dist/cdn/restty.esm.min.js    – public API  (minified, same content — alias kept for convention)
 *   dist/cdn/internal.esm.js      – full internals
 *   dist/cdn/xterm.esm.js         – xterm compat layer
 */

interface BundleEntry {
  input: string;
  outputName: string;
}

const entries: BundleEntry[] = [
  { input: "./src/index.ts", outputName: "restty.esm.js" },
  { input: "./src/internal.ts", outputName: "internal.esm.js" },
  { input: "./src/xterm.ts", outputName: "xterm.esm.js" },
];

const cdnDir = resolve("dist/cdn");

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

console.log("Building CDN bundles...\n");

let hasErrors = false;

for (const entry of entries) {
  const result = await Bun.build({
    entrypoints: [entry.input],
    outdir: cdnDir,
    target: "browser",
    format: "esm",
    splitting: false,
    minify: true,
    naming: entry.outputName,
  });

  if (!result.success) {
    hasErrors = true;
    console.error(`FAIL  ${entry.outputName}`);
    for (const log of result.logs) console.error(log);
    continue;
  }

  const outputPath = resolve(cdnDir, entry.outputName);
  const info = await stat(outputPath);
  const rel = relative(resolve("dist"), outputPath);
  console.log(`  ${rel}  (${formatBytes(info.size)})`);

  if (result.logs.length > 0) {
    for (const log of result.logs) console.log(log);
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log("\nCDN bundles ready in dist/cdn/");

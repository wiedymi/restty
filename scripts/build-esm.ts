import { stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

type BundleEntry = {
  input: string;
  outputName: string;
};

const entries: BundleEntry[] = [
  { input: "./src/index.ts", outputName: "restty.esm.js" },
];

const distDir = resolve("dist");

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

console.log("Building standalone ESM bundles...\n");

let hasErrors = false;

for (const entry of entries) {
  const result = await Bun.build({
    entrypoints: [entry.input],
    outdir: distDir,
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

  const outputPath = resolve(distDir, entry.outputName);
  const info = await stat(outputPath);
  console.log(`  ${relative(distDir, outputPath)} (${formatBytes(info.size)})`);

  if (result.logs.length > 0) {
    for (const log of result.logs) console.log(log);
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log("\nStandalone ESM bundles ready in dist/");

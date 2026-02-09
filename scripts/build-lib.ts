import { rename, rm, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const entrypoints = [
  "./src/index.ts",
  "./src/internal.ts",
  "./src/xterm.ts",
];

const result = await Bun.build({
  entrypoints,
  root: "./src",
  outdir: "./dist",
  target: "browser",
  format: "esm",
  splitting: true,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const distRoot = resolve("dist");
const emittedPaths = result.outputs.map((output) => output.path);
const rootIndexPath = resolve("dist/index.js");
const rootIndexOutput = emittedPaths.find((outputPath) => outputPath === rootIndexPath);
if (rootIndexOutput) {
  const resttyOutputPath = resolve("dist/restty.js");
  await rm(resttyOutputPath, { force: true });
  await rename(rootIndexOutput, resttyOutputPath);
  for (let i = 0; i < emittedPaths.length; i += 1) {
    if (emittedPaths[i] === rootIndexPath) {
      emittedPaths[i] = resttyOutputPath;
      break;
    }
  }
}

const entries = await Promise.all(
  emittedPaths.map(async (outputPath) => {
    const info = await stat(outputPath);
    return {
      path: relative(distRoot, outputPath),
      size: info.size,
    };
  }),
);

entries.sort((a, b) => a.path.localeCompare(b.path));

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

for (const entry of entries) {
  console.log(`${entry.path} (${formatBytes(entry.size)})`);
}

if (result.logs.length > 0) {
  for (const log of result.logs) console.log(log);
}

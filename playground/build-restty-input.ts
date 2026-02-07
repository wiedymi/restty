import { mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";

const entry = resolve("src/input/index.ts");
const outDir = resolve("playground/public");
const outFile = resolve(outDir, "restty-input.js");
const outMap = `${outFile}.map`;

await mkdir(outDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [entry],
  outdir: outDir,
  target: "browser",
  format: "esm",
  splitting: false,
  minify: false,
  sourcemap: "linked",
});

if (!result.success) {
  for (const message of result.logs) {
    console.error(message);
  }
  process.exit(1);
}

const jsOutput = result.outputs.find((output) => output.path.endsWith(".js"));
if (!jsOutput) {
  throw new Error("Bun.build did not emit a JS bundle.");
}

if (jsOutput.path !== outFile) {
  await rm(outFile, { force: true });
  await rename(jsOutput.path, outFile);
}

const mapOutput = result.outputs.find((output) => output.path.endsWith(".js.map"));
if (mapOutput && mapOutput.path !== outMap) {
  await rm(outMap, { force: true });
  await rename(mapOutput.path, outMap);
}

console.log(`restty-input bundle: ${outFile}`);

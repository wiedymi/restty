import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const entry = resolve(root, "src/wasm/index.ts");
const outfile = resolve(root, "playground/public/restty-wasm.js");

const proc = Bun.spawn({
  cmd: [
    "bun",
    "build",
    entry,
    "--outfile",
    outfile,
    "--target",
    "browser",
    "--format",
    "esm",
  ],
  stdio: ["inherit", "inherit", "inherit"],
});

const code = await proc.exited;
process.exit(code);

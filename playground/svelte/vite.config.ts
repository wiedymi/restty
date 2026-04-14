import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const configDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(configDir, "../..");
const outDir = resolve(repoRoot, "playground/dist-svelte");
const playgroundPublicDir = resolve(repoRoot, "playground/public");

const isolationHeaders = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
};

function copyPlaygroundPublicAssets() {
  return {
    name: "copy-playground-public-assets",
    closeBundle() {
      cpSync(playgroundPublicDir, resolve(outDir, "playground/public"), {
        recursive: true,
        force: true,
      });
    },
  };
}

function normalizeChunkId(id: string) {
  return id.replaceAll("\\", "/");
}

export default defineConfig({
  root: repoRoot,
  plugins: [svelte({ configFile: false }), copyPlaygroundPublicAssets()],
  server: {
    headers: isolationHeaders,
    open: "/playground/svelte/index.html",
  },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(repoRoot, "playground/svelte/index.html"),
      output: {
        manualChunks(id) {
          const normalizedId = normalizeChunkId(id);
          if (
            normalizedId.includes("/node_modules/@webcontainer/") ||
            normalizedId.includes("/playground/lib/webcontainer-")
          ) {
            return "webcontainer-pty";
          }
          if (normalizedId.includes("/src/") || normalizedId.endsWith("/playground/app.ts")) {
            return "restty-runtime";
          }
          return undefined;
        },
      },
    },
  },
});

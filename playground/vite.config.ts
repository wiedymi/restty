import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const playgroundRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(playgroundRoot, "..");
const outDir = resolve(playgroundRoot, "dist");
const playgroundPublicDir = resolve(playgroundRoot, "public");
const runtimeRoot = `${normalizeChunkId(resolve(repoRoot, "src"))}/`;
const playgroundAppEntry = normalizeChunkId(resolve(playgroundRoot, "app.ts"));

const isolationHeaders = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
};

function normalizeChunkId(id: string) {
  return id.replaceAll("\\", "/");
}

export default defineConfig({
  root: playgroundRoot,
  publicDir: playgroundPublicDir,
  plugins: [svelte({ configFile: false })],
  server: {
    headers: isolationHeaders,
    fs: {
      allow: [repoRoot],
    },
    open: "/",
  },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = normalizeChunkId(id);
          if (
            normalizedId.includes("/node_modules/@webcontainer/") ||
            normalizedId.includes("/playground/lib/webcontainer-")
          ) {
            return "webcontainer-pty";
          }
          if (normalizedId.startsWith(runtimeRoot) || normalizedId === playgroundAppEntry) {
            return "restty-runtime";
          }
          return undefined;
        },
      },
    },
  },
});

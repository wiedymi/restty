import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fumadocsMdx from "fumadocs-mdx/vite";
import { defineConfig } from "vite";
import * as SourceConfig from "./source.config.ts";

const playgroundRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(playgroundRoot, "..");
const outDir = resolve(playgroundRoot, "dist");
const playgroundPublicDir = resolve(playgroundRoot, "public");
const runtimeRoot = `${normalizeChunkId(resolve(repoRoot, "src"))}/`;
const playgroundAppRoot = `${normalizeChunkId(resolve(playgroundRoot, "app"))}/`;

const isolationHeaders = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
};

function normalizeChunkId(id: string) {
  return id.replaceAll("\\", "/");
}

export default defineConfig(async () => ({
  root: playgroundRoot,
  publicDir: playgroundPublicDir,
  plugins: [
    await fumadocsMdx(
      SourceConfig,
      {
        configPath: resolve(playgroundRoot, "source.config.ts"),
        outDir: resolve(playgroundRoot, ".source"),
      },
    ),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "~": resolve(playgroundRoot, "app"),
    },
  },
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
      input: resolve(playgroundRoot, "index.html"),
      output: {
        manualChunks(id) {
          const normalizedId = normalizeChunkId(id);
          if (
            normalizedId.includes("/node_modules/@webcontainer/") ||
            normalizedId.includes("/playground/app/lib/pty/webcontainer-")
          ) {
            return "webcontainer-pty";
          }
          if (normalizedId.startsWith(runtimeRoot)) return "restty-runtime";
          if (
            normalizedId.startsWith(playgroundAppRoot) &&
            normalizedId.includes("/app/lib/restty/")
          ) {
            return "playground-runtime";
          }
          return undefined;
        },
      },
    },
  },
}));

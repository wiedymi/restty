import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve("playground/public");
const port = Number(process.env.PORT ?? 5173);

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".ttc": "font/collection",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = join(root, pathname);
    if (!filePath.startsWith(root)) {
      return new Response("Not found", { status: 404 });
    }

    try {
      const data = await readFile(filePath);
      const type = mime[extname(filePath)] ?? "application/octet-stream";
      return new Response(data, { headers: { "content-type": type } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  },
});

console.log(`restty playground: http://localhost:${port}`);

const root = process.cwd();
const port = Number(Bun.env.PORT ?? 5173);
const publicRoot = `${root}/playground/public`;
const playgroundHtmlPath = `${root}/playground.html`;
const isolationHeaders = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "require-corp",
};

const mime: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".ttc": "font/ttf",
  ".otf": "font/otf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".conf": "text/plain; charset=utf-8",
  ".theme": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".sh": "text/plain; charset=utf-8",
};

function contentTypeFor(pathname: string) {
  const dot = pathname.lastIndexOf(".");
  const ext = dot === -1 ? "" : pathname.slice(dot);
  return mime[ext] ?? "application/octet-stream";
}

async function servePublic(pathname: string) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  if (!decoded.startsWith("/playground/public/")) return null;
  if (decoded.includes("..")) return null;
  const rel = decoded.slice("/playground/public".length);
  const filePath = `${publicRoot}${rel}`;
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  return new Response(file, {
    headers: {
      "content-type": contentTypeFor(pathname),
      ...isolationHeaders,
    },
  });
}

async function serveAppTs() {
  const result = await Bun.build({
    entrypoints: [`${root}/playground/app.ts`],
    format: "esm",
    target: "browser",
  });
  if (!result.success) {
    console.error("Build failed:", result.logs);
    return new Response("Build failed", { status: 500 });
  }
  const code = await result.outputs[0].text();
  return new Response(code, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      ...isolationHeaders,
    },
  });
}

const server = Bun.serve({
  port,
  development: true,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/playground.html") {
      return new Response(Bun.file(playgroundHtmlPath), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          ...isolationHeaders,
        },
      });
    }
    if (url.pathname === "/playground/app.ts" || url.pathname === "/playground/app.js") {
      return serveAppTs();
    }
    const publicFile = await servePublic(url.pathname);
    if (publicFile) return publicFile;
    return new Response("Not found", {
      status: 404,
      headers: isolationHeaders,
    });
  },
});

console.log(`restty playground: ${server.url}`);

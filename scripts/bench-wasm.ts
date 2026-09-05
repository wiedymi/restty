import { resolve } from "node:path";

const baselineDir = process.argv[2];
const outputDir = process.argv[3] ?? "/tmp/restty-wasm-bench";
if (!baselineDir) throw new Error("Usage: bun scripts/bench-wasm.ts BASELINE_DIR [OUTPUT_DIR]");
const { mkdir } = await import("node:fs/promises");
await mkdir(outputDir, { recursive: true });
const current = await Bun.build({
  entrypoints: ["src/wasm/runtime/restty-wasm.ts"],
  target: "browser",
});
const benchmark = await Bun.build({
  entrypoints: ["scripts/bench-wasm-browser.ts"],
  target: "browser",
});
const smoke = await Bun.build({
  entrypoints: ["scripts/smoke-wasm-browser.ts"],
  target: "browser",
});
if (!current.success || !benchmark.success || !smoke.success)
  throw new Error("Benchmark build failed");
const routes = new Map<string, Blob>([
  ["/current.js", current.outputs[0]!],
  ["/smoke.js", smoke.outputs[0]!],
  ["/benchmark.js", benchmark.outputs[0]!],
  ["/baseline.js", Bun.file(resolve(baselineDir, "runtime.js"))],
  ["/baseline-reporting.js", Bun.file(resolve(baselineDir, "reporting.js"))],
]);
let reports = 0;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4319,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/smoke-result" && request.method === "POST") {
      const report = await request.json();
      const renderer = report.renderer === "webgpu" ? "webgpu" : "webgl2";
      await Bun.write(
        resolve(outputDir, `smoke-${renderer}.json`),
        JSON.stringify(report, null, 2),
      );
      return new Response("saved");
    }
    if (url.pathname === "/smoke") {
      return new Response(
        '<!doctype html><meta charset="utf-8"><style>body{background:#101010;color:#eee;font:14px monospace}canvas{width:900px;height:450px;border:1px solid #555}</style><h1>Restty core update</h1><canvas width="900" height="450"></canvas><pre>Starting</pre><script type="module" src="/smoke.js"></script>',
        { headers: { "Content-Type": "text/html" } },
      );
    }
    const fontName = url.pathname.slice("/fonts/".length);
    if (
      url.pathname.startsWith("/fonts/") &&
      ["JetBrainsMono-Regular.ttf", "NotoSansCJK-Regular.ttc"].includes(fontName)
    ) {
      return new Response(Bun.file(resolve("playground/public/fonts", fontName)));
    }
    if (url.pathname === "/results" && request.method === "POST") {
      const report = await request.json();
      const path = resolve(outputDir, `browser-${++reports}.json`);
      await Bun.write(path, JSON.stringify(report, null, 2));
      console.log(path);
      return new Response("saved");
    }
    const file = routes.get(url.pathname);
    if (file) return new Response(file, { headers: { "Content-Type": "text/javascript" } });
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Restty WASM benchmark</title><pre>Starting…</pre><script type="module" src="/benchmark.js"></script>',
      { headers: { "Content-Type": "text/html" } },
    );
  },
});
console.log(`Open ${server.url} in Chrome and Safari. Results: ${outputDir}`);

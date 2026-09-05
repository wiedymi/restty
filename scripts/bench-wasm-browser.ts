import { runWorkloads } from "./bench-wasm-workloads";
import type { ResttyWasm } from "../src/wasm";

const root = document.querySelector("pre")!;
try {
  const report: Record<string, unknown> = {
    userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
  };
  for (const variant of ["baseline", "current"]) {
    root.textContent = `Running ${variant}…`;
    const path = `/${variant}.js`;
    const runtime = await import(/* @vite-ignore */ path);
    const baselineReportingPath = "/baseline-reporting.js";
    const baseline =
      variant === "baseline" ? await import(/* @vite-ignore */ baselineReportingPath) : null;
    report[variant] = await runWorkloads(
      runtime.loadResttyWasm,
      (wasm: ResttyWasm, handle, first, last) => {
        if (!baseline) return wasm.getSelectionText(handle, first, 0, last, 79);
        return baseline
          .createRuntimeReporting({
            selectionState: {
              active: true,
              dragging: false,
              anchor: { row: first, col: 0 },
              focus: { row: last, col: 79 },
            },
            getLastRenderState: () => wasm.getRenderState(handle),
            getWasmReady: () => true,
            getWasm: () => wasm,
            getWasmHandle: () => handle,
            getWasmExports: () => wasm.exports,
            setCursorForCpr: () => {},
          })
          .getSelectionText();
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  root.textContent = JSON.stringify(report, null, 2);
  await fetch("/results", { method: "POST", body: JSON.stringify(report) });
} catch (error) {
  root.textContent = String(error);
  await fetch("/results", {
    method: "POST",
    body: JSON.stringify({ error: String(error), userAgent: navigator.userAgent }),
  });
}

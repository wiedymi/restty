import { createResttyRuntime } from "../src/runtime/create-runtime";
const params = new URLSearchParams(location.search);
// Optional timer driver for test hosts without a display. Normal runs use rAF.
if (params.get("timer") === "1") {
  window.requestAnimationFrame = (callback) =>
    window.setTimeout(() => callback(performance.now()), 16);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}
const errors: string[] = [];
const events: unknown[] = [];
window.addEventListener("error", (event) => errors.push(event.message));
window.addEventListener("unhandledrejection", (event) => errors.push(String(event.reason)));
const renderer = params.get("renderer") === "webgpu" ? "webgpu" : "webgl2";
const canvas = document.querySelector("canvas")!;
const runtime = createResttyRuntime({
  mount: { canvas },
  terminal: {
    renderer,
    fontSize: 20,
    fonts: [{ url: "/fonts/JetBrainsMono-Regular.ttf" }, { url: "/fonts/NotoSansCJK-Regular.ttc" }],
  },
});
runtime.events.subscribe((event) => events.push(event));
try {
  await runtime.lifecycle.init();
  runtime.io.sendInput(
    "\x1b[2J\x1b[HRestty core update\r\n\x1b[32mUnicode: 界面 e\u0301\x1b[0m\r\nSearch needle: one needle\r\n\r\nAnimated image below:\r\n",
    "pty",
  );
  runtime.io.sendInput(
    "\x1b_Ga=T,f=32,s=1,v=1,i=1,c=6,r=3;/wAA/w==\x1b\\\x1b_Ga=f,i=1,f=32,s=1,v=1,z=500;AAD//w==\x1b\\\x1b_Ga=a,i=1,r=1,z=500,c=1,s=3\x1b\\",
    "pty",
  );
  runtime.search.setQuery("needle");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const search = runtime.search.getState();
  const result = { renderer, events, lifecycle: runtime.lifecycle.state(), search, errors };
  document.querySelector("pre")!.textContent = JSON.stringify(result, null, 2);
  await fetch("/smoke-result", { method: "POST", body: JSON.stringify(result) });
} catch (error) {
  document.querySelector("pre")!.textContent = String(error);
  await fetch("/smoke-result", {
    method: "POST",
    body: JSON.stringify({ renderer, error: String(error), errors }),
  });
}

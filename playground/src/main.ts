import { mount, tick } from "svelte";
import App from "./App.svelte";
import { startShellStateBridge } from "./lib/shell-state-bridge.ts";

const target = document.getElementById("app");
if (!target) {
  throw new Error("missing #app mount");
}

document.documentElement.dataset.playgroundShell = "svelte";
startShellStateBridge();

mount(App, { target });
await tick();
await import("../app.ts");

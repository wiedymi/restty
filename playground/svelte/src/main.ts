import { mount, tick } from "svelte";
import "../../public/style.css";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) {
  throw new Error("missing #app mount");
}

mount(App, { target });
await tick();
await import("../../app.ts");

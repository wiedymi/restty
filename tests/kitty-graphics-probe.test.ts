import { expect, test } from "bun:test";
import { loadResttyWasm } from "../src/wasm/runtime";

test("kitty graphics query returns OK", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 1000);
  expect(handle).toBeGreaterThan(0);

  // kitty graphics query (a=q)
  wasm.write(handle, "\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\");
  wasm.renderUpdate(handle);

  const out = wasm.drainOutput(handle);
  wasm.destroy(handle);

  expect(out.includes("i=31;OK")).toBe(true);
});

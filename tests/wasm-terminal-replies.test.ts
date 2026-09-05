import { expect, test } from "bun:test";
import { loadResttyWasm } from "../src/wasm";

test("terminal replies retain Restty identity and use upstream status handling", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 1000);
  try {
    wasm.write(handle, "\x1b[c\x1b[>c\x1b[5n\x1b[6n");
    const output = wasm.drainOutput(handle);
    expect(output).toContain("\x1b[?62;22;52c");
    expect(output).toContain("\x1b[>1;10;0c");
    expect(output).toContain("\x1b[0n");
    expect(output).toContain("\x1b[1;1R");
    wasm.write(handle, "\x1b[?u");
    expect(wasm.drainOutput(handle)).toContain("\x1b[?0u");
  } finally {
    wasm.destroy(handle);
  }
});

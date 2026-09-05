import type { ResttyWasm } from "../src/wasm/runtime/restty-wasm";

type Loader = () => Promise<ResttyWasm>;
type Copy = (wasm: ResttyWasm, handle: number, first: number, last: number) => string;

function summarize(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1]!;
  return { median: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) };
}

export async function runWorkloads(load: Loader, copy: Copy) {
  const samples = 80;
  const warmup = 20;
  const cols = 80;
  const rows = 24;
  let checksum = 0;
  const results: Record<string, unknown> = {};
  for (const [name, line] of [
    ["ascii", "build step: compiled module successfully 0123456789\r\n"],
    ["unicode", "界面 e\u0301 👩‍💻 Ελληνικά output\r\n"],
    ["styled", "\x1b[38;2;210;100;30mwarning\x1b[0m test passed \x1b[1mbold\x1b[0m\r\n"],
  ]) {
    const wasm = await load();
    const handle = wasm.create(cols, rows, 1_000_000);
    const payload = line!.repeat(256);
    const durations: number[] = [];
    try {
      for (let sample = -warmup; sample < samples; sample++) {
        const start = performance.now();
        wasm.write(handle, payload);
        wasm.renderUpdate(handle);
        const state = wasm.getRenderState(handle);
        for (let i = 0; i < state.codepoints.length; i++) checksum += state.codepoints[i]!;
        if (sample >= 0) durations.push(performance.now() - start);
      }
      results[name!] = {
        ms: summarize(durations),
        bytesPerSample: new TextEncoder().encode(payload).length,
      };
    } finally {
      wasm.destroy(handle);
    }
  }
  {
    const wasm = await load();
    const handle = wasm.create(cols, rows, 8_000_000);
    const lines = Array.from({ length: 2000 }, (_, i) => `line ${i}`);
    try {
      wasm.write(handle, lines.join("\r\n"));
      wasm.renderUpdate(handle);
      const offset = wasm.exports.restty_scrollbar_offset!(handle);
      const durations: number[] = [];
      for (let sample = -warmup; sample < samples; sample++) {
        const start = performance.now();
        const text = copy(wasm, handle, -offset, 1999 - offset);
        const elapsed = performance.now() - start;
        if (text !== lines.join("\n")) throw new Error("Copy benchmark returned wrong text");
        checksum += text.length;
        if (sample >= 0) durations.push(elapsed);
      }
      results.copy2000Rows = { ms: summarize(durations) };
      const resizeTimes: number[] = [];
      for (let sample = -warmup; sample < samples; sample++) {
        const start = performance.now();
        wasm.resize(handle, sample % 2 === 0 ? 60 : 80, rows);
        wasm.renderUpdate(handle);
        checksum += wasm.getRenderState(handle).cols;
        if (sample >= 0) resizeTimes.push(performance.now() - start);
      }
      results.resize = { ms: summarize(resizeTimes) };
    } finally {
      wasm.destroy(handle);
    }
  }
  {
    const wasm = await load();
    const fresh = wasm.memory.buffer.byteLength;
    const handles: number[] = [];
    const memoryBytes: number[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        const handle = wasm.create(cols, rows, 1_000_000);
        handles.push(handle);
        wasm.write(handle, "0123456789 terminal output\r\n".repeat(2000));
        wasm.renderUpdate(handle);
        memoryBytes.push(wasm.memory.buffer.byteLength);
      }
      results.memory = { fresh, filledTerminals: memoryBytes };
    } finally {
      for (const handle of handles) wasm.destroy(handle);
    }
  }
  return { samples, warmup, cols, rows, checksum, results };
}

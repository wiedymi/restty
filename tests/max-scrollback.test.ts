import { beforeAll, expect, test } from "bun:test";
import {
  DEFAULT_MAX_SCROLLBACK_BYTES,
  MAX_MAX_SCROLLBACK_BYTES,
  normalizeMaxScrollbackBytes,
  resolveMaxScrollbackBytes,
} from "../src/runtime/create-runtime/max-scrollback";
import { loadResttyWasm } from "../src/wasm/runtime/restty-wasm";

let wasm: Awaited<ReturnType<typeof loadResttyWasm>>;

beforeAll(async () => {
  wasm = await loadResttyWasm();
});

function getScrollbarTotal(handle: number): number {
  const total = wasm.exports.restty_scrollbar_total;
  return total ? total(handle) : 0;
}

function writeScrollbackSample(handle: number): void {
  const payload = "x".repeat(120);
  for (let i = 0; i < 2000; i += 1) {
    wasm.write(handle, `L${i}-${payload}\r\n`);
  }
  wasm.renderUpdate(handle);
}

test("normalizeMaxScrollbackBytes applies defaults, truncation, and bounds", () => {
  expect(normalizeMaxScrollbackBytes(undefined)).toBe(DEFAULT_MAX_SCROLLBACK_BYTES);
  expect(normalizeMaxScrollbackBytes(Number.NaN)).toBe(DEFAULT_MAX_SCROLLBACK_BYTES);
  expect(normalizeMaxScrollbackBytes(2048.9)).toBe(2048);
  expect(normalizeMaxScrollbackBytes(-1)).toBe(0);
  expect(normalizeMaxScrollbackBytes(0)).toBe(0);
  expect(normalizeMaxScrollbackBytes(MAX_MAX_SCROLLBACK_BYTES + 1)).toBe(MAX_MAX_SCROLLBACK_BYTES);
});

test("resolveMaxScrollbackBytes prefers maxScrollbackBytes over deprecated maxScrollback", () => {
  expect(resolveMaxScrollbackBytes({ maxScrollback: 2048 })).toBe(2048);
  expect(resolveMaxScrollbackBytes({ maxScrollbackBytes: 4096, maxScrollback: 2048 })).toBe(4096);
  expect(resolveMaxScrollbackBytes({ maxScrollbackBytes: Number.MAX_SAFE_INTEGER })).toBe(
    MAX_MAX_SCROLLBACK_BYTES,
  );
});

test(
  "default scrollback keeps more history than tiny limits while zero disables history",
  { timeout: 120_000 },
  () => {
    const noHistoryHandle = wasm.create(
      80,
      24,
      resolveMaxScrollbackBytes({ maxScrollbackBytes: 0 }),
    );
    const tinyHandle = wasm.create(80, 24, resolveMaxScrollbackBytes({ maxScrollbackBytes: 500 }));
    const defaultHandle = wasm.create(80, 24, resolveMaxScrollbackBytes({}));

    expect(noHistoryHandle).toBeGreaterThan(0);
    expect(tinyHandle).toBeGreaterThan(0);
    expect(defaultHandle).toBeGreaterThan(0);

    try {
      writeScrollbackSample(noHistoryHandle);
      writeScrollbackSample(tinyHandle);
      writeScrollbackSample(defaultHandle);

      const noHistoryTotal = getScrollbarTotal(noHistoryHandle);
      const tinyTotal = getScrollbarTotal(tinyHandle);
      const defaultTotal = getScrollbarTotal(defaultHandle);

      expect(noHistoryTotal).toBe(24);
      expect(tinyTotal).toBeGreaterThan(noHistoryTotal);
      expect(defaultTotal).toBeGreaterThan(tinyTotal);
    } finally {
      wasm.destroy(noHistoryHandle);
      wasm.destroy(tinyHandle);
      wasm.destroy(defaultHandle);
    }
  },
);

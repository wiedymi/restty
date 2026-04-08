import { test, expect } from "bun:test";
import { Terminal } from "../src/headless";
import { SerializeAddon } from "../src/serialize";

test("SerializeAddon returns a reconnect-safe replay journal", async () => {
  const terminal = new Terminal({ cols: 12, rows: 4 });
  const serializeAddon = new SerializeAddon();
  terminal.loadAddon(serializeAddon);

  terminal.write("hello");
  terminal.writeln(" world");
  await terminal.whenIdle();

  expect(serializeAddon.serialize()).toBe("\u001bchello world\r\n");

  terminal.dispose();
  await terminal.whenIdle();
});

test("hard reset compacts earlier journal history", async () => {
  const terminal = new Terminal({ cols: 12, rows: 4 });
  const serializeAddon = new SerializeAddon();
  terminal.loadAddon(serializeAddon);

  terminal.write("before");
  terminal.reset();
  terminal.write("after");
  await terminal.whenIdle();

  expect(serializeAddon.serialize({ includeHardReset: false })).toBe("\u001bcafter");

  terminal.dispose();
  await terminal.whenIdle();
});

test("resize updates the public terminal dimensions", async () => {
  const terminal = new Terminal({ cols: 10, rows: 2 });
  const resizeEvents: Array<{ cols: number; rows: number }> = [];
  terminal.onResize((size) => {
    resizeEvents.push(size);
  });

  terminal.resize(120, 33);
  await terminal.whenIdle();

  expect(terminal.cols).toBe(120);
  expect(terminal.rows).toBe(33);
  expect(resizeEvents).toEqual([{ cols: 120, rows: 33 }]);

  terminal.dispose();
  await terminal.whenIdle();
});

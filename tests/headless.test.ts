import { expect, test } from "bun:test";
import {
  createHeadlessTerminal,
  ResttyHeadlessTerminal,
  type ResttyHeadlessReplay,
} from "../src/headless";
import { loadResttyWasm, type ResttyWasm } from "../src/wasm";

let wasmPromise: Promise<ResttyWasm> | null = null;

function getWasm(): Promise<ResttyWasm> {
  wasmPromise ??= loadResttyWasm();
  return wasmPromise;
}

function textFromFirstRow(term: ResttyHeadlessTerminal): string {
  const state = term.getRenderState();
  const codes = state?.codepoints;
  const cols = state?.cols ?? 0;
  if (!codes || !cols) return "";
  return String.fromCodePoint(...Array.from(codes.slice(0, cols)).filter((cp) => cp !== 0));
}

function createFakeWasm(calls: string[]): ResttyWasm {
  return {
    create: (cols: number, rows: number) => {
      calls.push(`create:${cols}x${rows}`);
      return calls.length;
    },
    destroy: (handle: number) => {
      calls.push(`destroy:${handle}`);
    },
    write: (_handle: number, text: string) => {
      calls.push(`write:${text}`);
    },
    resize: (_handle: number, cols: number, rows: number) => {
      calls.push(`resize:${cols}x${rows}`);
    },
    renderUpdate: () => {},
  } as unknown as ResttyWasm;
}

test("headless terminal writes to WASM and exposes copied snapshots", async () => {
  const terminal = await createHeadlessTerminal({ wasm: await getWasm(), cols: 8, rows: 3 });
  try {
    terminal.write("hello");

    expect(terminal.cols).toBe(8);
    expect(terminal.rows).toBe(3);
    expect(textFromFirstRow(terminal)).toBe("hello");

    const snapshot = terminal.snapshot();
    expect(snapshot?.cursor?.col).toBe(5);
    const copiedCodepoints = snapshot?.codepoints;
    expect(copiedCodepoints?.slice(0, 5)).toEqual(new Uint32Array([104, 101, 108, 108, 111]));

    terminal.write("!");
    expect(textFromFirstRow(terminal)).toBe("hello!");
    expect(copiedCodepoints?.[5]).toBe(0);
  } finally {
    terminal.dispose();
  }
});

test("headless terminal resizes and restores from replay", async () => {
  const source = await createHeadlessTerminal({ wasm: await getWasm(), cols: 10, rows: 4 });
  const restored = await createHeadlessTerminal({ wasm: await getWasm(), cols: 2, rows: 2 });
  try {
    source.write("alpha\r\nbeta");
    source.resize(12, 5);

    const replay = source.createReplay();
    expect(replay).toMatchObject({
      kind: "restty-headless-replay",
      version: 1,
      initialCols: 10,
      initialRows: 4,
      cols: 12,
      rows: 5,
      truncated: false,
    });
    expect(replay.events).toEqual([
      { type: "write", data: "alpha\r\nbeta", byteLength: 11 },
      { type: "resize", cols: 12, rows: 5 },
    ]);

    restored.applyReplay(replay);
    expect(restored.cols).toBe(12);
    expect(restored.rows).toBe(5);
    expect(textFromFirstRow(restored)).toBe("alpha");
    expect(restored.createReplay().data).toBe(replay.data);
  } finally {
    source.dispose();
    restored.dispose();
  }
});

test("headless replay applies resize events in original order", () => {
  const calls: string[] = [];
  const source = new ResttyHeadlessTerminal(createFakeWasm(calls), { cols: 4, rows: 2 });
  const restored = new ResttyHeadlessTerminal(createFakeWasm(calls), { cols: 1, rows: 1 });
  try {
    calls.length = 0;
    source.write("abcdef");
    source.resize(6, 2);
    const replay = source.createReplay();

    calls.length = 0;
    restored.applyReplay(replay);

    expect(calls).toEqual(["resize:4x2", "write:abcdef", "resize:6x2"]);
  } finally {
    source.dispose();
    restored.dispose();
  }
});

test("headless replay compacts on hard reset", async () => {
  const terminal = await createHeadlessTerminal({ wasm: await getWasm(), cols: 12, rows: 3 });
  try {
    terminal.write("before");
    terminal.write("\x1bcafter");

    const replay = terminal.createReplay();
    expect(replay.data).toBe("\x1bcafter");
    expect(replay.truncated).toBe(false);
    expect(replay.byteLength).toBe(new TextEncoder().encode("\x1bcafter").byteLength);
  } finally {
    terminal.dispose();
  }
});

test("headless replay is bounded and marks truncated journals", async () => {
  const terminal = await createHeadlessTerminal({
    wasm: await getWasm(),
    cols: 12,
    rows: 3,
    replay: { maxBytes: 5 },
  });
  try {
    terminal.write("hello");
    terminal.write("world");

    const replay = terminal.createReplay();
    expect(replay.data).toBe("world");
    expect(replay.byteLength).toBe(5);
    expect(replay.truncated).toBe(true);
  } finally {
    terminal.dispose();
  }
});

test("headless terminal drains terminal-generated replies", async () => {
  const terminal = await createHeadlessTerminal({ wasm: await getWasm(), cols: 80, rows: 24 });
  try {
    terminal.write("\x1b[6n");

    expect(terminal.drainOutput()).toBe("\x1b[1;1R");
    expect(terminal.drainOutput()).toBe("");
  } finally {
    terminal.dispose();
  }
});

test("headless replay can be applied from plain strings", async () => {
  const terminal = await createHeadlessTerminal({ wasm: await getWasm(), cols: 8, rows: 3 });
  try {
    terminal.applyReplay("plain");
    const replay: ResttyHeadlessReplay = terminal.createReplay();

    expect(textFromFirstRow(terminal)).toBe("plain");
    expect(replay.data).toBe("plain");
    expect(replay.truncated).toBe(false);
  } finally {
    terminal.dispose();
  }
});

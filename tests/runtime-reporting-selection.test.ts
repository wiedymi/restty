import { beforeAll, expect, spyOn, test } from "bun:test";
import { createRuntimeReporting } from "../src/runtime/create-runtime/runtime-reporting";
import { loadResttyWasm, type ResttyWasm } from "../src/wasm";
import type { SelectionState } from "../src/selection";

let wasm: ResttyWasm;
beforeAll(async () => {
  wasm = await loadResttyWasm();
});

function fixture(lines: string[], offset: number) {
  const handle = wasm.create(16, 3, 1_000_000);
  wasm.write(handle, lines.join("\r\n"));
  wasm.scrollViewport(handle, offset - wasm.exports.restty_scrollbar_offset!(handle));
  wasm.renderUpdate(handle);
  const render = wasm.getRenderState(handle);
  const state: SelectionState = {
    active: true,
    dragging: false,
    anchor: { row: -offset, col: 0 },
    focus: { row: lines.length - 1 - offset, col: 15 },
  };
  const reporting = createRuntimeReporting({
    selectionState: state,
    getLastRenderState: () => render,
    getWasmReady: () => true,
    getWasm: () => wasm,
    getWasmHandle: () => handle,
    getWasmExports: () => wasm.exports,
    setCursorForCpr: () => {},
  });
  return { handle, render, state, reporting };
}

const lines = ["first", "second", "", "fourth", "fifth", "sixth", "last"];
for (const offset of [0, 2, 4]) {
  for (const reverse of [false, true]) {
    test(`copy includes all scrollback at offset ${offset}, reverse ${reverse}`, () => {
      const f = fixture(lines, offset);
      try {
        if (reverse) [f.state.anchor, f.state.focus] = [f.state.focus, f.state.anchor];
        const stateBefore = structuredClone(f.state);
        const cellsBefore = Array.from(f.render.codepoints);
        expect(f.reporting.getSelectionText()).toBe(lines.join("\n"));
        expect(wasm.exports.restty_scrollbar_offset!(f.handle)).toBe(offset);
        expect(Array.from(f.render.codepoints)).toEqual(cellsBefore);
        expect(f.state).toEqual(stateBefore);
        expect(f.reporting.getSelectionText()).toBe(lines.join("\n"));
      } finally {
        wasm.destroy(f.handle);
      }
    });
  }
}

test("copy of visible rows does not scroll", () => {
  const f = fixture(lines, 2);
  const scroll = spyOn(wasm, "scrollViewport");
  try {
    f.state.anchor = { row: 1, col: 1 };
    f.state.focus = { row: 2, col: 2 };
    expect(f.reporting.getSelectionText()).toBe("ourth\nfif");
    expect(scroll).not.toHaveBeenCalled();
  } finally {
    scroll.mockRestore();
    wasm.destroy(f.handle);
  }
});

for (const [anchor, focus, expected] of [
  [{ row: -4, col: 2 }, { row: -3, col: 3 }, "rst\nseco"],
  [{ row: 3, col: 1 }, { row: 6, col: 2 }, "ourth\nfifth\nsixth\nlas"],
  [{ row: -100, col: 9 }, { row: 100, col: 0 }, lines.join("\n")],
] as const) {
  test(`copy clips buffer bounds and keeps endpoint columns: ${expected}`, () => {
    const offset = anchor.row === -4 ? 4 : 0;
    const f = fixture(lines, offset);
    try {
      f.state.anchor = { ...anchor };
      f.state.focus = { ...focus };
      expect(f.reporting.getSelectionText()).toBe(expected);
      expect(wasm.exports.restty_scrollbar_offset!(f.handle)).toBe(offset);
    } finally {
      wasm.destroy(f.handle);
    }
  });
}

test("copy preserves combining characters across pages", () => {
  const text = ["a\u0301", "two", "", "four", "e\u0301"];
  const f = fixture(text, 2);
  try {
    expect(f.reporting.getSelectionText()).toBe(text.join("\n"));
  } finally {
    wasm.destroy(f.handle);
  }
});

test("copy has no fixed page limit", () => {
  const text = Array.from({ length: 1600 }, (_, row) => `line ${row}`);
  const f = fixture(text, 1597);
  try {
    expect(f.reporting.getSelectionText()).toBe(text.join("\n"));
    expect(wasm.exports.restty_scrollbar_offset!(f.handle)).toBe(1597);
  } finally {
    wasm.destroy(f.handle);
  }
});

test("copy reads scrollback without any viewport scroll", () => {
  const f = fixture(lines, 4);
  const scroll = spyOn(wasm, "scrollViewport").mockImplementation(() => {});
  try {
    expect(f.reporting.getSelectionText()).toBe(lines.join("\n"));
    expect(scroll).not.toHaveBeenCalled();
    expect(wasm.exports.restty_scrollbar_offset!(f.handle)).toBe(4);
  } finally {
    scroll.mockRestore();
    wasm.destroy(f.handle);
  }
});

for (const row of [-100, 100]) {
  test(`copy ignores a selection outside the buffer at row ${row}`, () => {
    const f = fixture(lines, 4);
    try {
      f.state.anchor = { row, col: 0 };
      f.state.focus = { row: row + 1, col: 15 };
      expect(f.reporting.getSelectionText()).toBe("");
    } finally {
      wasm.destroy(f.handle);
    }
  });
}

test("copy does not return partial text when scrollback access is unavailable", () => {
  const f = fixture(lines, 4);
  try {
    const reporting = createRuntimeReporting({
      selectionState: f.state,
      getLastRenderState: () => f.render,
      getWasmReady: () => true,
      getWasm: () => null,
      getWasmHandle: () => f.handle,
      getWasmExports: () => null,
      setCursorForCpr: () => {},
    });
    expect(reporting.getSelectionText()).toBe("");
  } finally {
    wasm.destroy(f.handle);
  }
});

test("copy unwraps soft lines and keeps wide graphemes intact", () => {
  const text = "abcdefghijklmno界e\u0301 then more text";
  const f = fixture([text], 0);
  try {
    f.state.anchor = { row: 0, col: 0 };
    f.state.focus = { row: 2, col: 15 };
    expect(f.reporting.getSelectionText()).toBe(text);
  } finally {
    wasm.destroy(f.handle);
  }
});

test("copy preserves selected blank lines at the end", () => {
  const f = fixture(["first", "", ""], 0);
  try {
    expect(f.reporting.getSelectionText()).toBe("first\n\n");
  } finally {
    wasm.destroy(f.handle);
  }
});

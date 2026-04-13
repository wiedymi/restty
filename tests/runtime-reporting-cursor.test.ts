import { expect, test } from "bun:test";
import { createRuntimeReporting } from "../src/runtime/create-runtime/runtime-reporting";

function createReporting(options: {
  activeCursor?: { col: number; row: number };
  renderCursorBounds?: { cols: number; rows: number };
  emitRuntimeEvent?: (event: { type: "term-size"; cols: number; rows: number }) => void;
}) {
  const activeCursor = options.activeCursor;
  const renderCursorBounds = options.renderCursorBounds ?? { cols: 80, rows: 24 };
  return createRuntimeReporting({
    selectionState: { active: false, dragging: false, anchor: null, focus: null },
    getLastRenderState: () => renderCursorBounds as never,
    getWasmReady: () => false,
    getWasm: () => null,
    getWasmHandle: () => 1,
    getWasmExports: () =>
      activeCursor
        ? ({
            restty_active_cursor_x: () => activeCursor.col,
            restty_active_cursor_y: () => activeCursor.row,
          } as never)
        : null,
    emitRuntimeEvent: options.emitRuntimeEvent,
    setCursorForCpr: () => {},
  });
}

test("resolveCursorPosition keeps in-bounds render cursor even if active cursor differs", () => {
  const reporting = createReporting({ activeCursor: { col: 12, row: 7 } });

  const resolved = reporting.resolveCursorPosition({
    row: 2,
    col: 3,
    visible: 1,
    style: 0,
    blinking: 0,
    wideTail: 0,
    color: 0,
  });

  expect(resolved).toEqual({ col: 3, row: 2, wideTail: false });
});

test("resolveCursorPosition ignores out-of-bounds active cursor", () => {
  const reporting = createReporting({ activeCursor: { col: 999, row: 999 } });

  const resolved = reporting.resolveCursorPosition({
    row: 5,
    col: 6,
    visible: 1,
    style: 0,
    blinking: 0,
    wideTail: 1,
    color: 0,
  });

  expect(resolved).toEqual({ col: 6, row: 5, wideTail: true });
});

test("resolveCursorPosition keeps last visible cursor when current cursor is hidden", () => {
  const reporting = createReporting({ activeCursor: { col: 12, row: 7 } });

  const visible = reporting.resolveCursorPosition({
    row: 4,
    col: 9,
    visible: 1,
    style: 0,
    blinking: 0,
    wideTail: 0,
    color: 0,
  });
  expect(visible).toEqual({ col: 9, row: 4, wideTail: false });

  const hidden = reporting.resolveCursorPosition({
    row: 0,
    col: 0,
    visible: 0,
    style: 0,
    blinking: 0,
    wideTail: 0,
    color: 0,
  });
  expect(hidden).toEqual({ col: 9, row: 4, wideTail: false });
});

test("resolveCursorPosition bootstraps hidden cursor from active cursor", () => {
  const reporting = createReporting({ activeCursor: { col: 12, row: 7 } });

  const hidden = reporting.resolveCursorPosition({
    row: 0,
    col: 0,
    visible: 0,
    style: 0,
    blinking: 0,
    wideTail: 0,
    color: 0,
  });

  expect(hidden).toEqual({ col: 12, row: 7, wideTail: false });
});

test("reportTermSize emits deduped term-size runtime events", () => {
  const events: Array<{ cols: number; rows: number }> = [];
  const reporting = createReporting({
    emitRuntimeEvent: (event) => {
      events.push({ cols: event.cols, rows: event.rows });
    },
  });

  reporting.reportTermSize(80, 24);
  reporting.reportTermSize(80, 24);
  reporting.reportTermSize(132, 42);

  expect(events).toEqual([
    { cols: 80, rows: 24 },
    { cols: 132, rows: 42 },
  ]);
});

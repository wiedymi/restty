import { expect, test } from "bun:test";
import { MouseController } from "../src/input/mouse";

type WheelEventInit = {
  deltaX?: number;
  deltaY?: number;
  deltaMode?: number;
};

function createWheelEvent(init: WheelEventInit): WheelEvent {
  return {
    deltaX: init.deltaX ?? 0,
    deltaY: init.deltaY ?? 0,
    deltaMode: init.deltaMode ?? 0,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
  } as WheelEvent;
}

function createController(options: { cellHeight?: number; withMetrics?: boolean } = {}) {
  const sent: string[] = [];
  const cellHeight = options.cellHeight ?? 20;
  const controller = new MouseController({
    sendReply: (data) => {
      sent.push(data);
    },
    positionToCell: () => ({ row: 4, col: 9 }),
    getWheelCellMetrics:
      options.withMetrics === false
        ? undefined
        : () => ({ cellWidth: 10, cellHeight, rows: 24, cols: 80 }),
  });
  // SGR mouse reporting with button events, as nvim enables it.
  controller.handleModeSeq("\x1b[?1000h");
  controller.handleModeSeq("\x1b[?1006h");
  return { controller, sent };
}

test("wheel events accumulate sub-cell precision deltas before reporting", () => {
  const { controller, sent } = createController({ cellHeight: 20 });

  expect(controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 8 }))).toBe(true);
  expect(sent).toEqual([]);

  expect(controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 8 }))).toBe(true);
  expect(sent).toEqual([]);

  expect(controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 8 }))).toBe(true);
  expect(sent).toEqual(["\x1b[<65;10;5M"]);
});

test("wheel events emit one report per accumulated cell and keep the remainder", () => {
  const { controller, sent } = createController({ cellHeight: 20 });

  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 90 }));
  expect(sent).toEqual(["\x1b[<65;10;5M", "\x1b[<65;10;5M", "\x1b[<65;10;5M", "\x1b[<65;10;5M"]);

  sent.length = 0;
  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 10 }));
  expect(sent).toEqual(["\x1b[<65;10;5M"]);
});

test("scrolling up reports button 64 and opposite deltas cancel pending scroll", () => {
  const { controller, sent } = createController({ cellHeight: 20 });

  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 10 }));
  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: -10 }));
  expect(sent).toEqual([]);

  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: -20 }));
  expect(sent).toEqual(["\x1b[<64;10;5M"]);
});

test("discrete line-mode ticks convert one tick to one cell", () => {
  const { controller, sent } = createController({ cellHeight: 20 });

  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 3, deltaMode: 1 }));
  expect(sent.length).toBe(3);

  sent.length = 0;
  // Fractional ticks clamp to a full tick so slow single-notch scrolls register.
  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 0.3, deltaMode: 1 }));
  expect(sent.length).toBe(1);
});

test("horizontal wheel deltas report buttons 66 and 67", () => {
  const { controller, sent } = createController();

  controller.sendMouseEvent("wheel", createWheelEvent({ deltaX: 25 }));
  expect(sent).toEqual(["\x1b[<67;10;5M", "\x1b[<67;10;5M"]);

  sent.length = 0;
  controller.sendMouseEvent("wheel", createWheelEvent({ deltaX: -15 }));
  expect(sent).toEqual(["\x1b[<66;10;5M"]);
});

test("wheel falls back to one report per event without cell metrics", () => {
  const { controller, sent } = createController({ withMetrics: false });

  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 3 }));
  controller.sendMouseEvent("wheel", createWheelEvent({ deltaY: 3 }));
  expect(sent).toEqual(["\x1b[<65;10;5M", "\x1b[<65;10;5M"]);
});

test("zero-delta wheel events are not consumed", () => {
  const { controller, sent } = createController();

  expect(controller.sendMouseEvent("wheel", createWheelEvent({}))).toBe(false);
  expect(sent).toEqual([]);
});

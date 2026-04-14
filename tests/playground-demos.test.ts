import { expect, test } from "bun:test";
import {
  createBasicDemoPayload,
  createPaletteDemoPayload,
  createUnicodeDemoPayload,
} from "../playground/lib/demo-content.ts";
import { createDemoController, runActivePaneDemo, stopPaneDemo } from "../playground/lib/demos.ts";
import type { PaneState } from "../playground/lib/pane-state.ts";

function createState(overrides: Partial<PaneState> = {}): PaneState {
  return {
    id: overrides.id ?? 1,
    renderer: overrides.renderer ?? "auto",
    fontSize: overrides.fontSize ?? 18,
    mouseMode: overrides.mouseMode ?? "auto",
    paused: overrides.paused ?? false,
    theme: overrides.theme ?? {
      selectValue: "",
      sourceLabel: "",
      theme: null,
    },
    demos: overrides.demos ?? null,
  };
}

test("runActivePaneDemo defaults to the basic demo and ignores missing panes", () => {
  const runs: string[] = [];
  const paneStates = new Map<number, PaneState>([
    [
      3,
      createState({
        id: 3,
        demos: {
          run: (kind) => {
            runs.push(kind);
          },
          stop: () => {},
        },
      }),
    ],
  ]);

  expect(runActivePaneDemo(paneStates, 3, null)).toBe(true);
  expect(runActivePaneDemo(paneStates, null, "unicode")).toBe(false);
  expect(runActivePaneDemo(paneStates, 99, "unicode")).toBe(false);
  expect(runs).toEqual(["basic"]);
});

test("stopPaneDemo stops only when a demo controller exists", () => {
  const calls: string[] = [];

  expect(stopPaneDemo(null)).toBe(false);
  expect(stopPaneDemo(createState())).toBe(false);
  expect(
    stopPaneDemo(
      createState({
        demos: {
          run: () => {},
          stop: () => {
            calls.push("stop");
          },
        },
      }),
    ),
  ).toBe(true);

  expect(calls).toEqual(["stop"]);
});

test("createDemoController stops the previous animation before starting another run", () => {
  let clears = 0;
  const inputs: string[] = [];
  const timerIds: number[] = [];
  const clearedTimers: number[] = [];
  let nextTimerId = 1;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalWindow = globalThis.window;
  const originalPerformance = globalThis.performance;

  globalThis.setInterval = ((callback: TimerHandler, _delay?: number) => {
    void callback;
    const id = nextTimerId++;
    timerIds.push(id);
    return id as unknown as Timer;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id?: Timer | number) => {
    clearedTimers.push(Number(id));
  }) as typeof clearInterval;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { setInterval: globalThis.setInterval },
  });
  Object.defineProperty(globalThis, "performance", {
    configurable: true,
    value: { now: () => 0 },
  });

  try {
    const demos = createDemoController({
      terminal: {
        clearScreen: () => {
          clears += 1;
        },
      },
      io: {
        sendInput: (text) => {
          inputs.push(text);
        },
      },
    });

    demos.run("anim");
    demos.run("basic");

    expect(clears).toBe(1);
    expect(timerIds).toEqual([1]);
    expect(clearedTimers).toEqual([1]);
    expect(inputs.at(-1)).toContain("restty demo: basics");
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "performance", {
      configurable: true,
      value: originalPerformance,
    });
  }
});

test("demo content builders emit the expected payload headers", () => {
  expect(createBasicDemoPayload()).toContain("restty demo: basics");
  expect(createBasicDemoPayload()).toContain("\x1b[2J\x1b[H");
  expect(createPaletteDemoPayload()).toContain("restty demo: palette");
  expect(createPaletteDemoPayload()).toContain("Grayscale:");
  expect(createUnicodeDemoPayload()).toContain("restty demo: unicode");
  expect(createUnicodeDemoPayload()).toContain("Braille:");
});

import { afterEach, beforeEach, expect, test } from "bun:test";
import type { WebGPUState } from "../src/renderer";
import { createRuntimeControllerRenderLoop } from "../src/runtime/create-runtime/runtime-controller.render-loop";
import type { RuntimeControllerSharedState } from "../src/runtime/create-runtime/runtime-controller.state.types";

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

beforeEach(() => {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: () => 1,
  });
});

afterEach(() => {
  if (originalRequestAnimationFrame) {
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    });
  } else {
    delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
  }
});

function createLoopHarness(
  options: { synchronizedOutput?: () => boolean; imageChanged?: () => boolean } = {},
) {
  const renderUpdates: number[] = [];
  const ticks: number[] = [];
  const wasm = {
    tickKittyAnimations: options.imageChanged ?? (() => false),
    renderUpdate: (handle: number) => {
      renderUpdates.push(handle);
    },
  };
  const sharedState = {
    wasm: wasm as never,
    wasmExports: null,
    wasmHandle: 1,
    wasmReady: true,
    activeState: null,
    needsRender: true,
    lastRenderTime: 0,
    currentContextType: "webgpu",
    isFocused: true,
    lastKeydownSeq: "",
    lastKeydownSeqAt: 0,
  } as RuntimeControllerSharedState;
  const internalState = {
    paused: false,
    backend: "webgpu" as const,
    preferredRenderer: "webgpu" as const,
    rafId: 0,
    nextBlinkTime: performance.now() + 600,
  };
  const { loop } = createRuntimeControllerRenderLoop({
    internalState,
    readState: () => sharedState,
    writeState: (patch) => Object.assign(sharedState, patch),
    resizeState: { lastAt: -10_000 },
    CURSOR_BLINK_MS: 600,
    RESIZE_ACTIVE_MS: 180,
    BACKGROUND_RENDER_FPS: 15,
    isSynchronizedOutput: options.synchronizedOutput ?? (() => false),
    tickWebGPU: () => {
      ticks.push(1);
    },
    tickWebGL: () => {},
  });
  const gpuState = { device: {} } as WebGPUState;
  return { loop, sharedState, renderUpdates, ticks, gpuState };
}

test("render loop presents dirty frames on consecutive rAF ticks without an FPS budget", () => {
  const harness = createLoopHarness();

  harness.loop(harness.gpuState);
  expect(harness.ticks.length).toBe(1);
  expect(harness.sharedState.needsRender).toBe(false);

  harness.sharedState.needsRender = true;
  harness.loop(harness.gpuState);
  expect(harness.ticks.length).toBe(2);
});

test("render loop refreshes the terminal snapshot before each presented frame", () => {
  const harness = createLoopHarness();

  harness.loop(harness.gpuState);

  expect(harness.renderUpdates).toEqual([1]);
});

test("render loop holds presentation while synchronized output is active", () => {
  let syncActive = true;
  const harness = createLoopHarness({ synchronizedOutput: () => syncActive });

  harness.loop(harness.gpuState);
  harness.loop(harness.gpuState);
  expect(harness.ticks.length).toBe(0);
  expect(harness.renderUpdates.length).toBe(0);
  expect(harness.sharedState.needsRender).toBe(true);

  syncActive = false;
  harness.loop(harness.gpuState);
  expect(harness.ticks.length).toBe(1);
  expect(harness.renderUpdates).toEqual([1]);
  expect(harness.sharedState.needsRender).toBe(false);
});

test("image frame changes render without new terminal output", () => {
  const harness = createLoopHarness({ imageChanged: () => true });
  harness.sharedState.needsRender = false;
  harness.loop(harness.gpuState);
  expect(harness.ticks).toEqual([1]);
  expect(harness.sharedState.needsRender).toBe(false);
});

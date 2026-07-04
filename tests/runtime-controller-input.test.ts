import { expect, test } from "bun:test";
import { createRuntimeControllerInput } from "../src/runtime/create-runtime/runtime-controller.input";
import type { RuntimeControllerSharedState } from "../src/runtime/create-runtime/runtime-controller.state.types";

function createInputHarness(options: { synchronizedOutput?: () => boolean } = {}) {
  const writes: string[] = [];
  const scheduled: string[] = [];
  const wasm = {
    write: (_handle: number, text: string) => {
      writes.push(text);
    },
    setPixelSize: () => {},
    drainOutput: () => "",
  };
  const sharedState = {
    wasm: wasm as never,
    wasmExports: null,
    wasmHandle: 1,
    wasmReady: true,
    activeState: null,
    needsRender: false,
    lastRenderTime: 0,
    currentContextType: "webgpu",
    isFocused: true,
    lastKeydownSeq: "",
    lastKeydownSeqAt: 0,
  } as RuntimeControllerSharedState;
  const { sendInput } = createRuntimeControllerInput({
    ptyTransport: {
      connect: () => {},
      disconnect: () => {},
      sendInput: () => true,
      resize: () => true,
      isConnected: () => false,
    },
    inputHandler: {
      isSynchronizedOutput: options.synchronizedOutput ?? (() => false),
    } as never,
    ptyInputRuntime: {
      scheduleSyncOutputReset: () => {
        scheduled.push("schedule");
      },
      cancelSyncOutputReset: () => {
        scheduled.push("cancel");
      },
    } as never,
    interaction: {
      selectionState: { active: false, dragging: false },
      linkState: { hoverId: 0 },
      clearSelection: () => {},
      updateLinkHover: () => {},
    } as never,
    readState: () => sharedState,
    writeState: (patch) => Object.assign(sharedState, patch),
    getCanvas: () => ({ width: 800, height: 480 }) as HTMLCanvasElement,
    markSearchDirty: () => {},
    runBeforeInputHook: (text) => text,
    runBeforeRenderOutputHook: (text) => text,
  });
  return { sendInput, sharedState, writes, scheduled };
}

test("pty input marks a frame dirty even while synchronized output is active", () => {
  const harness = createInputHarness({ synchronizedOutput: () => true });

  harness.sendInput("\x1b[?2026hpartial-frame", "pty");

  expect(harness.writes).toEqual(["\x1b[?2026hpartial-frame"]);
  expect(harness.sharedState.needsRender).toBe(true);
  expect(harness.scheduled).toEqual(["schedule"]);
});

test("pty input cancels the synchronized output reset once the mode clears", () => {
  let syncActive = true;
  const harness = createInputHarness({ synchronizedOutput: () => syncActive });

  harness.sendInput("\x1b[?2026hpartial-frame", "pty");
  syncActive = false;
  harness.sendInput("rest-of-frame\x1b[?2026l", "pty");

  expect(harness.sharedState.needsRender).toBe(true);
  expect(harness.scheduled).toEqual(["schedule", "cancel"]);
});

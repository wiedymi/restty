import { expect, test } from "bun:test";
import { createRuntimeControllerInput } from "../src/runtime/create-runtime/runtime-controller.input";
import type { RuntimeControllerSharedState } from "../src/runtime/create-runtime/runtime-controller.state.types";

function createInputHarness(
  options: {
    synchronizedOutput?: () => boolean;
    connected?: boolean;
    forwardTerminalReplies?: boolean;
    wasmOutput?: string;
  } = {},
) {
  const writes: string[] = [];
  const scheduled: string[] = [];
  const ptyWrites: string[] = [];
  let drainCalls = 0;
  let pendingWasmOutput = options.wasmOutput ?? "";
  const wasm = {
    write: (_handle: number, text: string) => {
      writes.push(text);
    },
    setPixelSize: () => {},
    drainOutput: () => {
      drainCalls += 1;
      const output = pendingWasmOutput;
      pendingWasmOutput = "";
      return output;
    },
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
      sendInput: (text: string) => {
        ptyWrites.push(text);
        return true;
      },
      resize: () => true,
      isConnected: () => options.connected ?? false,
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
    forwardTerminalReplies: options.forwardTerminalReplies,
    markSearchDirty: () => {},
    runBeforeInputHook: (text) => text,
    runBeforeRenderOutputHook: (text) => text,
  });
  return {
    sendInput,
    sharedState,
    writes,
    scheduled,
    ptyWrites,
    get drainCalls() {
      return drainCalls;
    },
  };
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

test("terminal replies are forwarded to connected PTY by default", () => {
  const harness = createInputHarness({ connected: true, wasmOutput: "\x1b[1;1R" });

  harness.sendInput("\x1b[6n", "pty");

  expect(harness.writes).toEqual(["\x1b[6n"]);
  expect(harness.ptyWrites).toEqual(["\x1b[1;1R"]);
});

test("terminal replies can be suppressed for backend-owned headless sessions", () => {
  const harness = createInputHarness({
    connected: true,
    forwardTerminalReplies: false,
    wasmOutput: "\x1b[1;1R",
  });

  harness.sendInput("\x1b[6n", "pty");

  expect(harness.writes).toEqual(["\x1b[6n"]);
  expect(harness.ptyWrites).toEqual([]);
  expect(harness.drainCalls).toBe(2);
});

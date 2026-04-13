import { initWebGPU, initWebGL, type WebGPUState, type WebGLState } from "../../renderer";
import type { PtyTransport } from "../../pty";
import type { ResttyWasm } from "../../wasm";
import type { ResttyRuntimeTerminalApi } from "../core/api";
import type { ResttyRuntimeLifecycleState } from "../core/lifecycle";
import type { ResttyRuntimeEvent, ResttyRuntimeEventHub } from "../core/runtime-events";
import type { ResttyRuntimeSession } from "../core/resources";
import type { LifecycleThemeRuntime } from "./runtime-controller.api.types";
import type {
  RuntimeControllerInternalState,
  RuntimeControllerSharedState,
} from "./runtime-controller.state.types";

type RuntimeControllerLifecycleOptions = {
  runtimeEvents: ResttyRuntimeEventHub;
  session: ResttyRuntimeSession;
  ptyTransport: Pick<PtyTransport, "destroy">;
  ptyInputRuntime: {
    cancelSyncOutputReset: () => void;
    disconnectPty: () => void;
  };
  lifecycleThemeSizeRuntime: LifecycleThemeRuntime;
  cleanupFns: Array<() => void>;
  cleanupCanvasFns: Array<() => void>;
  readState: () => RuntimeControllerSharedState;
  writeState: (patch: Partial<RuntimeControllerSharedState>) => void;
  gridState: { cols: number; rows: number };
  getCanvas: () => HTMLCanvasElement;
  applyTheme: ResttyRuntimeTerminalApi["applyTheme"];
  ensureFont: () => Promise<void>;
  updateSize: () => void;
  updateGrid: () => void;
  replaceCanvas: () => void;
  rebuildWebGPUShaderStages: (state: WebGPUState) => void;
  rebuildWebGLShaderStages: (state: WebGLState) => void;
  setShaderStagesDirty: (dirty: boolean) => void;
  clearWebGPUShaderStages: () => void;
  destroyWebGPUStageTargets: () => void;
  clearWebGLShaderStages: (state?: WebGLState) => void;
  destroyWebGLStageTargets: (state?: WebGLState) => void;
  handleSearchWasmReset: () => void;
  internalState: RuntimeControllerInternalState;
  maxScrollbackBytes: number;
  loop: (state: WebGPUState | WebGLState) => void;
};

type RuntimeControllerLifecycle = {
  getLifecycleState: () => ResttyRuntimeLifecycleState;
  init: () => Promise<void>;
  destroy: () => void;
};

export function createRuntimeControllerLifecycle(
  options: RuntimeControllerLifecycleOptions,
): RuntimeControllerLifecycle {
  const {
    runtimeEvents,
    session,
    ptyTransport,
    ptyInputRuntime,
    lifecycleThemeSizeRuntime,
    cleanupFns,
    cleanupCanvasFns,
    readState,
    writeState,
    gridState,
    getCanvas,
    applyTheme,
    ensureFont,
    updateSize,
    updateGrid,
    replaceCanvas,
    rebuildWebGPUShaderStages,
    rebuildWebGLShaderStages,
    setShaderStagesDirty,
    clearWebGPUShaderStages,
    destroyWebGPUStageTargets,
    clearWebGLShaderStages,
    destroyWebGLStageTargets,
    handleSearchWasmReset,
    internalState,
    maxScrollbackBytes,
    loop,
  } = options;

  let lifecycleState: ResttyRuntimeLifecycleState = "created";
  let lifecycleEpoch = 0;

  const isCurrentLifecycleEpoch = (epoch: number) =>
    lifecycleState !== "destroyed" && epoch === lifecycleEpoch;

  const emitRuntimeEvent = (event: ResttyRuntimeEvent) => {
    runtimeEvents.emit(event);
  };

  const setLifecycleState = (next: ResttyRuntimeLifecycleState) => {
    if (lifecycleState === next) return;
    lifecycleState = next;
    emitRuntimeEvent({ type: "state", state: next });
  };

  function destroyWasmHandle(instance: ResttyWasm, handle: number) {
    try {
      instance.destroy(handle);
    } catch {
      // ignore wasm destroy errors
    }
  }

  async function initWasm(initEpoch: number) {
    const shared = readState();
    if (shared.wasmReady && shared.wasm) return shared.wasm;
    const instance = await session.getWasm();
    if (!isCurrentLifecycleEpoch(initEpoch)) return null;
    writeState({
      wasm: instance,
      wasmExports: instance.exports,
      wasmReady: true,
    });
    return instance;
  }

  async function initWasmHarness(initEpoch: number) {
    try {
      const instance = await initWasm(initEpoch);
      if (!instance || !isCurrentLifecycleEpoch(initEpoch)) return;
      const shared = readState();
      if (shared.wasmHandle) {
        destroyWasmHandle(instance, shared.wasmHandle);
        if (!isCurrentLifecycleEpoch(initEpoch)) return;
        writeState({ wasmHandle: 0 });
      }
      updateGrid();
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      const cols = gridState.cols || 80;
      const rows = gridState.rows || 24;
      const wasmHandle = instance.create(cols, rows, maxScrollbackBytes);
      if (!wasmHandle) {
        throw new Error("restty create failed (restty_create returned 0)");
      }
      if (!isCurrentLifecycleEpoch(initEpoch)) {
        destroyWasmHandle(instance, wasmHandle);
        return;
      }
      const canvas = getCanvas();
      instance.setPixelSize(wasmHandle, canvas.width, canvas.height);
      if (!isCurrentLifecycleEpoch(initEpoch)) {
        destroyWasmHandle(instance, wasmHandle);
        return;
      }
      const activeTheme = lifecycleThemeSizeRuntime.getActiveTheme();
      if (activeTheme && isCurrentLifecycleEpoch(initEpoch)) {
        applyTheme(activeTheme, activeTheme.name ?? "cached theme");
      }
      if (!isCurrentLifecycleEpoch(initEpoch)) {
        destroyWasmHandle(instance, wasmHandle);
        return;
      }
      instance.renderUpdate(wasmHandle);
      writeState({ wasmHandle, needsRender: true });
      if (!isCurrentLifecycleEpoch(initEpoch)) {
        destroyWasmHandle(instance, wasmHandle);
        if (readState().wasmHandle === wasmHandle) {
          writeState({ wasmHandle: 0 });
        }
        return;
      }
      handleSearchWasmReset();
    } catch (err) {
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`restty error: ${message}`);
      throw err;
    }
  }

  async function init() {
    if (lifecycleState === "destroyed") return;
    lifecycleEpoch += 1;
    const initEpoch = lifecycleEpoch;
    setLifecycleState("initializing");

    try {
      cancelAnimationFrame(internalState.rafId);
      updateSize();

      await ensureFont();
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      updateGrid();
      const wasmPromise = initWasmHarness(initEpoch);

      const shared = readState();
      if (internalState.preferredRenderer !== "webgl2") {
        if (shared.currentContextType === "webgl2") {
          replaceCanvas();
          if (!isCurrentLifecycleEpoch(initEpoch)) return;
        }
        const canvas = getCanvas();
        const gpuCore = await session.getWebGPUCore(canvas);
        if (!isCurrentLifecycleEpoch(initEpoch)) return;
        const gpuState = gpuCore ? await initWebGPU(canvas, { core: gpuCore }) : null;
        if (!isCurrentLifecycleEpoch(initEpoch)) return;
        if (gpuState) {
          internalState.backend = "webgpu";
          writeState({
            activeState: gpuState,
            currentContextType: "webgpu",
            needsRender: true,
          });
          emitRuntimeEvent({ type: "backend", backend: "webgpu" });
          clearWebGLShaderStages();
          destroyWebGLStageTargets();
          gpuState.context.configure({
            device: gpuState.device,
            format: gpuState.format,
            alphaMode: "opaque",
          });
          rebuildWebGPUShaderStages(gpuState);
          setShaderStagesDirty(false);
          updateGrid();
          await wasmPromise;
          if (!isCurrentLifecycleEpoch(initEpoch)) return;
          setLifecycleState("ready");
          internalState.rafId = requestAnimationFrame(() => loop(gpuState));
          return;
        }
      }

      if (internalState.preferredRenderer !== "webgpu") {
        const nextShared = readState();
        if (nextShared.currentContextType === "webgpu") {
          replaceCanvas();
          if (!isCurrentLifecycleEpoch(initEpoch)) return;
        }
        const canvas = getCanvas();
        const glState = initWebGL(canvas);
        if (!isCurrentLifecycleEpoch(initEpoch)) return;
        if (glState) {
          internalState.backend = "webgl2";
          writeState({
            activeState: glState,
            currentContextType: "webgl2",
            needsRender: true,
          });
          emitRuntimeEvent({ type: "backend", backend: "webgl2" });
          clearWebGPUShaderStages();
          destroyWebGPUStageTargets();
          rebuildWebGLShaderStages(glState);
          setShaderStagesDirty(false);
          updateGrid();
          await wasmPromise;
          if (!isCurrentLifecycleEpoch(initEpoch)) return;
          setLifecycleState("ready");
          internalState.rafId = requestAnimationFrame(() => loop(glState));
          return;
        }
      }

      internalState.backend = "none";
      emitRuntimeEvent({ type: "backend", backend: "none" });
      writeState({ activeState: null, currentContextType: null });
      await wasmPromise;
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      setLifecycleState("ready");
    } catch (error) {
      if (!isCurrentLifecycleEpoch(initEpoch)) return;
      setLifecycleState("failed");
      throw error;
    }
  }

  function destroy() {
    if (lifecycleState === "destroyed") return;
    lifecycleEpoch += 1;
    setLifecycleState("destroyed");
    cancelAnimationFrame(internalState.rafId);
    internalState.backend = "none";
    lifecycleThemeSizeRuntime.cancelScheduledSizeUpdate();
    ptyInputRuntime.cancelSyncOutputReset();
    ptyInputRuntime.disconnectPty();
    ptyTransport.destroy?.();
    const shared = readState();
    if (shared.wasm && shared.wasmHandle) {
      destroyWasmHandle(shared.wasm, shared.wasmHandle);
      writeState({ wasmHandle: 0 });
    }
    clearWebGPUShaderStages();
    destroyWebGPUStageTargets();
    const activeState = readState().activeState;
    if (activeState && "gl" in activeState) {
      clearWebGLShaderStages(activeState);
      destroyWebGLStageTargets(activeState);
    } else {
      clearWebGLShaderStages();
      destroyWebGLStageTargets();
    }
    writeState({
      activeState: null,
      currentContextType: null,
      needsRender: false,
    });
    for (const cleanup of cleanupCanvasFns) cleanup();
    cleanupCanvasFns.length = 0;
    for (const cleanup of cleanupFns) cleanup();
    cleanupFns.length = 0;
  }

  return {
    getLifecycleState: () => lifecycleState,
    init,
    destroy,
  };
}

import { initWebGPUCore, type WebGPUCoreState } from "../renderer";
import { loadResttyWasm, type ResttyWasm } from "../wasm";
import type { ResttyAppSession, ResttyWasmLogListener } from "./types";

/**
 * Create a new app session that lazily loads the WASM module and
 * initializes the WebGPU core on first use. Multiple panes can
 * share a single session to avoid duplicate resource loading.
 */
export function createResttyAppSession(): ResttyAppSession {
  let wasmPromise: Promise<ResttyWasm> | null = null;
  let webgpuCorePromise: Promise<WebGPUCoreState | null> | null = null;
  const wasmLogListeners = new Set<ResttyWasmLogListener>();

  const forwardWasmLog = (message: string) => {
    for (const listener of wasmLogListeners) {
      listener(message);
    }
  };

  return {
    getWasm: () => {
      if (!wasmPromise) {
        wasmPromise = loadResttyWasm({ log: forwardWasmLog });
      }
      return wasmPromise;
    },
    getWebGPUCore: (canvas: HTMLCanvasElement) => {
      if (!webgpuCorePromise) {
        webgpuCorePromise = initWebGPUCore(canvas);
      }
      return webgpuCorePromise;
    },
    addWasmLogListener: (listener: ResttyWasmLogListener) => {
      wasmLogListeners.add(listener);
    },
    removeWasmLogListener: (listener: ResttyWasmLogListener) => {
      wasmLogListeners.delete(listener);
    },
  };
}

let defaultResttyAppSession: ResttyAppSession | null = null;

/** Return the global default session, creating it on first call. */
export function getDefaultResttyAppSession(): ResttyAppSession {
  if (!defaultResttyAppSession) {
    defaultResttyAppSession = createResttyAppSession();
  }
  return defaultResttyAppSession;
}

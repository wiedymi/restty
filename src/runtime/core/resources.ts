import type { DesktopNotification } from "../../input";
import type { WebGPUCoreState } from "../../renderer";
import type { ResttyWasm } from "../../wasm";
import type { Font as TextShaperFont } from "text-shaper";
import type { ResttyFontSource, ResttySearchState } from "./models";

/** Callback for WASM log messages. */
export type ResttyWasmLogListener = (message: string) => void;

/** Shared parsed font face reused across panes within a session. */
export type ResttyFontResourceFace = {
  /** Human-readable label for UI/status output. */
  label: string;
  /** Parsed text-shaper font instance. */
  font: TextShaperFont;
};

/** Lease handle returned by the shared font resource store. */
export type ResttyFontResourceLease = {
  /** Ordered parsed faces (primary + fallbacks). */
  faces: ResttyFontResourceFace[];
  /** Release the lease when pane/runtime no longer needs the faces. */
  release: () => void;
};

/** Session-level font resource store for deduped loading/parsing and caching. */
export type ResttyFontResourceStore = {
  /** Acquire parsed faces for a source list. */
  acquire: (sources: ResttyFontSource[]) => Promise<ResttyFontResourceLease>;
};

/**
 * Runtime session provider that supplies shared WASM and WebGPU resources.
 */
export type ResttyRuntimeSession = {
  /** Lazily initialize and return the WASM module. */
  getWasm: () => Promise<ResttyWasm>;
  /** Lazily initialize and return the WebGPU renderer core for a canvas. */
  getWebGPUCore: (canvas: HTMLCanvasElement) => Promise<WebGPUCoreState | null>;
  /** Return the shared font resource store for this session/tab. */
  getFontResourceStore?: () => ResttyFontResourceStore;
  /** Subscribe to WASM log output. */
  addWasmLogListener?: (listener: ResttyWasmLogListener) => void;
  /** Unsubscribe from WASM log output. */
  removeWasmLogListener?: (listener: ResttyWasmLogListener) => void;
};

/**
 * Callbacks fired by the runtime when internal state changes.
 */
export type ResttyRuntimeCallbacks = {
  /** Terminal requested a desktop notification via OSC 9 / OSC 777. */
  onDesktopNotification?: (notification: DesktopNotification) => void;
  /** Terminal search state changed. */
  onSearchState?: (state: ResttySearchState) => void;
};

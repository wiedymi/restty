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
 * Session provider that supplies shared WASM and WebGPU resources.
 */
export type ResttyAppSession = {
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
 * Optional DOM elements for status displays.
 */
export type ResttyAppElements = {
  /** Device pixel ratio display. */
  dprEl?: HTMLElement | null;
  /** Canvas pixel size display. */
  sizeEl?: HTMLElement | null;
  /** Grid column/row count display. */
  gridEl?: HTMLElement | null;
  /** Cell pixel dimensions display. */
  cellEl?: HTMLElement | null;
  /** Cursor position display. */
  cursorPosEl?: HTMLElement | null;
  /** Mouse mode/status display. */
  mouseStatusEl?: HTMLElement | null;
};

/**
 * Callbacks fired by the app when internal state changes.
 */
export type ResttyAppCallbacks = {
  /** Device pixel ratio changed. */
  onDpr?: (dpr: number) => void;
  /** Canvas pixel dimensions changed. */
  onCanvasSize?: (width: number, height: number) => void;
  /** Grid size (cols x rows) changed. */
  onGridSize?: (cols: number, rows: number) => void;
  /** Cell pixel dimensions changed. */
  onCellSize?: (cellW: number, cellH: number) => void;
  /** Cursor position changed. */
  onCursor?: (col: number, row: number) => void;
  /** Mouse mode/status changed. */
  onMouseStatus?: (status: string) => void;
  /** Terminal requested a desktop notification via OSC 9 / OSC 777. */
  onDesktopNotification?: (notification: DesktopNotification) => void;
  /** Terminal search state changed. */
  onSearchState?: (state: ResttySearchState) => void;
};

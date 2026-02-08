import type { InputHandler, MouseMode } from "../input";
import type { PtyTransport } from "../pty";
import type { WebGPUCoreState } from "../renderer";
import type { GhosttyTheme } from "../theme";
import type { ResttyWasm } from "../wasm";

export type ResttyWasmLogListener = (message: string) => void;

export type ResttyAppSession = {
  getWasm: () => Promise<ResttyWasm>;
  getWebGPUCore: (canvas: HTMLCanvasElement) => Promise<WebGPUCoreState | null>;
  addWasmLogListener?: (listener: ResttyWasmLogListener) => void;
  removeWasmLogListener?: (listener: ResttyWasmLogListener) => void;
};

export type ResttyAppElements = {
  backendEl?: HTMLElement | null;
  fpsEl?: HTMLElement | null;
  dprEl?: HTMLElement | null;
  sizeEl?: HTMLElement | null;
  gridEl?: HTMLElement | null;
  cellEl?: HTMLElement | null;
  termSizeEl?: HTMLElement | null;
  cursorPosEl?: HTMLElement | null;
  inputDebugEl?: HTMLElement | null;
  dbgEl?: HTMLElement | null;
  ptyStatusEl?: HTMLElement | null;
  mouseStatusEl?: HTMLElement | null;
  termDebugEl?: HTMLElement | null;
  logEl?: HTMLElement | null;
  atlasInfoEl?: HTMLElement | null;
  atlasCanvas?: HTMLCanvasElement | null;
};

export type ResttyAppCallbacks = {
  onLog?: (line: string) => void;
  onBackend?: (backend: string) => void;
  onFps?: (fps: number) => void;
  onDpr?: (dpr: number) => void;
  onCanvasSize?: (width: number, height: number) => void;
  onGridSize?: (cols: number, rows: number) => void;
  onCellSize?: (cellW: number, cellH: number) => void;
  onTermSize?: (cols: number, rows: number) => void;
  onCursor?: (col: number, row: number) => void;
  onDebug?: (text: string) => void;
  onInputDebug?: (text: string) => void;
  onPtyStatus?: (status: string) => void;
  onMouseStatus?: (status: string) => void;
};

export type ResttyFontBufferData = ArrayBuffer | ArrayBufferView;

export type ResttyUrlFontSource = {
  type: "url";
  url: string;
  label?: string;
};

export type ResttyBufferFontSource = {
  type: "buffer";
  data: ResttyFontBufferData;
  label?: string;
};

export type ResttyLocalFontSource = {
  type: "local";
  matchers: string[];
  label?: string;
  required?: boolean;
};

export type ResttyFontSource = ResttyUrlFontSource | ResttyBufferFontSource | ResttyLocalFontSource;
export type FontSource = ResttyFontSource;
export type ResttyFontPreset = "default-cdn" | "none";
export type ResttyTouchSelectionMode = "drag" | "long-press" | "off";

export type ResttyAppOptions = {
  canvas: HTMLCanvasElement;
  session?: ResttyAppSession;
  imeInput?: HTMLTextAreaElement | null;
  elements?: ResttyAppElements;
  callbacks?: ResttyAppCallbacks;
  renderer?: "auto" | "webgpu" | "webgl2";
  fontSize?: number;
  alphaBlending?: "native" | "linear" | "linear-corrected";
  fontPreset?: ResttyFontPreset;
  fontSources?: ResttyFontSource[];
  maxSymbolAtlasScale?: number;
  fontScaleOverrides?: { match: RegExp; scale: number }[];
  nerdIconScale?: number;
  autoResize?: boolean;
  attachWindowEvents?: boolean;
  attachCanvasEvents?: boolean;
  /**
   * Touch selection behavior on pointerType=touch:
   * - drag: immediate drag-selection (legacy behavior)
   * - long-press: selection starts after press timeout (default)
   * - off: disable touch selection, keep touch scrolling
   */
  touchSelectionMode?: ResttyTouchSelectionMode;
  /**
   * Long-press timeout in ms for touch selection intent.
   * Only used when touchSelectionMode is "long-press".
   */
  touchSelectionLongPressMs?: number;
  /**
   * Pointer move threshold in CSS pixels before long-press selection is
   * canceled and touch pan-scroll takes priority.
   */
  touchSelectionMoveThresholdPx?: number;
  debugExpose?: boolean;
  ptyTransport?: PtyTransport;
};

export type ResttyApp = {
  init: () => Promise<void>;
  destroy: () => void;
  setRenderer: (value: "auto" | "webgpu" | "webgl2") => void;
  setPaused: (value: boolean) => void;
  togglePause: () => void;
  setFontSize: (value: number) => void;
  setFontSources: (sources: ResttyFontSource[]) => Promise<void>;
  applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
  resetTheme: () => void;
  sendInput: (text: string, source?: string) => void;
  sendKeyInput: (text: string, source?: string) => void;
  clearScreen: () => void;
  connectPty: (url?: string) => void;
  disconnectPty: () => void;
  isPtyConnected: () => boolean;
  setMouseMode: (value: MouseMode) => void;
  getMouseStatus: () => ReturnType<InputHandler["getMouseStatus"]>;
  copySelectionToClipboard: () => Promise<boolean>;
  pasteFromClipboard: () => Promise<boolean>;
  dumpAtlasForCodepoint: (cp: number) => void;
  updateSize: (force?: boolean) => void;
  getBackend: () => string;
};

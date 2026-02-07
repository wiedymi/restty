import type { InputHandler } from "../input";
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

export type ResttyFontSource = string | ArrayBuffer | ArrayBufferView;
export type FontSource = ResttyFontSource;

export type ResttyAppOptions = {
  canvas: HTMLCanvasElement;
  session?: ResttyAppSession;
  imeInput?: HTMLTextAreaElement | null;
  elements?: ResttyAppElements;
  callbacks?: ResttyAppCallbacks;
  renderer?: "auto" | "webgpu" | "webgl2";
  fontSize?: number;
  alphaBlending?: "native" | "linear" | "linear-corrected";
  fontSources?: ResttyFontSource[];
  maxSymbolAtlasScale?: number;
  fontScaleOverrides?: { match: RegExp; scale: number }[];
  nerdIconScale?: number;
  autoResize?: boolean;
  attachWindowEvents?: boolean;
  attachCanvasEvents?: boolean;
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
  applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
  resetTheme: () => void;
  sendInput: (text: string, source?: string) => void;
  sendKeyInput: (text: string, source?: string) => void;
  clearScreen: () => void;
  connectPty: (url?: string) => void;
  disconnectPty: () => void;
  isPtyConnected: () => boolean;
  setMouseMode: (value: string) => void;
  getMouseStatus: () => ReturnType<InputHandler["getMouseStatus"]>;
  copySelectionToClipboard: () => Promise<boolean>;
  pasteFromClipboard: () => Promise<boolean>;
  dumpAtlasForCodepoint: (cp: number) => void;
  updateSize: (force?: boolean) => void;
  getBackend: () => string;
};

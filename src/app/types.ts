import type { InputHandler, MouseMode } from "../input";
import type { PtyTransport } from "../pty";
import type { WebGPUCoreState } from "../renderer";
import type { GhosttyTheme } from "../theme";
import type { ResttyWasm } from "../wasm";

/** Callback for WASM log messages. */
export type ResttyWasmLogListener = (message: string) => void;

/**
 * Session provider that supplies shared WASM and WebGPU resources.
 */
export type ResttyAppSession = {
  /** Lazily initialize and return the WASM module. */
  getWasm: () => Promise<ResttyWasm>;
  /** Lazily initialize and return the WebGPU renderer core for a canvas. */
  getWebGPUCore: (canvas: HTMLCanvasElement) => Promise<WebGPUCoreState | null>;
  /** Subscribe to WASM log output. */
  addWasmLogListener?: (listener: ResttyWasmLogListener) => void;
  /** Unsubscribe from WASM log output. */
  removeWasmLogListener?: (listener: ResttyWasmLogListener) => void;
};

/**
 * Optional DOM elements for debug/status displays.
 */
export type ResttyAppElements = {
  /** Renderer backend name display. */
  backendEl?: HTMLElement | null;
  /** Frames-per-second counter display. */
  fpsEl?: HTMLElement | null;
  /** Device pixel ratio display. */
  dprEl?: HTMLElement | null;
  /** Canvas pixel size display. */
  sizeEl?: HTMLElement | null;
  /** Grid column/row count display. */
  gridEl?: HTMLElement | null;
  /** Cell pixel dimensions display. */
  cellEl?: HTMLElement | null;
  /** Terminal size (cols x rows) display. */
  termSizeEl?: HTMLElement | null;
  /** Cursor position display. */
  cursorPosEl?: HTMLElement | null;
  /** Input sequence debug display. */
  inputDebugEl?: HTMLElement | null;
  /** General debug text display. */
  dbgEl?: HTMLElement | null;
  /** PTY connection status display. */
  ptyStatusEl?: HTMLElement | null;
  /** Mouse mode/status display. */
  mouseStatusEl?: HTMLElement | null;
  /** Terminal internal debug display. */
  termDebugEl?: HTMLElement | null;
  /** Scrollable log output display. */
  logEl?: HTMLElement | null;
  /** Glyph atlas info display. */
  atlasInfoEl?: HTMLElement | null;
  /** Canvas element for atlas visualization. */
  atlasCanvas?: HTMLCanvasElement | null;
};

/**
 * Callbacks fired by the app when internal state changes.
 */
export type ResttyAppCallbacks = {
  /** A log line was emitted. */
  onLog?: (line: string) => void;
  /** Renderer backend was determined. */
  onBackend?: (backend: string) => void;
  /** Frame rate updated. */
  onFps?: (fps: number) => void;
  /** Device pixel ratio changed. */
  onDpr?: (dpr: number) => void;
  /** Canvas pixel dimensions changed. */
  onCanvasSize?: (width: number, height: number) => void;
  /** Grid size (cols x rows) changed. */
  onGridSize?: (cols: number, rows: number) => void;
  /** Cell pixel dimensions changed. */
  onCellSize?: (cellW: number, cellH: number) => void;
  /** Terminal size (cols x rows) changed. */
  onTermSize?: (cols: number, rows: number) => void;
  /** Cursor position changed. */
  onCursor?: (col: number, row: number) => void;
  /** General debug text updated. */
  onDebug?: (text: string) => void;
  /** Input sequence debug text updated. */
  onInputDebug?: (text: string) => void;
  /** PTY connection status changed. */
  onPtyStatus?: (status: string) => void;
  /** Mouse mode/status changed. */
  onMouseStatus?: (status: string) => void;
};

/** Raw font data as an ArrayBuffer or typed-array view. */
export type ResttyFontBufferData = ArrayBuffer | ArrayBufferView;

/** Font source loaded from a URL. */
export type ResttyUrlFontSource = {
  type: "url";
  /** URL to fetch the font file from. */
  url: string;
  /** Human-readable label for debug/log output. */
  label?: string;
};

/** Font source loaded from an in-memory buffer. */
export type ResttyBufferFontSource = {
  type: "buffer";
  /** Raw font file bytes. */
  data: ResttyFontBufferData;
  /** Human-readable label for debug/log output. */
  label?: string;
};

/** Font source resolved from locally installed fonts via the Local Font Access API. */
export type ResttyLocalFontSource = {
  type: "local";
  /** Font family name patterns to match against installed fonts. */
  matchers: string[];
  /** Human-readable label for debug/log output. */
  label?: string;
  /** If true, font loading fails when no local match is found. */
  required?: boolean;
};

/**
 * A font source specification.
 * - url: fetched from a URL
 * - buffer: provided as in-memory bytes
 * - local: resolved from locally installed fonts
 */
export type ResttyFontSource = ResttyUrlFontSource | ResttyBufferFontSource | ResttyLocalFontSource;
/** Alias for ResttyFontSource. */
export type FontSource = ResttyFontSource;
/**
 * Built-in font preset.
 * - default-cdn: load the default font from CDN
 * - none: do not load any preset fonts
 */
export type ResttyFontPreset = "default-cdn" | "none";
/**
 * Touch-based text selection behavior.
 * - drag: immediate drag-selection on touch
 * - long-press: selection starts after a long-press timeout
 * - off: disable touch selection entirely
 */
export type ResttyTouchSelectionMode = "drag" | "long-press" | "off";

/**
 * Options for creating a ResttyApp instance.
 */
export type ResttyAppOptions = {
  /** Target canvas element for terminal rendering. */
  canvas: HTMLCanvasElement;
  /** Shared session for WASM/WebGPU resource reuse across panes. */
  session?: ResttyAppSession;
  /** Hidden textarea for IME composition input. */
  imeInput?: HTMLTextAreaElement | null;
  /** Optional DOM elements for debug/status displays. */
  elements?: ResttyAppElements;
  /** Callbacks for state-change notifications. */
  callbacks?: ResttyAppCallbacks;
  /** Renderer backend preference (default "auto"). */
  renderer?: "auto" | "webgpu" | "webgl2";
  /** Font size in CSS pixels. */
  fontSize?: number;
  /**
   * Alpha blending strategy.
   * - native: GPU-native premultiplied alpha
   * - linear: linear-space blending
   * - linear-corrected: linear-space with gamma correction
   */
  alphaBlending?: "native" | "linear" | "linear-corrected";
  /** Built-in font preset to load. */
  fontPreset?: ResttyFontPreset;
  /** Custom font sources to load. */
  fontSources?: ResttyFontSource[];
  /** Maximum scale factor for the symbol atlas texture. */
  maxSymbolAtlasScale?: number;
  /** Per-glyph scale overrides matched by regex. */
  fontScaleOverrides?: { match: RegExp; scale: number }[];
  /** Scale factor applied to Nerd Font icons. */
  nerdIconScale?: number;
  /** Automatically resize the terminal on container/window changes (default true). */
  autoResize?: boolean;
  /** Attach resize/focus listeners to the window object. */
  attachWindowEvents?: boolean;
  /** Attach pointer/keyboard listeners to the canvas. */
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
  /** Expose internal state on the window object for debugging. */
  debugExpose?: boolean;
  /** PTY transport layer for terminal I/O. */
  ptyTransport?: PtyTransport;
};

/**
 * Public API for a terminal app instance.
 */
export type ResttyApp = {
  /** Initialize the renderer, fonts, and terminal state. */
  init: () => Promise<void>;
  /** Tear down all resources and event listeners. */
  destroy: () => void;
  /** Switch the renderer backend at runtime. */
  setRenderer: (value: "auto" | "webgpu" | "webgl2") => void;
  /** Pause or resume rendering. */
  setPaused: (value: boolean) => void;
  /** Toggle the rendering pause state. */
  togglePause: () => void;
  /** Update the terminal font size in CSS pixels. */
  setFontSize: (value: number) => void;
  /** Replace the active font sources and reload fonts. */
  setFontSources: (sources: ResttyFontSource[]) => Promise<void>;
  /** Apply a Ghostty color theme. */
  applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
  /** Reset colors to the default theme. */
  resetTheme: () => void;
  /** Write raw text to the terminal PTY. */
  sendInput: (text: string, source?: string) => void;
  /** Encode and send a key sequence to the terminal PTY. */
  sendKeyInput: (text: string, source?: string) => void;
  /** Clear the visible screen and scrollback. */
  clearScreen: () => void;
  /** Open a PTY connection, optionally to a specific URL. */
  connectPty: (url?: string) => void;
  /** Close the active PTY connection. */
  disconnectPty: () => void;
  /** Check whether the PTY transport is currently connected. */
  isPtyConnected: () => boolean;
  /** Override the mouse reporting mode. */
  setMouseMode: (value: MouseMode) => void;
  /** Return current mouse reporting status. */
  getMouseStatus: () => ReturnType<InputHandler["getMouseStatus"]>;
  /** Copy the current text selection to the clipboard. */
  copySelectionToClipboard: () => Promise<boolean>;
  /** Paste clipboard contents into the terminal. */
  pasteFromClipboard: () => Promise<boolean>;
  /** Dump the glyph atlas entry for a given Unicode codepoint. */
  dumpAtlasForCodepoint: (cp: number) => void;
  /** Recalculate terminal dimensions from the canvas size. */
  updateSize: (force?: boolean) => void;
  /** Return the name of the active renderer backend. */
  getBackend: () => string;
};

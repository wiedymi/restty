import type { InputHandler } from "../input";
import type { GhosttyTheme } from "../theme";

export type TextShaper = {
  Font: {
    loadAsync: (buffer: ArrayBuffer) => Promise<any>;
    collection?: (buffer: ArrayBuffer) => {
      names: () => Array<{
        index: number;
        fullName?: string;
        family?: string;
        postScriptName?: string;
      }>;
      get: (index: number) => any;
    } | null;
  };
  UnicodeBuffer: new () => { addStr: (text: string) => void };
  shape: (font: any, buffer: any) => any;
  glyphBufferToShapedGlyphs: (glyphBuffer: any) => Array<{
    glyphId: number;
    xAdvance: number;
    xOffset: number;
    yOffset: number;
  }>;
  buildAtlas: (font: any, glyphIds: number[], options: any) => any;
  atlasToRGBA: (atlas: any) => Uint8Array | null;
  rasterizeGlyph?: (
    font: any,
    glyphId: number,
    fontSize: number,
    options?: any,
  ) => { bitmap: any; bearingX: number; bearingY: number } | null;
  rasterizeGlyphWithTransform?: (
    font: any,
    glyphId: number,
    fontSize: number,
    matrix: number[] | number[][],
    options?: any,
  ) => { bitmap: any; bearingX: number; bearingY: number } | null;
  PixelMode: { Gray: any; RGBA?: any };
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

export type FontSource = {
  name: string;
  url?: string;
  buffer?: ArrayBuffer;
  matchers?: string[];
};

export type ResttyAppOptions = {
  canvas: HTMLCanvasElement;
  imeInput?: HTMLTextAreaElement | null;
  textShaper: TextShaper;
  elements?: ResttyAppElements;
  callbacks?: ResttyAppCallbacks;
  renderer?: "auto" | "webgpu" | "webgl2";
  fontSize?: number;
  assetBaseUrl?: string;
  alphaBlending?: "native" | "linear" | "linear-corrected";
  fontSources?: {
    primary?: { url?: string; buffer?: ArrayBuffer; matchers?: string[] };
    fallbacks?: FontSource[];
  };
  maxSymbolAtlasScale?: number;
  fontScaleOverrides?: { match: RegExp; scale: number }[];
  nerdIconScale?: number;
  autoResize?: boolean;
  attachWindowEvents?: boolean;
  attachCanvasEvents?: boolean;
  debugExpose?: boolean;
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
  connectPty: (url: string) => void;
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

import type { InputHandler } from "../../input";
import type { FontManagerState } from "../../fonts";
import type { Color, WebGLState, WebGPUState } from "../../renderer";
import type { GhosttyTheme } from "../../theme";
import type { RuntimeTerminalColor } from "./highlight-terminal-color-utils.types";
import type { ResttyWasm } from "../../wasm";
import type { ResttyAppCallbacks } from "../core/resources";

export type ActiveState = WebGPUState | WebGLState | null;

export type GridStateRef = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  fontSizePx: number;
};

export type ResizeStateRef = {
  active: boolean;
  lastAt: number;
  cols: number;
  rows: number;
  dpr: number;
};

export type CanvasStateSnapshot = {
  width: number;
  height: number;
  dpr: number;
  gridCols: number;
  gridRows: number;
  cellW: number;
  cellH: number;
  fontSizePx: number;
};

export type LifecycleThemeSizeDeps = {
  attachCanvasEvents: boolean;
  attachWindowEvents: boolean;
  autoResize: boolean;
  imeInput: HTMLTextAreaElement | null;
  dprEl: HTMLElement | null;
  sizeEl: HTMLElement | null;
  callbacks: ResttyAppCallbacks | undefined;
  cleanupFns: Array<() => void>;
  cleanupCanvasFns: Array<() => void>;
  gridState: GridStateRef;
  resizeState: ResizeStateRef;
  fontState: FontManagerState;
  defaultBgBase: Color;
  defaultFgBase: Color;
  selectionBackgroundBase: RuntimeTerminalColor;
  selectionForegroundBase: RuntimeTerminalColor | null;
  searchMatchBackgroundBase: RuntimeTerminalColor;
  searchCurrentMatchBackgroundBase: RuntimeTerminalColor;
  searchMatchTextBase: RuntimeTerminalColor;
  searchCurrentMatchTextBase: RuntimeTerminalColor;
  cursorBase: Color;
  getCanvas: () => HTMLCanvasElement;
  setCanvas: (canvas: HTMLCanvasElement) => void;
  getCurrentDpr: () => number;
  setCurrentDpr: (dpr: number) => void;
  setCurrentContextType: (type: "webgpu" | "webgl2" | null) => void;
  getActiveState: () => ActiveState;
  getInputHandler: () => InputHandler | null;
  setIsFocused: (value: boolean) => void;
  getActiveTheme: () => GhosttyTheme | null;
  setActiveTheme: (theme: GhosttyTheme | null) => void;
  setDefaultBg: (value: Color) => void;
  setDefaultFg: (value: Color) => void;
  setSelectionBackgroundColor: (value: RuntimeTerminalColor) => void;
  setSelectionForegroundColor: (value: RuntimeTerminalColor | null) => void;
  setSearchMatchBackgroundColor: (value: RuntimeTerminalColor) => void;
  setSearchCurrentMatchBackgroundColor: (value: RuntimeTerminalColor) => void;
  setSearchMatchTextColor: (value: RuntimeTerminalColor) => void;
  setSearchCurrentMatchTextColor: (value: RuntimeTerminalColor) => void;
  setCursorFallback: (value: Color) => void;
  getWasmReady: () => boolean;
  getWasm: () => ResttyWasm | null;
  getWasmHandle: () => number;
  bindCanvasEvents: () => void;
  computeCellMetrics: () => { cellW: number; cellH: number } | null;
  updateGrid: () => void;
  clearKittyRenderCaches: () => void;
  sendKeyInput: (text: string, source?: string) => void;
  clearWebGLShaderStages: (state?: WebGLState) => void;
  destroyWebGLStageTargets: (state?: WebGLState) => void;
  destroyWebGPUStageTargets: () => void;
  setShaderStagesDirty: (value: boolean) => void;
  markNeedsRender: () => void;
  resetLastRenderTime: () => void;
};

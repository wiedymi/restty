import type { InputHandler } from "../../input";
import type { PtyTransport } from "../../pty";
import type { WebGPUState, WebGLState } from "../../renderer";
import type { GhosttyTheme } from "../../theme";
import type { ResttyWasm, ResttyWasmExports } from "../../wasm";
import type {
  ResttyRuntime,
  ResttyRuntimeInteractionApi,
  ResttyRuntimeRenderApi,
  ResttyRuntimeSearchApi,
  ResttyRuntimeTerminalApi,
} from "../core/api";
import type { ResttyRuntimeEventHub } from "../core/runtime-events";
import type { ResttyAppCallbacks, ResttyAppSession } from "../core/resources";
import type { PtyInputRuntime } from "./pty-input-runtime.types";
import type { RuntimeInteraction } from "./interaction-runtime";

export type RuntimeAppApiSharedState = {
  wasm: ResttyWasm | null;
  wasmExports: ResttyWasmExports | null;
  wasmHandle: number;
  wasmReady: boolean;
  activeState: WebGPUState | WebGLState | null;
  needsRender: boolean;
  lastRenderTime: number;
  currentContextType: "webgpu" | "webgl2" | null;
  isFocused: boolean;
  lastKeydownSeq: string;
  lastKeydownSeqAt: number;
};

export type RuntimeBackend = "none" | "webgpu" | "webgl2";
export type PreferredRenderer = "auto" | "webgpu" | "webgl2";

export type RuntimeInternalState = {
  paused: boolean;
  backend: RuntimeBackend;
  preferredRenderer: PreferredRenderer;
  rafId: number;
  frameCount: number;
  lastFpsTime: number;
  nextBlinkTime: number;
};

export type RuntimeSendInput = (
  text: string,
  source?: string,
  options?: { skipHooks?: boolean },
) => void;

export type RuntimePublicApiOptions = {
  setFontSize: ResttyRuntimeTerminalApi["setFontSize"];
  setLigatures: ResttyRuntimeTerminalApi["setLigatures"];
  setFontHinting: ResttyRuntimeTerminalApi["setFontHinting"];
  setFontHintTarget: ResttyRuntimeTerminalApi["setFontHintTarget"];
  setFontSources: ResttyRuntimeTerminalApi["setFontSources"];
  resetTheme: ResttyRuntimeTerminalApi["resetTheme"];
  setSearchQuery: ResttyRuntimeSearchApi["setQuery"];
  clearSearch: ResttyRuntimeSearchApi["clear"];
  searchNext: ResttyRuntimeSearchApi["next"];
  searchPrevious: ResttyRuntimeSearchApi["previous"];
  getSearchState: ResttyRuntimeSearchApi["getState"];
  resize: ResttyRuntimeInteractionApi["resize"];
  focus: ResttyRuntimeInteractionApi["focus"];
  blur: ResttyRuntimeInteractionApi["blur"];
  updateSize: ResttyRuntimeInteractionApi["updateSize"];
  setShaderStages: ResttyRuntimeRenderApi["setShaderStages"];
  getShaderStages: ResttyRuntimeRenderApi["getShaderStages"];
};

export type RuntimeAppApiRuntime = {
  sendInput: RuntimeSendInput;
  createPublicApi: (options: RuntimePublicApiOptions) => ResttyRuntime;
};

export type LifecycleThemeRuntime = {
  cancelScheduledSizeUpdate: () => void;
  getActiveTheme: () => GhosttyTheme | null;
};

export type RuntimeAppApiOptions = {
  runtimeEvents: ResttyRuntimeEventHub;
  session: ResttyAppSession;
  ptyTransport: PtyTransport;
  inputHandler: InputHandler;
  ptyInputRuntime: PtyInputRuntime;
  interaction: RuntimeInteraction;
  lifecycleThemeSizeRuntime: LifecycleThemeRuntime;
  cleanupFns: Array<() => void>;
  cleanupCanvasFns: Array<() => void>;
  callbacks?: ResttyAppCallbacks;
  fpsEl: HTMLElement | null;
  backendEl: HTMLElement | null;
  inputDebugEl: HTMLElement | null;
  imeInput: HTMLTextAreaElement | null;
  attachWindowEvents: boolean;
  isMacPlatform: boolean;
  textEncoder: TextEncoder;
  readState: () => RuntimeAppApiSharedState;
  writeState: (patch: Partial<RuntimeAppApiSharedState>) => void;
  appendLog: (line: string) => void;
  shouldSuppressWasmLog: (text: string) => boolean;
  runBeforeInputHook: (text: string, source: string) => string | null;
  runBeforeRenderOutputHook: (text: string, source: string) => string | null;
  getSelectionText: () => string;
  initialPreferredRenderer: PreferredRenderer;
  maxScrollbackBytes?: number;
  maxScrollback?: number;
  CURSOR_BLINK_MS: number;
  RESIZE_ACTIVE_MS: number;
  TARGET_RENDER_FPS: number;
  BACKGROUND_RENDER_FPS: number;
  KITTY_FLAG_REPORT_EVENTS: number;
  resizeState: { lastAt: number };
  tickWebGPU: (state: WebGPUState) => void;
  tickWebGL: (state: WebGLState) => void;
  updateGrid: () => void;
  gridState: { cols: number; rows: number };
  getCanvas: () => HTMLCanvasElement;
  applyTheme: ResttyRuntimeTerminalApi["applyTheme"];
  ensureFont: () => Promise<void>;
  updateSize: ResttyRuntimeInteractionApi["updateSize"];
  log: (line: string) => void;
  replaceCanvas: () => void;
  rebuildWebGPUShaderStages: (state: WebGPUState) => void;
  rebuildWebGLShaderStages: (state: WebGLState) => void;
  setShaderStagesDirty: (dirty: boolean) => void;
  clearWebGPUShaderStages: () => void;
  destroyWebGPUStageTargets: () => void;
  clearWebGLShaderStages: (state?: WebGLState) => void;
  destroyWebGLStageTargets: (state?: WebGLState) => void;
  markSearchDirty: () => void;
  handleSearchWasmReset: () => void;
};

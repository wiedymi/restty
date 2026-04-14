import type { InputHandler } from "../../input";
import type { PtyTransport } from "../../pty";
import type { WebGPUState, WebGLState } from "../../renderer";
import type { GhosttyTheme } from "../../theme";
import type {
  ResttyRuntime,
  ResttyRuntimeInteractionApi,
  ResttyRuntimeRenderApi,
  ResttyRuntimeSearchApi,
  ResttyRuntimeTerminalApi,
} from "../core/api";
import type { ResttyRuntimeEventHub } from "../core/runtime-events";
import type { ResttyRuntimeSession } from "../core/resources";
import type { RuntimeInteraction } from "./interaction-runtime/runtime.types";
import type { PtyInputRuntime } from "./pty-input-runtime.types";
import type {
  PreferredRenderer,
  RuntimeControllerSharedState,
} from "./runtime-controller.state.types";

export type RuntimeSendInput = (
  text: string,
  source?: string,
  options?: { skipHooks?: boolean },
) => void;

export type RuntimeControllerPublicCapabilities = {
  terminal: Pick<
    ResttyRuntimeTerminalApi,
    | "setFontSize"
    | "setLigatures"
    | "setFontHinting"
    | "setFontHintTarget"
    | "setFontSources"
    | "resetTheme"
  >;
  search: ResttyRuntimeSearchApi;
  interaction: Pick<ResttyRuntimeInteractionApi, "resize" | "focus" | "blur" | "updateSize">;
  render: Pick<ResttyRuntimeRenderApi, "setShaderStages" | "getShaderStages">;
};

export type RuntimeController = {
  sendInput: RuntimeSendInput;
  createPublicApi: (capabilities: RuntimeControllerPublicCapabilities) => ResttyRuntime;
};

export type LifecycleThemeRuntime = {
  cancelScheduledSizeUpdate: () => void;
  getActiveTheme: () => GhosttyTheme | null;
};

export type RuntimeControllerRuntimeDeps = {
  session: ResttyRuntimeSession;
  ptyTransport: PtyTransport;
  inputHandler: InputHandler;
  ptyInputRuntime: PtyInputRuntime;
  interaction: RuntimeInteraction;
  lifecycleThemeSizeRuntime: LifecycleThemeRuntime;
};

export type RuntimeControllerStateDeps = {
  readState: () => RuntimeControllerSharedState;
  writeState: (patch: Partial<RuntimeControllerSharedState>) => void;
  resizeState: { lastAt: number };
  gridState: { cols: number; rows: number };
  getCanvas: () => HTMLCanvasElement;
};

export type RuntimeControllerPlatformDeps = {
  imeInput: HTMLTextAreaElement | null;
  attachWindowEvents: boolean;
  isMacPlatform: boolean;
  KITTY_FLAG_REPORT_EVENTS: number;
};

export type RuntimeControllerHookDeps = {
  runBeforeInputHook: (text: string, source: string) => string | null;
  runBeforeRenderOutputHook: (text: string, source: string) => string | null;
  getSelectionText: () => string;
  markSearchDirty: () => void;
  handleSearchWasmReset: () => void;
};

export type RuntimeControllerRenderDeps = {
  initialPreferredRenderer: PreferredRenderer;
  CURSOR_BLINK_MS: number;
  RESIZE_ACTIVE_MS: number;
  TARGET_RENDER_FPS: number;
  BACKGROUND_RENDER_FPS: number;
  tickWebGPU: (state: WebGPUState) => void;
  tickWebGL: (state: WebGLState) => void;
};

export type RuntimeControllerLifecycleDeps = {
  cleanupFns: Array<() => void>;
  cleanupCanvasFns: Array<() => void>;
  updateGrid: () => void;
  applyTheme: ResttyRuntimeTerminalApi["applyTheme"];
  ensureFont: () => Promise<void>;
  updateSize: ResttyRuntimeInteractionApi["updateSize"];
  replaceCanvas: () => void;
  rebuildWebGPUShaderStages: (state: WebGPUState) => void;
  rebuildWebGLShaderStages: (state: WebGLState) => void;
  setShaderStagesDirty: (dirty: boolean) => void;
  clearWebGPUShaderStages: () => void;
  destroyWebGPUStageTargets: () => void;
  clearWebGLShaderStages: (state?: WebGLState) => void;
  destroyWebGLStageTargets: (state?: WebGLState) => void;
  maxScrollbackBytes?: number;
  maxScrollback?: number;
};

export type RuntimeControllerOptions = {
  runtimeEvents: ResttyRuntimeEventHub;
  runtime: RuntimeControllerRuntimeDeps;
  state: RuntimeControllerStateDeps;
  platform: RuntimeControllerPlatformDeps;
  hooks: RuntimeControllerHookDeps;
  render: RuntimeControllerRenderDeps;
  lifecycle: RuntimeControllerLifecycleDeps;
};

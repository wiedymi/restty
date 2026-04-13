import type { PtyTransport } from "../../pty";
import type {
  ResttyAppInputPayload,
  ResttyFontHintTarget,
  ResttyFontPreset,
  ResttyFontSource,
  ResttyShaderStage,
  ResttyTouchSelectionMode,
} from "./models";
import type { ResttyAppCallbacks, ResttyAppElements, ResttyAppSession } from "./resources";

/**
 * DOM/session fields required to mount a runtime instance.
 */
export type ResttyRuntimeMountConfig = {
  /** Target canvas element for terminal rendering. */
  canvas: HTMLCanvasElement;
  /** Shared session for WASM/WebGPU resource reuse across panes. */
  session?: ResttyAppSession;
  /** Hidden textarea for IME composition input. */
  imeInput?: HTMLTextAreaElement | null;
};

/**
 * Advanced runtime service hooks and adapters.
 */
export type ResttyRuntimeServicesConfig = {
  /** Optional DOM elements for debug/status displays. */
  elements?: ResttyAppElements;
  /** Callbacks for state-change notifications. */
  callbacks?: ResttyAppCallbacks;
  /** PTY transport layer for terminal I/O. */
  ptyTransport?: PtyTransport;
  /** Expose internal state on the window object for debugging. */
  debugExpose?: boolean;
  /**
   * Optional hook to transform or suppress terminal/program input
   * before it is written to the terminal core.
   */
  beforeInput?: (payload: ResttyAppInputPayload) => string | null | void;
  /**
   * Optional hook to transform or suppress PTY output before it is
   * queued for rendering.
   */
  beforeRenderOutput?: (payload: ResttyAppInputPayload) => string | null | void;
};

/**
 * Terminal behavior/config shared across panes and runtime creation.
 */
export type ResttyTerminalConfig = {
  /** Renderer backend preference (default "auto"). */
  renderer?: "auto" | "webgpu" | "webgl2";
  /** Font size in CSS pixels. */
  fontSize?: number;
  /** Enable programming ligature shaping across adjacent operator cells (default true). */
  ligatures?: boolean;
  /** Enable TrueType hinting during atlas rasterization (default false). */
  fontHinting?: boolean;
  /**
   * Hinting target mode passed to text-shaper when hinting is enabled.
   * - auto: infer from pixel mode
   * - light: prefer light/subpixel-like vertical hinting
   * - normal: prefer full hinting
   */
  fontHintTarget?: ResttyFontHintTarget;
  /**
   * Font sizing mode used by text-shaper scale resolution.
   * - em: interpret fontSize as EM size
   * - height: interpret fontSize as full font height (ascender-descender-lineGap)
   */
  fontSizeMode?: "em" | "height";
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
  /** Optional render-stage shader chain. */
  shaderStages?: ResttyShaderStage[];
  /**
   * Maximum scrollback buffer size in bytes passed to the WASM terminal.
   * Default is 10_000_000 (10MB).
   */
  maxScrollbackBytes?: number;
  /**
   * Deprecated alias for maxScrollbackBytes.
   * If both are set, maxScrollbackBytes takes precedence.
   */
  maxScrollback?: number;
};

/**
 * Configuration for creating a Restty runtime instance.
 */
export type ResttyRuntimeConfig = ResttyRuntimeMountConfig &
  ResttyRuntimeServicesConfig &
  ResttyTerminalConfig;

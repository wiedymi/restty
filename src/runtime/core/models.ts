import type { SearchViewportMatch } from "../../wasm";

export type ResttySearchState = {
  query: string;
  active: boolean;
  pending: boolean;
  complete: boolean;
  total: number;
  selectedIndex: number | null;
};

export type ResttySearchViewportMatch = SearchViewportMatch;

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
/** Hinting target mode used when TrueType hinting is enabled. */
export type ResttyFontHintTarget = "auto" | "light" | "normal";

/** Input payload passed to runtime before-input hooks. */
export type ResttyAppInputPayload = {
  text: string;
  source: string;
};

/** Render-stage phase ordering. */
export type ResttyShaderStageMode = "before-main" | "after-main" | "replace-main";
/** Target backend(s) for a shader stage. */
export type ResttyShaderStageBackend = "webgpu" | "webgl2" | "both";
/** Stage shader source definitions. */
export type ResttyShaderStageSource = {
  /**
   * WGSL source that defines:
   * fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f
   */
  wgsl?: string;
  /**
   * GLSL source that defines:
   * vec4 resttyStage(vec4 color, vec2 uv, float time, vec4 params0, vec4 params1)
   */
  glsl?: string;
};
/** User-defined frame shader stage. */
export type ResttyShaderStage = {
  id: string;
  mode?: ResttyShaderStageMode;
  backend?: ResttyShaderStageBackend;
  priority?: number;
  enabled?: boolean;
  /** Optional numeric uniforms packed into params0/params1 (up to 8 values). */
  uniforms?: number[];
  shader: ResttyShaderStageSource;
  /** Optional compile/runtime error callback for this stage. */
  onError?: (message: string) => void;
};

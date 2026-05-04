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
export type ResttyFontData = ArrayBuffer | ArrayBufferView;

/** Font style metadata used for local matching and face labels. */
export type ResttyFontStyle = "normal" | "italic" | "oblique";

/** Local Font Access behavior for family-based inputs. */
export type ResttyLocalFontMode = "prefer" | "require";

/** Font loaded from a URL or app-relative path. */
export type ResttyFontUrlInput = {
  url: string | URL;
  name?: string;
  weight?: number;
  style?: ResttyFontStyle;
};

/** Font loaded from an app-relative path. */
export type ResttyFontPathInput = {
  path: string;
  name?: string;
  weight?: number;
  style?: ResttyFontStyle;
};

/** Font loaded from an in-memory buffer. */
export type ResttyFontBufferInput = {
  data: ResttyFontData;
  name?: string;
  weight?: number;
  style?: ResttyFontStyle;
};

/** Non-family font inputs that can be used as fallbacks. */
export type ResttyFontFallbackInput =
  | string
  | URL
  | ResttyFontData
  | ResttyFontUrlInput
  | ResttyFontPathInput
  | ResttyFontBufferInput;

/**
 * Font resolved by family name through Local Font Access, optionally falling
 * back to a URL/path/buffer when the local face is unavailable.
 */
export type ResttyFontFamilyInput = {
  family: string;
  local?: ResttyLocalFontMode;
  fallback?: ResttyFontFallbackInput;
  name?: string;
  weight?: number;
  style?: ResttyFontStyle;
};

/**
 * Public font input accepted by runtime and surface APIs.
 * - string/URL/path: fetched directly when URL-like, otherwise treated as a local family
 * - buffer/data: parsed from memory
 * - family: tries Local Font Access, with optional fallback
 */
export type ResttyFontInput = ResttyFontFallbackInput | ResttyFontFamilyInput;

/** Internal resolved source consumed by the runtime font resource store. */
export type ResttyResolvedFontSource =
  | {
      kind: "url";
      url: string;
      label: string;
      weight?: number;
      style?: ResttyFontStyle;
    }
  | {
      kind: "buffer";
      data: ResttyFontData;
      label: string;
      weight?: number;
      style?: ResttyFontStyle;
    }
  | {
      kind: "local";
      family: string;
      matchers: string[];
      label: string;
      required: boolean;
      weight?: number;
      style?: ResttyFontStyle;
    };
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
export type ResttyRuntimeInputPayload = {
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

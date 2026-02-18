// restty public API - high-level integration first.

export {
  RESTTY_PLUGIN_API_VERSION,
  Restty,
  ResttyPaneHandle,
  createRestty,
} from "./surface/restty";
export type {
  ResttyOptions,
  ResttyPaneApi,
  ResttyPluginApiRange,
  ResttyPlugin,
  ResttyPluginCleanup,
  ResttyPluginContext,
  ResttyPluginDisposable,
  ResttyPluginEvents,
  ResttyPluginInfo,
  ResttyPluginRequires,
  ResttyInputInterceptor,
  ResttyInputInterceptorPayload,
  ResttyInterceptorOptions,
  ResttyLifecycleHook,
  ResttyLifecycleHookPayload,
  ResttyPluginLoadResult,
  ResttyPluginLoadStatus,
  ResttyPluginManifestEntry,
  ResttyPluginRegistry,
  ResttyPluginRegistryEntry,
  ResttyRenderHook,
  ResttyRenderHookPayload,
  ResttyOutputInterceptor,
  ResttyOutputInterceptorPayload,
  ResttyRenderStageHandle,
} from "./surface/restty";

export {
  getBuiltinTheme,
  getBuiltinThemeSource,
  isBuiltinThemeName,
  listBuiltinThemeNames,
  parseGhosttyTheme,
} from "./theme";
export type { GhosttyTheme, ResttyBuiltinThemeName } from "./theme";

export type {
  ResttyFontHintTarget,
  ResttyFontSource,
  ResttyUrlFontSource,
  ResttyBufferFontSource,
  ResttyLocalFontSource,
  ResttyFontPreset,
  ResttyShaderStage,
  ResttyShaderStageMode,
  ResttyShaderStageBackend,
  ResttyShaderStageSource,
} from "./runtime/types";

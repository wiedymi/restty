// restty public API - high-level integration first.

export {
  RESTTY_PLUGIN_API_VERSION,
  Restty,
  ResttyPaneHandle,
  createRestty,
} from "./surface/restty";
export type {
  ResttyConfig,
  ResttyServicesConfig,
  ResttySurfaceConfig,
  ResttySurfaceEvents,
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
export type {
  ResttyManagedPaneSearchUiOptions,
  ResttyManagedPaneSearchUiStyleOptions,
} from "./surface/panes/managed-pane-types";
export type {
  ResttyPaneSearchUiOpenOptions,
  ResttyPaneSearchUiCloseOptions,
} from "./surface/pane-search-ui";

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
} from "./runtime/core/models";
export type {
  ResttyTerminalConfig,
  ResttyRuntimeMountConfig,
  ResttyRuntimeServicesConfig,
  ResttyRuntimeConfig,
} from "./runtime/core/config";
export type { ResttyRuntimeEvent, ResttyRuntimeLifecycleState } from "./runtime/types";

export { createWebSocketPtyTransport } from "./pty";
export type { PtyCallbacks, PtyConnectOptions, PtyResizeMeta, PtyTransport } from "./pty";

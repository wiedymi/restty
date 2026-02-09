// restty public API - high-level integration first.

export { Restty, ResttyPaneHandle, createRestty } from "./app/restty";
export type {
  ResttyOptions,
  ResttyPaneApi,
  ResttyPlugin,
  ResttyPluginCleanup,
  ResttyPluginContext,
  ResttyPluginDisposable,
  ResttyPluginEvents,
} from "./app/restty";

export {
  getBuiltinTheme,
  getBuiltinThemeSource,
  isBuiltinThemeName,
  listBuiltinThemeNames,
  parseGhosttyTheme,
} from "./theme";
export type { GhosttyTheme, ResttyBuiltinThemeName } from "./theme";

export type {
  ResttyFontSource,
  ResttyUrlFontSource,
  ResttyBufferFontSource,
  ResttyLocalFontSource,
  ResttyFontPreset,
} from "./app/types";

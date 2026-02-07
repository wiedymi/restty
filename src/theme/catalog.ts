import { parseGhosttyTheme, type GhosttyTheme } from "./ghostty";
import {
  BUILTIN_THEME_NAMES,
  BUILTIN_THEME_SOURCES,
  type BuiltinThemeName,
} from "./builtin-themes";

const parsedThemeCache = new Map<BuiltinThemeName, GhosttyTheme>();

export type ResttyBuiltinThemeName = BuiltinThemeName;

export function listBuiltinThemeNames(): ResttyBuiltinThemeName[] {
  return [...BUILTIN_THEME_NAMES];
}

export function isBuiltinThemeName(
  name: string,
): name is ResttyBuiltinThemeName {
  return Object.prototype.hasOwnProperty.call(BUILTIN_THEME_SOURCES, name);
}

export function getBuiltinThemeSource(name: string): string | null {
  if (!isBuiltinThemeName(name)) return null;
  return BUILTIN_THEME_SOURCES[name];
}

export function getBuiltinTheme(name: string): GhosttyTheme | null {
  if (!isBuiltinThemeName(name)) return null;
  const cached = parsedThemeCache.get(name);
  if (cached) return cached;

  const parsed = parseGhosttyTheme(BUILTIN_THEME_SOURCES[name]);
  if (!parsed.name) parsed.name = name;
  parsedThemeCache.set(name, parsed);
  return parsed;
}

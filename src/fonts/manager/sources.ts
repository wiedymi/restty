import type { FallbackFontSource } from "../types";
import type {
  GlobalWithLocalFontAccess,
  NavigatorWithLocalFontAccess,
} from "../local-font-access.types";

/** Fetch a font file from a URL and return its ArrayBuffer, or null on failure. */
export async function tryFetchFontBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (response.ok) return response.arrayBuffer();
  } catch {
    // Ignore and try local fonts.
  }
  return null;
}

/** Query locally installed fonts via the Local Font Access API and return the first match, or null. */
export async function tryLocalFontBuffer(matchers: string[]): Promise<ArrayBuffer | null> {
  const globalAccess = globalThis as GlobalWithLocalFontAccess;
  const nav = (globalAccess.navigator ?? navigator) as NavigatorWithLocalFontAccess;
  const queryLocalFonts =
    typeof globalAccess.queryLocalFonts === "function"
      ? globalAccess.queryLocalFonts.bind(globalAccess)
      : typeof nav.queryLocalFonts === "function"
        ? nav.queryLocalFonts.bind(nav)
        : null;
  if (!queryLocalFonts) return null;
  const normalizedMatchers = matchers.map((matcher) => matcher.toLowerCase()).filter(Boolean);
  if (!normalizedMatchers.length) return null;
  const queryPermission = nav.permissions?.query;
  if (queryPermission) {
    try {
      const status = await queryPermission({ name: "local-fonts" });
      if (status?.state === "denied") return null;
    } catch {
      // Ignore permissions API errors and attempt queryLocalFonts directly.
    }
  }
  try {
    const fonts = await queryLocalFonts();
    const match = fonts.find((font) => {
      const name =
        `${font.family ?? ""} ${font.fullName ?? ""} ${font.postscriptName ?? ""}`.toLowerCase();
      return normalizedMatchers.some((matcher) => name.includes(matcher));
    });
    if (match) {
      const blob = await match.blob();
      return blob.arrayBuffer();
    }
  } catch (err) {
    console.warn("queryLocalFonts failed", err);
  }
  return null;
}

/**
 * Load the primary font buffer, trying local Nerd Font matchers first,
 * then a remote fallback URL, then broader local font matchers. Throws
 * if all sources fail.
 */
export async function loadPrimaryFontBuffer(
  localMatchers: string[],
  fallbackUrl: string,
  fallbackLocalMatchers: string[],
): Promise<ArrayBuffer> {
  const nerdLocal = await tryLocalFontBuffer(localMatchers);
  if (nerdLocal) return nerdLocal;

  const buffer = await tryFetchFontBuffer(fallbackUrl);
  if (buffer) return buffer;

  const local = await tryLocalFontBuffer(fallbackLocalMatchers);
  if (local) return local;

  throw new Error("Unable to load primary font.");
}

/** Load fallback font buffers from a list of sources, trying remote URLs then local matchers. */
export async function loadFallbackFontBuffers(
  sources: FallbackFontSource[],
): Promise<{ name: string; buffer: ArrayBuffer }[]> {
  const results: { name: string; buffer: ArrayBuffer }[] = [];

  for (const source of sources) {
    const buffer = await tryFetchFontBuffer(source.url);
    if (buffer) {
      results.push({ name: source.name, buffer });
      continue;
    }
    if (source.matchers && source.matchers.length) {
      const local = await tryLocalFontBuffer(source.matchers);
      if (local) results.push({ name: source.name, buffer: local });
    }
  }

  return results;
}

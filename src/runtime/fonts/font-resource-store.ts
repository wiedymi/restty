import * as bundledTextShaper from "text-shaper";
import type {
  GlobalWithLocalFontAccess,
  LocalFontFaceData,
  NavigatorWithLocalFontAccess,
} from "../../fonts/local-font-access.types";
import { sourceBufferFromView, sourceLabelFromUrl } from "../create-runtime/create-app-io-utils";
import type { ResttyFontSource } from "../core/models";
import type {
  ResttyFontResourceFace,
  ResttyFontResourceLease,
  ResttyFontResourceStore,
} from "../core/resources";

type ParsedFontFace = {
  font: ResttyFontResourceFace["font"];
  metadataLabel?: string;
  index?: number;
};

type SourceCacheEntry = {
  key: string;
  buffer: ArrayBuffer | null;
  byteLength: number;
  loadedAt: number;
  lastUsedAt: number;
  failedAt: number | null;
  refCount: number;
};

type ParsedCacheEntry = {
  key: string;
  faces: ParsedFontFace[];
  lastUsedAt: number;
};

type UrlCacheRecord = {
  key: string;
  buffer: ArrayBuffer;
  storedAt: number;
  expiresAt: number;
};

export type CreateResttyFontResourceStoreOptions = {
  now?: () => number;
  /** Max in-memory source-byte cache budget across unleased and leased entries. */
  maxSourceCacheBytes?: number;
  /** TTL for persistent URL-byte cache records. */
  urlCacheTtlMs?: number;
  /** Toggle persistent URL-byte cache (IndexedDB). */
  usePersistentUrlCache?: boolean;
  /** Override source loading (used by tests/mocks). */
  loadSourceBuffer?: (source: ResttyFontSource, sourceKey: string) => Promise<ArrayBuffer | null>;
  /** Override parse step (used by tests/mocks). */
  parseBuffer?: (buffer: ArrayBuffer, sourceKey: string) => Promise<ParsedFontFace[]>;
};

const DEFAULT_MAX_SOURCE_CACHE_BYTES = 256 * 1024 * 1024;
const DEFAULT_URL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_SOURCE_RETRY_MS = 5000;
const URL_CACHE_DB_NAME = "restty-font-cache-v1";
const URL_CACHE_STORE_NAME = "url-bytes";

const LOCAL_FONTS_PERMISSION_NAME = "local-fonts";

function nowMs(): number {
  return Date.now();
}

function normalizeUrlKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const base =
      typeof document !== "undefined" && typeof document.baseURI === "string"
        ? document.baseURI
        : undefined;
    return base ? new URL(trimmed, base).href : new URL(trimmed).href;
  } catch {
    return trimmed;
  }
}

function detectStyleHint(value: string): {
  bold: boolean;
  italic: boolean;
  regular: boolean;
  weight: number;
} {
  const text = value.toLowerCase();
  let weight = 400;
  if (/\b(thin|hairline)\b/.test(text)) weight = 100;
  else if (/\b(extra[- ]?light|ultra[- ]?light)\b/.test(text)) weight = 200;
  else if (/\blight\b/.test(text)) weight = 300;
  else if (/\bmedium\b/.test(text)) weight = 500;
  else if (/\b(semi[- ]?bold|demi[- ]?bold)\b/.test(text)) weight = 600;
  else if (/\bbold\b/.test(text)) weight = 700;
  else if (/\b(extra[- ]?bold|ultra[- ]?bold)\b/.test(text)) weight = 800;
  else if (/\b(black|heavy)\b/.test(text)) weight = 900;
  return {
    bold: /\b(bold|semi[- ]?bold|demi[- ]?bold|extra[- ]?bold|black|heavy)\b/.test(text),
    italic: /\b(italic|oblique)\b/.test(text),
    regular: /\b(regular|book|roman|normal)\b/.test(text),
    weight,
  };
}

function resolveFaceLabel(baseLabel: string, face: ParsedFontFace): string {
  if (face.metadataLabel) return `${baseLabel} (${face.metadataLabel})`;
  if (face.index !== undefined) return `${baseLabel} ${face.index}`;
  return baseLabel;
}

function sourceBaseLabel(source: ResttyFontSource, index: number): string {
  if (source.label) return source.label;
  if (source.type === "url") return sourceLabelFromUrl(source.url, index);
  if (source.type === "local") return source.matchers[0] ?? `local-font-${index + 1}`;
  return `font-buffer-${index + 1}`;
}

function getSourceMatchers(source: ResttyFontSource): string[] {
  if (source.type !== "local") return [];
  const normalized: string[] = [];
  for (let i = 0; i < source.matchers.length; i += 1) {
    const matcher = source.matchers[i];
    if (!matcher) continue;
    const next = matcher.trim().toLowerCase();
    if (!next) continue;
    normalized.push(next);
  }
  return normalized;
}

function toSourceBuffer(source: ResttyFontSource): ArrayBuffer | null {
  if (source.type !== "buffer") return null;
  const data = source.data;
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) return sourceBufferFromView(data);
  return null;
}

function createSourceKeyResolver() {
  let nextBufferId = 1;
  const bufferIds = new WeakMap<ArrayBuffer, number>();

  const getBufferId = (buffer: ArrayBuffer): number => {
    const existing = bufferIds.get(buffer);
    if (existing) return existing;
    const assigned = nextBufferId;
    nextBufferId += 1;
    bufferIds.set(buffer, assigned);
    return assigned;
  };

  return (source: ResttyFontSource): string => {
    if (source.type === "url") {
      return `url:${normalizeUrlKey(source.url)}`;
    }
    if (source.type === "local") {
      const matchers = getSourceMatchers(source);
      return `local:${matchers.join("|")}`;
    }
    const data = source.data;
    if (data instanceof ArrayBuffer) {
      return `buffer:${getBufferId(data)}`;
    }
    if (ArrayBuffer.isView(data)) {
      const view = data;
      return `view:${getBufferId(view.buffer)}:${view.byteOffset}:${view.byteLength}`;
    }
    return "buffer:invalid";
  };
}

function createUrlByteCache(
  deps: Pick<
    CreateResttyFontResourceStoreOptions,
    "now" | "urlCacheTtlMs" | "usePersistentUrlCache"
  >,
) {
  const now = deps.now ?? nowMs;
  const ttlMs = deps.urlCacheTtlMs ?? DEFAULT_URL_CACHE_TTL_MS;
  const enabled = deps.usePersistentUrlCache ?? true;
  let dbPromise: Promise<IDBDatabase | null> | null = null;

  const openDb = async (): Promise<IDBDatabase | null> => {
    if (!enabled || typeof indexedDB === "undefined") return null;
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(URL_CACHE_DB_NAME, 1);
        request.addEventListener("upgradeneeded", () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(URL_CACHE_STORE_NAME)) {
            db.createObjectStore(URL_CACHE_STORE_NAME, { keyPath: "key" });
          }
        });
        request.addEventListener("success", () => resolve(request.result));
        request.addEventListener("error", () => resolve(null));
      } catch {
        resolve(null);
      }
    });
    return dbPromise;
  };

  const get = async (key: string): Promise<UrlCacheRecord | null> => {
    const db = await openDb();
    if (!db) return null;
    return await new Promise((resolve) => {
      try {
        const tx = db.transaction(URL_CACHE_STORE_NAME, "readonly");
        const store = tx.objectStore(URL_CACHE_STORE_NAME);
        const request = store.get(key);
        request.addEventListener("success", () => {
          const result = request.result as UrlCacheRecord | undefined;
          if (!result?.buffer) {
            resolve(null);
            return;
          }
          resolve(result);
        });
        request.addEventListener("error", () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  };

  const set = async (key: string, buffer: ArrayBuffer): Promise<void> => {
    const db = await openDb();
    if (!db) return;
    const record: UrlCacheRecord = {
      key,
      buffer,
      storedAt: now(),
      expiresAt: now() + ttlMs,
    };
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(URL_CACHE_STORE_NAME, "readwrite");
        const store = tx.objectStore(URL_CACHE_STORE_NAME);
        const request = store.put(record);
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => resolve());
      } catch {
        resolve();
      }
    });
  };

  const getFresh = async (key: string): Promise<ArrayBuffer | null> => {
    const record = await get(key);
    if (!record) return null;
    if (record.expiresAt <= now()) return null;
    return record.buffer;
  };

  const getStale = async (key: string): Promise<ArrayBuffer | null> => {
    const record = await get(key);
    return record?.buffer ?? null;
  };

  return {
    getFresh,
    getStale,
    set,
  };
}

async function tryLoadLocalFontBuffer(
  matchers: string[],
  label: string,
): Promise<ArrayBuffer | null> {
  const normalizedMatchers = matchers.map((matcher) => matcher.toLowerCase()).filter(Boolean);
  if (!normalizedMatchers.length) return null;

  const globalAccess = globalThis as GlobalWithLocalFontAccess;
  const nav = (globalAccess.navigator ??
    (typeof navigator !== "undefined" ? navigator : undefined)) as NavigatorWithLocalFontAccess;
  if (!nav) return null;
  const queryLocalFonts =
    typeof globalAccess.queryLocalFonts === "function"
      ? globalAccess.queryLocalFonts.bind(globalAccess)
      : typeof nav.queryLocalFonts === "function"
        ? nav.queryLocalFonts.bind(nav)
        : null;
  if (!queryLocalFonts) return null;

  const sourceHint = detectStyleHint(`${label} ${normalizedMatchers.join(" ")}`);
  const queryPermission = nav.permissions?.query;
  if (queryPermission) {
    try {
      const status = await queryPermission({ name: LOCAL_FONTS_PERMISSION_NAME });
      if (status?.state === "denied") return null;
    } catch {
      // no-op
    }
  }

  try {
    const fonts = await queryLocalFonts();
    const matches = fonts.filter((font) => {
      const name =
        `${font.family ?? ""} ${font.fullName ?? ""} ${font.postscriptName ?? ""}`.toLowerCase();
      return normalizedMatchers.some((matcher) => name.includes(matcher));
    });
    if (!matches.length) return null;

    const scoreMatch = (font: LocalFontFaceData): number => {
      const name =
        `${font.family ?? ""} ${font.fullName ?? ""} ${font.postscriptName ?? ""}`.toLowerCase();
      const hint = detectStyleHint(name);
      let score = 0;
      for (let i = 0; i < normalizedMatchers.length; i += 1) {
        if (name.includes(normalizedMatchers[i])) score += 8;
      }
      if (sourceHint.bold || sourceHint.italic) {
        score += sourceHint.bold === hint.bold ? 40 : -40;
        score += sourceHint.italic === hint.italic ? 40 : -40;
      } else {
        score += !hint.bold && !hint.italic ? 60 : -30;
      }
      const targetWeight = sourceHint.bold ? 700 : 400;
      score -= Math.abs((hint.weight ?? 400) - targetWeight) * 0.25;
      if (!sourceHint.bold && hint.weight === 400) score += 12;
      if (!sourceHint.bold && hint.weight < 350) score -= 12;
      if (!sourceHint.bold && hint.weight > 650) score -= 8;
      if (sourceHint.regular && !hint.bold && !hint.italic) score += 20;
      return score;
    };

    let best = matches[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < matches.length; i += 1) {
      const candidate = matches[i];
      const score = scoreMatch(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    const blob = await best.blob();
    return await blob.arrayBuffer();
  } catch {
    return null;
  }
}

async function parseFontFacesFromBuffer(buffer: ArrayBuffer): Promise<ParsedFontFace[]> {
  const { Font } = bundledTextShaper;
  const parsed: ParsedFontFace[] = [];
  const collection = Font.collection ? Font.collection(buffer) : null;
  if (collection) {
    const names = collection.names();
    for (let i = 0; i < names.length; i += 1) {
      const info = names[i];
      try {
        const face = collection.get(info.index);
        parsed.push({
          font: face,
          metadataLabel: info.fullName || info.family || info.postScriptName || undefined,
          index: info.index,
        });
      } catch {
        // keep best-effort parsing for collections with partial failures
      }
    }
    return parsed;
  }

  try {
    const face = await Font.loadAsync(buffer);
    parsed.push({ font: face });
  } catch {
    return [];
  }
  return parsed;
}

export function createResttyFontResourceStore(
  options: CreateResttyFontResourceStoreOptions = {},
): ResttyFontResourceStore {
  const now = options.now ?? nowMs;
  const maxSourceCacheBytes = options.maxSourceCacheBytes ?? DEFAULT_MAX_SOURCE_CACHE_BYTES;
  const resolveSourceKey = createSourceKeyResolver();
  const urlByteCache = createUrlByteCache(options);
  const sourceCache = new Map<string, SourceCacheEntry>();
  const parsedCache = new Map<string, ParsedCacheEntry>();
  const inFlightSourceLoads = new Map<string, Promise<ArrayBuffer | null>>();
  const inFlightParses = new Map<string, Promise<ParsedFontFace[]>>();
  const leaseSources = new Map<number, Map<string, number>>();
  let totalCachedSourceBytes = 0;
  let nextLeaseId = 1;

  const removeSourceEntry = (key: string) => {
    const entry = sourceCache.get(key);
    if (!entry) return;
    totalCachedSourceBytes -= entry.byteLength;
    sourceCache.delete(key);
    parsedCache.delete(key);
  };

  const pruneSourceCache = () => {
    if (totalCachedSourceBytes <= maxSourceCacheBytes) return;
    const evictable = Array.from(sourceCache.values())
      .filter((entry) => entry.refCount === 0)
      .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
    for (let i = 0; i < evictable.length; i += 1) {
      if (totalCachedSourceBytes <= maxSourceCacheBytes) break;
      removeSourceEntry(evictable[i].key);
    }
  };

  const loadUrlBuffer = async (sourceKey: string, url: string): Promise<ArrayBuffer | null> => {
    const freshCached = await urlByteCache.getFresh(sourceKey);
    if (freshCached) return freshCached;

    try {
      const response = await fetch(url);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 0) {
          void urlByteCache.set(sourceKey, buffer.slice(0));
        }
        return buffer;
      }
    } catch {
      // network fallback handled below
    }

    return await urlByteCache.getStale(sourceKey);
  };

  const defaultLoadSourceBuffer = async (
    source: ResttyFontSource,
    sourceKey: string,
  ): Promise<ArrayBuffer | null> => {
    if (source.type === "buffer") {
      return toSourceBuffer(source);
    }
    if (source.type === "local") {
      const matchers = getSourceMatchers(source);
      if (!matchers.length) return null;
      return await tryLoadLocalFontBuffer(
        matchers,
        source.label ?? source.matchers[0] ?? "local-font",
      );
    }
    return await loadUrlBuffer(sourceKey, normalizeUrlKey(source.url));
  };

  const resolveSourceBuffer = options.loadSourceBuffer ?? defaultLoadSourceBuffer;
  const parseBuffer =
    options.parseBuffer ?? (async (buffer: ArrayBuffer) => parseFontFacesFromBuffer(buffer));

  const loadSourceBufferCached = async (
    source: ResttyFontSource,
    sourceKey: string,
  ): Promise<ArrayBuffer | null> => {
    const cached = sourceCache.get(sourceKey);
    if (cached) {
      cached.lastUsedAt = now();
      if (cached.buffer) return cached.buffer;
      if (cached.failedAt !== null && now() - cached.failedAt < FAILED_SOURCE_RETRY_MS) {
        return null;
      }
    }

    const inFlight = inFlightSourceLoads.get(sourceKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
      const loadedAt = now();
      const buffer = await resolveSourceBuffer(source, sourceKey);
      const nextByteLength = buffer?.byteLength ?? 0;
      const current = sourceCache.get(sourceKey);
      if (!current) {
        sourceCache.set(sourceKey, {
          key: sourceKey,
          buffer,
          byteLength: nextByteLength,
          loadedAt,
          lastUsedAt: loadedAt,
          failedAt: buffer ? null : loadedAt,
          refCount: 0,
        });
        totalCachedSourceBytes += nextByteLength;
      } else {
        totalCachedSourceBytes -= current.byteLength;
        current.buffer = buffer;
        current.byteLength = nextByteLength;
        current.loadedAt = loadedAt;
        current.lastUsedAt = loadedAt;
        current.failedAt = buffer ? null : loadedAt;
        totalCachedSourceBytes += nextByteLength;
      }
      parsedCache.delete(sourceKey);
      pruneSourceCache();
      return buffer;
    })().finally(() => {
      inFlightSourceLoads.delete(sourceKey);
    });

    inFlightSourceLoads.set(sourceKey, promise);
    return promise;
  };

  const parseSourceFacesCached = async (
    sourceKey: string,
    buffer: ArrayBuffer,
  ): Promise<ParsedFontFace[]> => {
    const cached = parsedCache.get(sourceKey);
    if (cached) {
      cached.lastUsedAt = now();
      return cached.faces;
    }

    const inFlight = inFlightParses.get(sourceKey);
    if (inFlight) return inFlight;

    const promise = parseBuffer(buffer, sourceKey)
      .then((faces) => {
        parsedCache.set(sourceKey, {
          key: sourceKey,
          faces,
          lastUsedAt: now(),
        });
        return faces;
      })
      .finally(() => {
        inFlightParses.delete(sourceKey);
      });

    inFlightParses.set(sourceKey, promise);
    return promise;
  };

  const releaseLease = (leaseId: number) => {
    const sourceRefs = leaseSources.get(leaseId);
    if (!sourceRefs) return;
    leaseSources.delete(leaseId);
    const releasedAt = now();
    for (const [key, count] of sourceRefs.entries()) {
      const sourceEntry = sourceCache.get(key);
      if (!sourceEntry) continue;
      sourceEntry.refCount = Math.max(0, sourceEntry.refCount - count);
      sourceEntry.lastUsedAt = releasedAt;
    }
    pruneSourceCache();
  };

  const acquire = async (sources: ResttyFontSource[]): Promise<ResttyFontResourceLease> => {
    const faces: ResttyFontResourceFace[] = [];
    const sourceRefs = new Map<string, number>();

    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const source = sources[sourceIndex];
      const sourceKey = resolveSourceKey(source);
      const baseLabel = sourceBaseLabel(source, sourceIndex);
      let buffer: ArrayBuffer | null;
      try {
        buffer = await loadSourceBufferCached(source, sourceKey);
      } catch {
        buffer = null;
      }

      if (!buffer) {
        if (source.type === "local") {
          const prefix = source.required
            ? "required local font missing"
            : "optional local font missing";
          console.warn(`[font] ${prefix} (${source.matchers.join(", ")})`);
        }
        continue;
      }

      let parsedFaces: ParsedFontFace[];
      try {
        parsedFaces = await parseSourceFacesCached(sourceKey, buffer);
      } catch {
        parsedFaces = [];
      }
      if (!parsedFaces.length) continue;

      const sourceEntry = sourceCache.get(sourceKey);
      if (sourceEntry) {
        sourceEntry.refCount += 1;
        sourceEntry.lastUsedAt = now();
      }
      sourceRefs.set(sourceKey, (sourceRefs.get(sourceKey) ?? 0) + 1);

      for (let faceIndex = 0; faceIndex < parsedFaces.length; faceIndex += 1) {
        const parsedFace = parsedFaces[faceIndex];
        faces.push({
          font: parsedFace.font,
          label: resolveFaceLabel(baseLabel, parsedFace),
        });
      }
    }

    const leaseId = nextLeaseId;
    nextLeaseId += 1;
    leaseSources.set(leaseId, sourceRefs);

    let released = false;
    return {
      faces,
      release: () => {
        if (released) return;
        released = true;
        releaseLease(leaseId);
      },
    };
  };

  return {
    acquire,
  };
}

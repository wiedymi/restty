# Font Resource Sharing And Pane Lifetime Design

## Problem Statement

Two issues are happening together:

1. New panes re-fetch and re-parse the same font sources.
2. Closed panes are still retained in memory via long-lived references.

In a recent heap snapshot, the same 18-font set was present 3 times (one copy per pane), with the largest buffer (`Apple Color Emoji`) duplicated three times. Detached pane DOM trees were also still retained through closure/context chains.

## Goals

1. Share font resources per browser tab and reuse them across panes.
2. Prevent closed panes from being retained by internal references.
3. Keep behavior/backward compatibility for existing public APIs where practical.
4. Make ownership and lifetime explicit and testable.

## Non-Goals

1. Sharing GPU atlases across panes/backends. Atlas state stays pane-local.
2. Cross-tab sharing (out of scope; target is per-tab).
3. Changing plugin semantics.

## Root Causes

### A. Per-pane font loading pipeline

Each runtime executes `loadConfiguredFontBuffers()` + `ensureFont()` independently. This duplicates:

- network fetches/local-font queries
- `ArrayBuffer` storage
- parsed `text-shaper` `Font` objects

### B. Pane context retention

Pane option wrappers currently capture the full pane creation context object (including `sourcePane`) inside long-lived callback closures (`beforeInput`, `beforeRenderOutput`, notification callback wrapper). If those wrappers remain reachable, `sourcePane` can keep older panes reachable.

## Target Architecture

### 1) Session-scoped Font Resource Store

Add a session-owned resource store that manages font loading/parsing once per tab/session.

#### New concepts

- `SharedFontResourceStore` (session-level, long-lived)
- `FontSetLease` (runtime-level handle with `release()`)
- `SharedFontFace` (immutable parsed font descriptor)

#### Ownership model

- Store owns parsed font resources and deduplication maps.
- Runtime acquires a `FontSetLease` during `ensureFont()`.
- Runtime releases lease on `destroy()`.
- Pane-local runtime still owns mutable render caches:
  - glyph shape cache
  - bounds cache
  - color glyph text map
  - atlas/glyphIds

#### Key behavior

- Deduplicate in-flight and completed loads for:
  - URL sources
  - local font query sources
  - direct buffers (via buffer identity keying)
- Deduplicate parsed font objects so multiple panes reference the same `Font`.
- Keep source order semantics and fallback behavior unchanged.
- Keep labels stable for UI/debug output.

### 1.1) Multi-layer Cache Strategy (solid cache)

Use layered caches so fonts are not fetched repeatedly.

#### L0: In-flight dedupe (mandatory)

- Scope: session/tab
- Purpose: if multiple panes request same source concurrently, only one fetch/parse runs.
- Structure:
  - `Map<SourceKey, Promise<ArrayBuffer | null>>` for source bytes
  - `Map<ParsedKey, Promise<SharedFontFace[]>>` for parsed faces

#### L1: In-memory resource cache (mandatory)

- Scope: session/tab
- Purpose: reuse loaded bytes and parsed fonts for all panes in tab.
- Structure:
  - source byte cache: `Map<SourceKey, CachedSourceBytes>`
  - parsed font cache: `Map<ParsedKey, CachedParsedFaces>`
- Eviction:
  - refcount-aware (do not evict leased entries)
  - LRU for unleased entries
  - configurable budget (e.g. max bytes / max entries)

#### L2: Persistent byte cache (optional but recommended)

- Scope: browser origin (survives reload)
- Purpose: avoid re-downloading font bytes across page reloads.
- Backend:
  - IndexedDB (primary; store raw `ArrayBuffer` + metadata)
  - optional `CacheStorage` integration for HTTP responses
- Metadata per URL:
  - `etag`, `lastModified`, `cacheControl`, `storedAt`, `expiresAt`
- Revalidation:
  - use conditional requests (`If-None-Match`, `If-Modified-Since`) when metadata exists
  - on `304`, keep cached bytes
  - on `200`, replace bytes/metadata

#### Source-type policy

- `url` source:
  - L0 + L1 + L2
- `local` source:
  - L0 + L1 (no L2; browser local font API results are environment-dependent)
- `buffer` source:
  - L0 + L1 via object identity keying; no L2

#### Cache keys

- URL source: normalized URL string
- Local source: normalized matcher signature
- Buffer source: identity key from WeakMap (`ArrayBuffer`/view identity)
- Parsed key: ordered list of source byte keys + parse mode/version salt

### 2) Minimal Capture Pane Callback Wrappers

In merged pane app options, capture only primitives that are needed by runtime wrappers:

- `paneId` (number)

Do not capture the whole `context` object in long-lived closures.

#### Key behavior

- `beforeInput` / `beforeRenderOutput` wrappers must use `paneId` only.
- Desktop notification wrapper uses `paneId` only.
- `sourcePane` remains available to user `appOptions` execution at creation time, but internal wrappers never retain it.

### 3) Runtime Destroy Hard Cleanup

`destroy()` should aggressively break references to large objects:

- release font lease
- reset/clear font state arrays/maps
- clear configured source arrays and transient promises

This is defensive cleanup, even if GC would eventually reclaim.

## API Design

### Session extension

Extend `ResttyAppSession` with optional font store access:

- `getFontResourceStore?: () => SharedFontResourceStore`

Default session implementation (`getDefaultResttyAppSession`) provides it automatically, so all panes using default session share one store per tab.

Compatibility:

- If a custom session does not implement this method, runtime falls back to an internal per-runtime store (current behavior).

### Internal store interface (proposed)

```ts
type SharedFontResourceStore = {
  acquire(config: FontAcquireConfig): Promise<FontSetLease>;
  release(leaseId: string): void;
  prune?(options?: { maxIdleMs?: number; maxEntries?: number }): void;
};

type FontSetLease = {
  id: string;
  faces: SharedFontFace[];
};

type SharedFontFace = {
  key: string;
  label: string;
  font: Font;
};
```

Notes:

- Store returns immutable shared `Font`.
- Runtime wraps each `SharedFontFace` into pane-local `FontEntry` caches.

## Data Flow

1. Runtime normalizes configured sources.
2. Runtime calls session store `acquire()`.
3. Store resolves buffers and parsed fonts with dedupe.
4. Runtime maps shared faces -> local `FontEntry[]`.
5. Runtime render loop uses local caches/atlas as today.
6. On `destroy()`, runtime clears local caches and releases lease.

## Implementation Plan

### Phase 1: Leak-safe wrappers

1. Refactor merged pane app option wrappers to capture only `paneId`.
2. Add focused regression tests around wrapper behavior and `paneId` correctness.

### Phase 2: Shared font store

1. Implement `SharedFontResourceStore` in runtime/session layer.
2. Extend default session to provide one store singleton.
3. Wire `create-runtime` font init path to use store acquire/release.
4. Keep pane-local font entry caches unchanged.

### Phase 3: Destroy hardening

1. Add explicit teardown of font state and lease release in runtime `destroy()`.
2. Add guards for double-destroy and failed partial init.

### Phase 4: Verification

1. Unit tests:
  - two runtimes in same session fetch same URL font once
  - two runtimes parse same source once
  - leases refcount down to zero on destroy
2. Integration memory check:
  - create/split/close pane loop
  - verify no growth in retained pane objects
3. Snapshot validation:
  - one font set retained for active panes in same session
  - no detached pane chain retained through `sourcePane` via internal wrappers

## Expected Results

1. Font memory drops from `N * font-set-size` to approximately `1 * font-set-size + pane-local caches`.
2. New pane startup avoids repeated font fetch/parse cost.
3. Closed pane objects are eligible for GC once manager/runtime cleanup completes.

## Risks And Mitigations

1. Risk: shared `Font` object thread/usage assumptions.
  - Mitigation: keep only immutable parse data shared; mutable atlas/cache remains per pane.
2. Risk: custom sessions without store lose sharing.
  - Mitigation: fallback behavior preserved; document opt-in method.
3. Risk: key collisions for buffer sources.
  - Mitigation: use object-identity keys via WeakMap for `ArrayBuffer`/views.

## Rollout Strategy

1. Land Phase 1 first (low risk, leak-focused).
2. Land Phase 2 behind internal flag if needed.
3. Enable by default after validation.
4. Keep diagnostics:
  - log store hits/misses in dev builds
  - expose simple stats via debug API when `debugExpose` is enabled.

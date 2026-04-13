# Terminal Search Spec

## Status

- `reference/ghostty` was updated to upstream `main` at `925992abd98d83f08dc367f6b6c6265ee0510e60`.
- `reference/text-shaper` was already current on `origin/main`, so there was no pointer change there.

## Goal

Add terminal search to Restty with these properties:

- Search the active screen and scrollback, not just the visible viewport.
- Keep input/render responsiveness under load.
- Highlight all visible matches and distinguish the selected match.
- Expose enough state for an app-owned search UI without forcing a DOM overlay into core.
- Reuse Ghostty’s architecture where it fits, but adapt it to Restty’s browser/WASM runtime.

## What Ghostty Does

Ghostty splits search into four layers:

1. Surface/app actions start, stop, update, and navigate search.
   Files:
   - `reference/ghostty/src/Surface.zig`
   - `reference/ghostty/src/apprt/action.zig`
   - `reference/ghostty/src/apprt/gtk/class/search_overlay.zig`

2. A dedicated search worker owns incremental search state.
   Files:
   - `reference/ghostty/src/terminal/search.zig`
   - `reference/ghostty/src/terminal/search/Thread.zig`

3. The worker emits two kinds of outputs:
   - renderer-facing visible highlight spans
   - UI-facing metadata such as total matches and selected index

4. The renderer applies search highlights through the existing highlight pipeline rather than a special draw path.
   Files:
   - `reference/ghostty/src/renderer/message.zig`
   - `reference/ghostty/src/renderer/generic.zig`

Important Ghostty detail for Restty: `terminal/search.zig` explicitly notes that the threaded wrapper is unavailable in `libghostty` because of the `xev` dependency. The reusable part is the search model and state split, not the exact worker implementation.

## Restty Constraints

Restty already has most of the rendering seams needed for search highlights:

- Selection overlays are drawn row-by-row in:
  - `src/runtime/create-runtime/render-tick-webgpu-cell-pass.ts`
  - `src/runtime/create-runtime/render-tick-webgl-scene.ts`
- Rect batch ordering is already centralized in:
  - `src/runtime/create-runtime/render-tick-webgpu-draw-pass.ts`
  - `src/runtime/create-runtime/render-tick-webgl-glyph-pipeline.ts`
- Interaction state already owns transient UI/runtime state in:
  - `src/runtime/create-runtime/interaction-runtime.ts`
- The public runtime API is assembled in:
  - `src/runtime/create-runtime/runtime-api.ts`

The missing piece is data ownership:

- JS can read the current render snapshot from WASM through `RenderState`.
- JS cannot query the full scrollback text model.
- Full-history search in pure JS would require maintaining a second terminal-text mirror beside the Ghostty terminal core, which is the wrong source of truth.

Conclusion:

- Viewport-only search could be implemented in JS as a temporary feature.
- Real terminal search should live in the Zig/WASM side and expose search results back to JS.

## Recommended Architecture

Use Ghostty’s separation of concerns, but replace the native thread with a cooperative search engine stepped from JS.

### 1. Search engine lives in `wasm/src/restty.zig`

Add a `ResttySearch` state owned by each `Restty` handle.

Responsibilities:

- Store the active needle and search options.
- Search primary and alternate screens plus scrollback through Ghostty terminal structures.
- Maintain:
  - total match count for the active screen
  - selected match index
  - selected match location
  - visible viewport highlight spans
- Progress incrementally across calls instead of blocking a single frame.

Why this design:

- It keeps scrollback access in the terminal core where the data already exists.
- It avoids duplicating the terminal text model in JS.
- It matches Ghostty’s `ViewportSearch` + `ScreenSearch` split, but without requiring threads in the browser build.

### 2. JS runtime owns scheduling and UI state

Add a small runtime search controller in `src/runtime/create-runtime/`, for example:

- `search-runtime.ts`
- `search-runtime.types.ts`

Responsibilities:

- Start, stop, and update the search query.
- Call into WASM to step search work with a small time or work budget.
- Mark the renderer dirty when search highlights or selected match change.
- Expose metadata to app code:
  - active query
  - total matches
  - selected match number
  - pending / complete state

This is the direct analogue of Ghostty’s mailbox + worker wakeup loop, but scheduled through `requestAnimationFrame` or `requestIdleCallback` instead of a native thread.

### 3. Renderer consumes explicit search spans

Do not invent a new text rendering mode.

Instead:

- extend the render input with per-row search spans for the visible viewport
- paint search matches as another rectangle batch, like selection
- keep a separate color for:
  - non-selected matches
  - selected match

Restty’s current render order is:

- backgrounds
- selection rects
- decorations
- glyphs
- cursor / overlay rects / overlay glyphs

The safest addition is:

- backgrounds
- search rects
- selection rects
- decorations
- glyphs

This preserves selection precedence over search, which matches Ghostty’s behavior.

## Proposed WASM ABI

Add cooperative search exports to the wrapper.

Suggested shape:

- `restty_search_set_query(handle, ptr, len) -> u32`
- `restty_search_clear(handle) -> u32`
- `restty_search_step(handle, budget) -> u32`
- `restty_search_status_ptr(handle) -> usize`
- `restty_search_viewport_match_count(handle) -> u32`
- `restty_search_viewport_matches_ptr(handle) -> usize`
- `restty_search_select_next(handle) -> u32`
- `restty_search_select_prev(handle) -> u32`
- `restty_search_select_index(handle, index) -> u32`

Suggested status payload:

- `active: u8`
- `pending: u8`
- `complete: u8`
- `generation: u32`
- `total_matches: u32`
- `selected_index: i32`

Suggested viewport match payload:

- one entry per visible row-span intersection
- fields:
  - `row: u16`
  - `start_col: u16`
  - `end_col: u16`
  - `selected: u8`

Keep the viewport result format flat and renderer-friendly. Do not expose internal Ghostty page/search structures directly.

## Proposed Restty Runtime API

Extend `ResttyRuntime` in `src/runtime/types.ts` with search methods:

- `setSearchQuery(query: string): void`
- `clearSearch(): void`
- `searchNext(): void`
- `searchPrevious(): void`
- `getSearchState(): ResttySearchState`

Add optional callbacks:

- `onSearchState?(state: ResttySearchState): void`

Suggested JS type:

```ts
export type ResttySearchState = {
  query: string;
  active: boolean;
  pending: boolean;
  complete: boolean;
  total: number;
  selectedIndex: number | null;
};
```

Keep UI out of core. A consumer can bind these APIs to a custom search bar, command palette, or pane chrome.

## Runtime Integration Plan

### Phase 1: search runtime state

Files:

- `src/runtime/create-runtime/runtime-api.ts`
- `src/runtime/create-runtime.ts`
- new `src/runtime/create-runtime/search-runtime.ts`

Work:

- create search controller state alongside selection/IME state
- wire public API methods
- schedule search stepping while `pending === true`
- mark `needsRender` when generation or metadata changes

### Phase 2: ABI plumbing

Files:

- `wasm/src/restty.zig`
- `src/wasm/runtime/types.ts`
- `src/wasm/runtime/abi.ts`
- `src/wasm/runtime/render-state.ts` if search viewport data is folded into render reads

Work:

- add exported functions and typed-array decoding
- cache search status and visible match spans
- ensure buffers remain stable until the next `restty_search_step` or `restty_render_update`

### Phase 3: renderer support

Files:

- `src/renderer/types.ts`
- `src/runtime/create-runtime/render-tick-webgpu.types.ts`
- `src/runtime/create-runtime/render-tick-webgpu-cell-pass.ts`
- `src/runtime/create-runtime/render-tick-webgl-scene.ts`
- `src/runtime/create-runtime/render-tick-webgpu-draw-pass.ts`
- `src/runtime/create-runtime/render-tick-webgl-glyph-pipeline.ts`

Work:

- add `searchData` and `searchSelectedData` rectangle batches, or a single batch with per-rect color
- push rects for visible match spans before selection rects
- keep selected match visually distinct

Recommended color config additions:

- `searchColor`
- `searchSelectedColor`

Do not reuse `selectionColor`. Search and selection need distinct semantics and precedence.

### Phase 4: theme support

Files:

- `src/theme/ghostty.ts`
- `src/runtime/create-runtime/lifecycle-theme-size-theme.ts`
- `src/renderer/types.ts`

Work:

- parse and store:
  - `search-background`
  - `search-foreground`
  - `search-selected-background`
  - `search-selected-foreground`

For first implementation, only backgrounds are required. Foreground overrides can be deferred if search rects sit behind glyphs as they do today.

### Phase 5: optional built-in UI

Only after core search works.

Possible locations:

- surface-level pane chrome in `src/surface/`
- playground-only UI in `playground/`

Recommendation:

- ship core API first
- add built-in UI only if Restty wants a canonical search affordance

## Search Semantics

Match behavior for v1:

- case-insensitive ASCII by default, matching Ghostty’s current behavior
- literal substring search only
- search active screen and scrollback
- selected result navigation wraps
- clearing the query clears highlights and metadata immediately

Defer for later:

- regex
- whole-word
- case-sensitive toggle
- foreground recoloring for matches
- cross-pane/global search

## Performance Rules

- Never scan the full history in one JS task.
- `restty_search_step` must accept a bounded budget.
- Each step should do limited work and return whether more work remains.
- JS should only keep stepping while:
  - search is active
  - search is pending
  - the app is not destroyed

Recommended scheduler:

- primary: advance a few search steps during frames while pending
- optional: use `requestIdleCallback` when available for faster completion without hurting frame time

## Testing Plan

### Zig / ABI tests

- query set / clear lifecycle
- viewport-only matches for visible rows
- full scrollback total counts
- next/previous wrapping
- selected match moves viewport when needed

### TypeScript tests

- public API updates `ResttySearchState`
- renderer receives visible spans and paints them in the right order
- clearing search removes highlight buffers
- theme parsing reads new Ghostty search colors

Suggested test files:

- `tests/search-runtime.test.ts`
- `tests/search-render-order.test.ts`
- `tests/theme-search-colors.test.ts`
- `tests/wasm-search-abi.test.ts`

## Recommended Delivery Sequence

1. Add WASM-side cooperative search state and ABI.
2. Add runtime search controller and public API.
3. Add renderer highlight batches for visible matches.
4. Add tests for search lifecycle and render ordering.
5. Add theme color support.
6. Add optional UI in the playground or pane layer.

## Explicit Non-Goals For The First Cut

- Porting Ghostty’s native search thread exactly.
- Maintaining a duplicate JS scrollback text mirror.
- Adding search UI directly into the renderer canvas.
- Implementing regex or advanced search filters before literal search is stable.

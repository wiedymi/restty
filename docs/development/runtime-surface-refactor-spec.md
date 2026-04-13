# Runtime and Surface Refactor Spec

Status: proposed

## Summary

This spec defines a refactor of the high-level `restty` architecture without changing the top-level domain names:

- `runtime` remains the single-terminal runtime boundary.
- `surface` remains the multi-pane and shell orchestration boundary.

The refactor focuses on four problems:

1. Public and internal option types are too broad and too flat.
2. Public API names do not clearly communicate responsibility.
3. `surface` and `runtime` boundaries are not explicit enough in code and exports.
4. The playground is over-coupled to internal modules and has grown into a single large script.

This spec does not propose a renderer rewrite, a WASM rewrite, or a behavior change to terminal rendering. It is a structure, naming, and ergonomics refactor.

## Goals

- Preserve `runtime` and `surface` as the architectural names.
- Make the public API feel intentionally designed rather than inherited from internal manager/runtime types.
- Separate terminal behavior config from mount and services without inventing a second config vocabulary.
- Reduce the amount of unstable API that leaks through `restty/internal`.
- Make the playground consume the same public API that users consume.
- Move the playground to a component-based UI architecture.
- Introduce a clearer runtime boundary, lifecycle model, and event flow.
- Improve repo hygiene so generated playground output and forbidden imports stop eroding boundaries.

## Non-goals

- Rename low-level domains such as `renderer`, `fonts`, `pty`, `theme`, or `wasm`.
- Change the default rendering backend strategy.
- Remove advanced capabilities such as plugins, shader stages, or pane search.
- Preserve old high-level option/type names indefinitely.

## Current Pain Points

### 1. Public options are inherited from internal contracts

The current `ResttyOptions` is effectively a modified pane-manager config instead of a dedicated public API contract. This makes the top-level constructor feel like a direct passthrough to `surface` internals.

### 2. Runtime options are too broad

The current runtime config mixes mount requirements, rendering options, fonts, PTY transport, interaction settings, callbacks, hooks, and scrollback tuning in one flat shape. This makes the type harder to read, harder to document, and easier to misuse.

### 3. Naming is too generic

Names such as `ResttyOptions` and `ResttyAppOptions` are not descriptive enough. They rely on the reader already knowing that `Restty` means the surface shell and `ResttyApp` means one terminal runtime.

### 4. `internal` is too broad

`restty/internal` currently acts as a second product API. It exposes too much of the implementation graph and makes it easy for internal consumers to bypass stable boundaries.

### 5. Playground depends on internals

The current playground imports directly from `../src/internal.ts` and manipulates raw managed panes. That means the playground is not validating the stable public API surface.

### 6. Docs and surface drift

The documentation describes some convenience methods on `Restty` that are not actually exposed on the active-pane convenience API. This is a symptom of the public surface not being explicitly curated.

## Architecture Decisions

### 1. Keep `runtime` and `surface`

The existing top-level names are correct and remain in place:

- `runtime`: one mounted terminal instance
- `surface`: shell, pane system, search UI, plugin coordination, shared surface ergonomics

The refactor will sharpen the boundary rather than rename it.

### 2. Make dependency direction explicit

The allowed dependency direction is:

- low-level domains (`renderer`, `fonts`, `pty`, `theme`, `wasm`, `selection`, `ime`, `grid`, `unicode`, `utils`) do not depend on `runtime` or `surface`
- `runtime` may depend on low-level domains
- `surface` may depend on `runtime` and low-level domains
- package entrypoints may depend on any public boundary
- `runtime` must not re-export `surface`

This rule removes the current back-edge where runtime-level modules export surface concerns.

### 3. Distinguish public config from runtime config

The public constructor config and the single-runtime config must become distinct concepts.

The goal is not to create a second translated config model. The goal is to make public API, `surface`, and `runtime` use one shared vocabulary and one mostly aligned config structure.

### New naming

Preferred names:

- `ResttyOptions` -> `ResttyConfig`
- `ResttyAppOptions` -> `ResttyRuntimeConfig`
- `ResttyPaneAppOptionsInput` -> `ResttyTerminalConfig`

Optional internal follow-up:

- `ResttyApp` -> `ResttyRuntime`
- `createResttyApp(...)` -> `createResttyRuntime(...)`

Migration policy:

- old high-level option/type names are removed rather than aliased
- documentation and playground code switch to the new names immediately
- internal code should not carry compatibility adapters for renamed public fields

### 4. Public config should be grouped by responsibility

The public config should stop being a flat internal passthrough. The target shape is:

```ts
export type ResttyConfig = {
  root: HTMLElement;
  surface?: ResttySurfaceConfig;
  terminal?: ResttyTerminalConfig;
  services?: ResttyServicesConfig;
};
```

```ts
export type ResttySurfaceConfig = {
  createInitialPane?: boolean | { focus?: boolean };
  minPaneSize?: number;
  paneStyles?: boolean | ResttyManagedPaneStylesOptions;
  searchUi?: boolean | ResttyManagedPaneSearchUiOptions;
  shortcuts?: boolean | ResttyPaneShortcutsOptions;
  contextMenu?: ResttyPaneContextMenuOptions<ResttyManagedAppPane> | null;
  defaultContextMenu?: boolean | ResttyDefaultPaneContextMenuOptions;
  events?: ResttySurfaceEvents;
  plugins?: ResttyPluginConfig;
};
```

```ts
export type ResttyTerminalConfig = {
  renderer?: "auto" | "webgpu" | "webgl2";
  fontSize?: number;
  ligatures?: boolean;
  fontHinting?: boolean;
  fontHintTarget?: ResttyFontHintTarget;
  fontPreset?: ResttyFontPreset;
  fontSources?: ResttyFontSource[];
  shaderStages?: ResttyShaderStage[];
  alphaBlending?: "native" | "linear" | "linear-corrected";
  maxScrollbackBytes?: number;
};
```

```ts
export type ResttyServicesConfig = {
  ptyTransport?: PtyTransport;
};
```

```ts
export type ResttySurfaceEvents = {
  onPaneCreated?: (pane: ResttyManagedAppPane) => void;
  onPaneClosed?: (pane: ResttyManagedAppPane) => void;
  onPaneSplit?: (
    sourcePane: ResttyManagedAppPane,
    createdPane: ResttyManagedAppPane,
    direction: "vertical" | "horizontal",
  ) => void;
  onActivePaneChange?: (pane: ResttyManagedAppPane | null) => void;
  onLayoutChanged?: () => void;
  onDesktopNotification?: (notification: DesktopNotification & { paneId: number }) => void;
};
```

```ts
export type ResttyPluginConfig = {
  manifest?: ReadonlyArray<ResttyPluginManifestEntry>;
  registry?: ResttyPluginRegistry;
};
```

Notes:

- `terminal` replaces `appOptions` in the high-level public API
- the top-level constructor should describe user intent, not runtime internals
- `surface` owns shell behavior, plugin wiring, and surface-level events
- `services` is an advanced escape hatch for external runtime dependencies
- public and internal config should use the same nouns wherever possible
- avoid multi-form high-level config unless there is a strong need for it

### 5. Unify public and internal config vocabulary

The current codebase uses too many overlapping config concepts:

- `ResttyOptions`
- `CreateResttyAppPaneManagerOptions`
- `ResttyPaneAppOptionsInput`
- `ResttyAppOptions`

The refactor should converge these into one shared vocabulary:

- `ResttyConfig`
- `ResttySurfaceConfig`
- `ResttyTerminalConfig`
- `ResttyRuntimeConfig`

Intended relationship:

- `ResttyConfig` is the top-level shell config
- `ResttySurfaceConfig` describes shell and pane-system behavior, plugins, and surface events
- `ResttyTerminalConfig` describes terminal behavior that should be applied to each pane runtime
- `ResttyServicesConfig` describes external services that support the runtime without changing terminal behavior
- `ResttyRuntimeConfig` is `ResttyTerminalConfig` plus mount/services requirements such as `canvas`, `imeInput`, `session`, and PTY transport

Rule:

- `surface` should pass terminal config through to `runtime`
- `surface` may inject mount/session/service wiring
- `surface` should not invent a second parallel runtime option vocabulary
- avoid patterns like `Omit<ResttyAppOptions, ...>` as the core public/internal bridge

Preferred construction model:

```ts
createResttyRuntime({
  mount: {
    canvas,
    imeInput,
    session,
  },
  terminal,
  services: {
    ptyTransport,
  },
});
```

This keeps the public and internal models aligned. The only runtime-only additions are mount and service context.

### 6. Runtime config should also be grouped

The runtime config remains more detailed than the surface config, but it should still be grouped by responsibility.

Target shape:

```ts
export type ResttyRuntimeConfig = {
  mount: ResttyRuntimeMountConfig;
  terminal: ResttyTerminalConfig;
  services?: ResttyRuntimeServicesConfig;
};
```

```ts
export type ResttyRuntimeMountConfig = {
  canvas: HTMLCanvasElement;
  imeInput?: HTMLTextAreaElement | null;
  session?: ResttyAppSession;
};
```

```ts
export type ResttyRuntimeServicesConfig = {
  ptyTransport?: PtyTransport;
  callbacks?: ResttyAppCallbacks;
  beforeInput?: (payload: ResttyAppInputPayload) => string | null | void;
  beforeRenderOutput?: (payload: ResttyAppInputPayload) => string | null | void;
};
```

Implementation rule:

- runtime may apply defaults once at creation time
- runtime should not depend on a separate translated config vocabulary
- terminal config stays behavior-only; services and mount concerns stay out of it
- if a field requires heavy interpretation, redesign the field rather than adding more config-shape conversion

### 7. Runtime boundary must be explicit

`surface` should not depend on the current broad `ResttyApp` shape directly. It should depend on a narrower, capability-grouped runtime contract.

Preferred runtime lifecycle:

```ts
export type ResttyRuntimeState = "created" | "initializing" | "ready" | "failed" | "destroyed";
```

Preferred runtime event union:

```ts
export type ResttyRuntimeEvent =
  | { type: "state"; state: ResttyRuntimeState }
  | { type: "backend"; backend: string }
  | { type: "pty-status"; status: string }
  | { type: "search-state"; state: ResttySearchState };
```

Preferred runtime interface:

```ts
export type ResttyRuntime = {
  lifecycle: {
    init: () => Promise<void>;
    destroy: () => void;
    state: () => ResttyRuntimeState;
  };
  events: {
    subscribe: (listener: (event: ResttyRuntimeEvent) => void) => () => void;
  };
  terminal: {
    setRenderer: (value: "auto" | "webgpu" | "webgl2") => void;
    setPaused: (value: boolean) => void;
    togglePause: () => void;
    setFontSize: (value: number) => void;
    setLigatures: (value: boolean) => void;
    setFontHinting: (value: boolean) => void;
    setFontHintTarget: (value: ResttyFontHintTarget) => void;
    setFontSources: (sources: ResttyFontSource[]) => Promise<void>;
    applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
    resetTheme: () => void;
    clearScreen: () => void;
  };
  io: {
    sendInput: (text: string, source?: string) => void;
    sendKeyInput: (text: string, source?: string) => void;
    connectPty: (url?: string) => void;
    disconnectPty: () => void;
    isPtyConnected: () => boolean;
  };
  interaction: {
    focus: () => void;
    blur: () => void;
    resize: (cols: number, rows: number) => void;
    updateSize: (force?: boolean) => void;
    setMouseMode: (value: MouseMode) => void;
    getMouseStatus: () => ReturnType<InputHandler["getMouseStatus"]>;
    copySelectionToClipboard: () => Promise<boolean>;
    pasteFromClipboard: () => Promise<boolean>;
    selectWordAtClientPoint: (clientX: number, clientY: number) => boolean;
  };
  search: {
    setQuery: (query: string) => void;
    clear: () => void;
    next: () => void;
    previous: () => void;
    getState: () => ResttySearchState;
  };
  render: {
    getBackend: () => string;
    setShaderStages: (stages: ResttyShaderStage[]) => void;
    getShaderStages: () => ResttyShaderStage[];
  };
};
```

Rules:

- `surface` depends on `ResttyRuntime` and `createResttyRuntime(...)`, not on concrete runtime implementation files
- runtime capabilities may be implemented by many files, but they are exposed through one explicit boundary
- lifecycle and event flow are part of the runtime contract, not incidental side effects

### 8. Public API must be curated, not inferred

The stable public surface is:

- `new Restty(...)`
- `createRestty(...)`
- `ResttyPaneHandle`
- theme helpers
- plugin types and plugin APIs
- intentionally selected pane/surface methods

Public stable pane access should favor:

- `panes()`
- `pane(id)`
- `activePane()`
- `focusedPane()`

Legacy/raw accessors may remain temporarily but should be marked for deprecation:

- `getPanes()`
- `getPaneById()`
- `getActivePane()`
- `getFocusedPane()`

`getRawPane()` should not be presented as part of the stable ergonomic API. If it remains, it should be explicitly marked unstable.

### 9. Active-pane convenience API remains, but becomes explicit

The active-pane convenience surface is valuable and should remain. However, it should be explicitly defined and complete.

Preferred shared pane-scoped terminal contract:

```ts
export type ResttyPaneTerminalApi = {
  setRenderer: (value: "auto" | "webgpu" | "webgl2") => void;
  setPaused: (value: boolean) => void;
  togglePause: () => void;
  setFontSize: (value: number) => void;
  setLigatures: (value: boolean) => void;
  setFontHinting: (value: boolean) => void;
  setFontHintTarget: (value: ResttyFontHintTarget) => void;
  setFontSources: (sources: ResttyFontSource[]) => Promise<void>;
  applyTheme: (theme: GhosttyTheme, sourceLabel?: string) => void;
  resetTheme: () => void;
  sendInput: (text: string, source?: string) => void;
  sendKeyInput: (text: string, source?: string) => void;
  clearScreen: () => void;
  connectPty: (url?: string) => void;
  disconnectPty: () => void;
  isPtyConnected: () => boolean;
  setMouseMode: (value: MouseMode) => void;
  getMouseStatus: () => ReturnType<InputHandler["getMouseStatus"]>;
  copySelectionToClipboard: () => Promise<boolean>;
  pasteFromClipboard: () => Promise<boolean>;
  selectWordAtClientPoint: (clientX: number, clientY: number) => boolean;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  searchNext: () => void;
  searchPrevious: () => void;
  getSearchState: () => ResttySearchState;
  openSearch: (options?: ResttyPaneSearchUiOpenOptions) => void;
  closeSearch: (options?: ResttyPaneSearchUiCloseOptions) => void;
  toggleSearch: (options?: ResttyPaneSearchUiOpenOptions & ResttyPaneSearchUiCloseOptions) => void;
  isSearchOpen: () => boolean;
  getSearchUiStyleOptions: () => Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>>;
  setSearchUiStyleOptions: (options: ResttyManagedPaneSearchUiStyleOptions) => void;
  updateSize: (force?: boolean) => void;
  getBackend: () => string;
  setShaderStages: (stages: ResttyShaderStage[]) => void;
  getShaderStages: () => ResttyShaderStage[];
};
```

Spec decision:

- `Restty` active-pane convenience methods should implement `ResttyPaneTerminalApi`
- `ResttyPaneHandle` should extend `ResttyPaneTerminalApi` with pane-targeted methods such as `id`, `resize`, `focus`, and `blur`
- `getRawPane()` is not part of the stable ergonomic API

Implementation note:

- prefer composition over inheritance internally, even if the exported shape remains the same
- `Restty` should coordinate an active-pane controller rather than accumulate every convenience method directly

### 10. Narrow `restty/internal`, but keep it useful for hackable users

`restty/internal` remains allowed as an unstable power-user surface, but it becomes curated rather than exhaustive. The goal is to support hackable users without letting accidental implementation details become permanent API.

Rules:

- no re-export of the full implementation graph by default
- no export of `surface` internals that are only used by the playground
- no export of helper modules whose only consumers are runtime implementation files

Preferred shape:

- keep `restty/internal` as a small unstable barrel
- prefer narrower unstable subpaths for focused power-user access
- document clearly that `restty/internal` is not covered by normal public API stability expectations

Preferred unstable subpaths:

- `restty/internal/runtime`
- `restty/internal/surface`
- `restty/internal/plugins`

Preferred `internal` exports for power users:

- `createResttyRuntime`
- `ResttyRuntime`
- `ResttyRuntimeConfig`
- `ResttyRuntimeState`
- `ResttyRuntimeEvent`
- session and shared resource primitives
- surface building blocks for custom shells
- plugin host/runtime primitives

## Module Layout

The target layout keeps `runtime` and `surface`, but introduces tighter internal grouping.

```txt
src/
  surface/
    restty/
      restty.ts
      active-pane-controller.ts
      pane-handles.ts
      plugin-host.ts
      shader-stage-registry.ts
      surface-config.ts
      surface-events.ts
    panes/
      manager.ts
      layout.ts
      interactions.ts
      context-menu.ts
      window-events.ts
    search-ui/
      controller.ts
      styles.ts
      view.ts
    types.ts

  runtime/
    core/
      create-runtime.ts
      runtime.ts
      lifecycle.ts
      runtime-events.ts
      runtime-config.ts
      session.ts
    render/
      render-ticks.ts
      render-tick-webgpu.ts
      render-tick-webgl.ts
      shader-stage-runtime.ts
      kitty-render-runtime.ts
    interaction/
      interaction-runtime.ts
      bind-ime-events.ts
      bind-pointer-events.ts
      scrollbar-runtime.ts
    fonts/
      font-resource-store.ts
      font-sources.ts
      atlas-builder.ts
      font-runtime-helpers.ts
    io/
      pty-input-runtime.ts
      pty-output-buffer.ts
      clipboard-paste.ts
      input-hooks.ts
    search/
      search-runtime.ts
      search-highlight-utils.ts
    telemetry/
      runtime-reporting.ts
```

Notes:

- this is an organizational target, not a requirement for one atomic change
- current filenames can be moved gradually as long as imports stay coherent

## Current File Placement Audit

The following files are the clearest candidates for relocation or splitting based on current size, mixed responsibilities, or awkward placement.

### Surface

- `src/surface/pane-search-ui.ts`
  Split into `surface/search-ui/`.
  Current file mixes config types, controller state, DOM construction, style injection, keyboard shortcut behavior, and UI update logic.
  Target:
  - `surface/search-ui/types.ts`
  - `surface/search-ui/controller.ts`
  - `surface/search-ui/dom.ts`
  - `surface/search-ui/styles.ts`
  - `surface/search-ui/shortcuts.ts`

- `src/surface/pane-app-manager.ts`
  Keep the concept, but split the file.
  Current file owns types, DOM element creation, context-menu defaults, search UI wiring, pane-manager composition, and app creation.
  It should also stop defining the public/internal bridge through `Omit<ResttyAppOptions, ...>`.
  Target:
  - `surface/panes/app-pane-manager.ts`
  - `surface/panes/managed-pane-dom.ts`
  - `surface/panes/managed-pane-types.ts`
  - `surface/panes/terminal-config.ts`

- `src/surface/plugins/runtime.ts`
- `src/surface/plugins/types.ts`
- `src/surface/plugins/utils.ts`
- `src/surface/plugins/dispatcher.ts`
- `src/surface/plugins/host.ts`
  Consolidate under a single `surface/plugins/` area.
  The current split is half at the `surface/` root and half under `surface/restty/`, which makes ownership harder to read.
  Target:
  - `surface/plugins/types.ts`
  - `surface/plugins/runtime.ts`
  - `surface/plugins/utils.ts`
  - `surface/plugins/dispatcher.ts`
  - `surface/plugins/host.ts`

- `src/surface/panes-context-menu.ts`
- `src/surface/panes-styles.ts`
  Move under `surface/panes/`.
  These are pane-system concerns and should live next to `manager.ts`, `layout.ts`, and `pane-interactions.ts`.
  Target:
  - `surface/panes/context-menu.ts`
  - `surface/panes/styles.ts`

- `src/surface/restty.ts`
  Keep the public entrypoint, but reduce internal responsibility.
  It should compose smaller units rather than carry all coordination directly.
  Target supporting files:
  - `surface/restty/surface-config.ts`
  - `surface/restty/terminal-runtime-config.ts`
  - `surface/restty/active-pane-controller.ts`
  - `surface/restty/surface-events.ts`

- `src/surface/restty/pane-ops.ts`
  Split by operation category once the public API rename work lands.
  The file is large enough that create/close/split/focus/connect behavior should not stay in one place indefinitely.
  Possible target split:
  - `surface/restty/pane-layout-ops.ts`
  - `surface/restty/pane-focus-ops.ts`
  - `surface/restty/pane-pty-ops.ts`

### Runtime

- `src/runtime/create-runtime.ts`
  Keep it as the runtime composition root only.
  The current file is too large and still carries too much direct implementation state even after helper extraction.
  Rule:
  - `create-runtime.ts` should only compose subsystems and expose the runtime API
  - implementation helpers should live in subfolders

- `src/runtime/create-app-symbols.ts`
  Split immediately.
  This file currently mixes symbol-constraint policy with touch-selection config behavior.
  Target:
  - `runtime/fonts/symbol-constraints.ts`
  - `runtime/interaction/touch-selection.ts`

- `src/runtime/create-app-io-utils.ts`
  Split by domain.
  It currently mixes URL opening, font-source labeling, buffer conversion, newline normalization, and text-tail fitting.
  Target:
  - `runtime/io/external-links.ts`
  - `runtime/fonts/source-labels.ts`
  - `utils/array-buffer.ts`
  - `runtime/text/line-endings.ts`
  - `runtime/text/text-measurement.ts`

- `src/runtime/render-stage-runtime.ts`
- `src/runtime/render-stage-shaders.ts`
- `src/runtime/shader-stages.ts`
  Consolidate under `runtime/render/stages/`.
  These are one subsystem and should not be split across generic runtime root filenames.
  Target:
  - `runtime/render/stages/runtime.ts`
  - `runtime/render/stages/shaders.ts`
  - `runtime/render/stages/config.ts`

- `src/runtime/atlas-builder.ts`
- `src/runtime/font-resource-store.ts`
- `src/runtime/font-sources.ts`
  Move under `runtime/fonts/`.
  These are font/runtime resource concerns, not generic runtime root files.
  Target:
  - `runtime/fonts/atlas-builder.ts`
  - `runtime/fonts/resource-store.ts`
  - `runtime/fonts/font-sources.ts`

- `src/runtime/session.ts`
  Move under `runtime/core/`.
  Session creation is part of runtime bootstrapping, not a peer to atlas/font helper modules.

- `src/runtime/render-color-utils.ts`
- `src/runtime/text-decoration.ts`
  Move under `runtime/render/`.
  They are rendering helpers, not generic runtime helpers.

- `src/runtime/overlay-scrollbar.ts`
- `src/runtime/create-runtime/native-scrollbar-host.ts`
  Consolidate under `runtime/interaction/scrollbar/`.
  Scrollbar behavior is currently split between root runtime and create-runtime internals.

- `src/runtime/types.ts`
  Split over time.
  It currently holds session, callbacks, font-source types, shader-stage types, runtime config, and runtime API.
  Target:
  - `runtime/core/types.ts`
  - `runtime/core/config.ts`
  - `runtime/core/runtime.ts`
  - `runtime/core/runtime-events.ts`
  - `runtime/core/lifecycle.ts`
  - `runtime/fonts/types.ts`
  - `runtime/render/stages/types.ts`

### Files that are large but not obviously misplaced

- `src/runtime/create-runtime/runtime-app-api.ts`
  Likely belongs under `runtime/core/` or `runtime/api/`, but it is primarily a naming and extraction problem rather than a wrong-boundary problem.

- `src/runtime/create-runtime/render-tick-webgpu-cell-pass.ts`
- `src/runtime/create-runtime/render-tick-webgl-glyph-pipeline.ts`
- `src/runtime/create-runtime/render-tick-webgl-context.ts`
  These are large, but they are already inside the right subsystem. Priority is internal extraction, not relocation.

- `src/surface/panes/manager.ts`
  Large but correctly placed. Split only if the pane-system refactor starts causing cognitive load in this file.

## Foundational Improvements

These changes are structural and should guide implementation choices even when a specific phase is focused on naming or file movement.

### 1. Introduce explicit lifecycle and state for one runtime

Runtime lifecycle is currently implied by method availability and setup order. That makes error handling, re-init, and playground integration harder than necessary.

Spec direction:

- define an explicit runtime lifecycle model such as `created -> initializing -> ready -> destroyed`
- expose lifecycle transitions through the runtime boundary rather than relying on scattered callback timing
- make invalid state transitions explicit so runtime teardown and re-creation logic become easier to reason about

This does not require a complex state machine framework. It does require a first-class state model.

### 2. Separate config from services

`terminal` config should describe terminal behavior only. It should not carry service wiring or DOM ownership.

Spec direction:

- keep `ResttyTerminalConfig` focused on behavior such as renderer selection, font behavior, shader stages, and scrollback policy
- move `ptyTransport`, callbacks, optional status DOM, session, canvas, and IME into service or mount concerns
- keep service types small and explicit rather than letting them grow into another generic options bag

This is the main guardrail that prevents the new naming from collapsing back into another broad catch-all config type.

### 3. Define a real runtime boundary type

`surface` should depend on a stable runtime contract, not concrete implementation details from the runtime composition root.

Spec direction:

- define a `ResttyRuntime` interface owned by `runtime/core`
- define `createResttyRuntime(...)` as the single runtime factory entrypoint
- make `surface` depend on the interface and factory rather than reaching into concrete runtime implementation modules

This gives the repo a clear seam for testing, playground integration, and future runtime internal refactors.

### 4. Split runtime API by capability

The runtime can still expose one object externally, but internally it should not be organized as one giant bag of methods and mutable state.

Spec direction:

- separate runtime capabilities into focused groups such as rendering, input, search, PTY, theme, and lifecycle
- keep cross-capability wiring in the runtime composition root rather than burying it inside one wide API file
- prefer capability ownership over convenience dumping grounds

This will make `create-runtime.ts` smaller and reduce the pressure to keep adding helpers next to whichever file is already large.

### 5. Make event flow first-class

A large part of the current coordination is callback-driven and distributed across unrelated modules.

Spec direction:

- define a clearer event model for pane creation, focus changes, PTY state, search state, and plugin hooks
- route internal coordination through explicit runtime/surface events where it improves readability
- keep event ownership close to the subsystem that emits the event

This complements the runtime lifecycle work and should reduce hidden ordering assumptions.

### 6. Move DOM-specific concerns out of runtime core

Runtime should understand mount requirements, but shell DOM and optional status DOM should not shape its core contract.

Spec direction:

- keep `mount` limited to the DOM that is required to host one runtime, such as canvas and IME input
- move status panels, shell overlays, and other optional DOM concerns into adapters owned by `surface` or playground code
- keep runtime core testable without requiring the full playground shell DOM structure

### 7. Make plugin ownership clearer

Plugins are logically one subsystem today, but their files are split between multiple `surface` locations.

Spec direction:

- consolidate plugin runtime, types, dispatch, and host logic under one `surface/plugins/` area
- stabilize the host contract before building more plugin-facing surface features
- keep plugin-facing APIs away from unrelated pane-layout modules

### 8. Treat the playground as a product consumer

The playground should validate the public product surface, not bypass it.

Spec direction:

- do not import directly from `src/internal.ts` in the playground
- do not couple the playground to raw managed pane internals
- make playground features express real product use cases through public `restty` exports

## Build and Repo Hygiene

Architecture work will drift again if the repo keeps rewarding shortcuts.

### 1. Stop tracking generated playground bundles

Generated assets such as `playground/public/playground.js` and its source map should be build output, not committed source.

Spec direction:

- remove tracked generated playground bundles from the repo
- keep build output under `playground/dist/`
- reserve `playground/public/` for static assets that are authored directly

### 2. Split source and generated assets more strictly

The playground should use a standard source/static/build separation.

Spec direction:

- source lives in `playground/src/`
- static assets live in `playground/public/`
- generated build output lives in `playground/dist/`

### 3. Add architecture tests or lint rules for forbidden imports

The repo should enforce the dependency rules described in this spec.

Examples:

- `runtime` cannot import `surface`
- playground cannot import `src/internal.ts`
- public entrypoints should not reach through unstable folders unless that export is intentional

These checks can start as lint rules, custom tests, or both.

### 4. Add a small ADR habit

This refactor is big enough that the repo needs lightweight decision records to keep future work aligned.

Spec direction:

- add short ADRs for the config model, plugin model, runtime boundary, and playground architecture
- keep them brief and decision-focused rather than turning them into long design essays
- update them when a later refactor intentionally changes one of these foundations

## Playground Refactor

### Decision

Rewrite the playground as a Svelte application built with Vite.

Rationale:

- the current playground is a large DOM script with mixed UI, pane state, transport management, theme handling, and demos
- a component/store model is a better fit than continuing to scale a single file
- Vite remains a strong fit for local iteration and static output
- the playground currently behaves like a single application, not a library-internal script

SvelteKit is intentionally deferred. If the playground later grows into a multi-route docs/examples application, it can move to SvelteKit with static generation. For now, plain Svelte plus Vite is the smaller and safer move.

### Playground rules

- the playground must consume public exports from `restty`, not `../src/internal.ts`
- built playground artifacts must not be committed to source control
- source code moves to `playground/src/`
- static assets remain under `playground/public/`
- build output goes to `playground/dist/`
- Bun continues to orchestrate the PTY dev server

Target structure:

```txt
playground/
  src/
    lib/
      components/
      stores/
      transports/
      demos/
      services/
    App.svelte
    main.ts
  public/
  index.html
  vite.config.ts
  tsconfig.json
```

Suggested store boundaries:

- `surface-store`
- `settings-store`
- `connection-store`
- `theme-store`
- `font-store`
- `demo-store`

Suggested component boundaries:

- `PlaygroundShell`
- `TerminalWorkspace`
- `SettingsDialog`
- `ConnectionPanel`
- `AppearancePanel`
- `DemoPanel`
- `StatusBar`

## Migration Plan

### Phase 0: lock the design

- add this spec
- decide the final public names
- confirm clean-break rename policy

Exit criteria:

- names are agreed
- public vs internal responsibility is documented

### Phase 1: repair public ergonomics

- introduce `ResttyConfig` as the preferred public config name
- introduce `ResttyRuntimeConfig` as the preferred runtime config name
- introduce `ResttyTerminalConfig` as the preferred high-level terminal config name
- move surface-level events and plugin wiring under `surface`
- rename the exported types and fields directly
- add missing active-pane convenience methods or remove them from docs
- de-emphasize raw pane accessors in docs

Exit criteria:

- public docs match the actual public API
- top-level constructor docs no longer teach internal naming
- public config shape is `root + surface + terminal + services`

### Phase 2: unify surface and runtime config flow

- stop using `Omit<InternalType, ...>` as the public/internal bridge
- make `surface` consume `ResttySurfaceConfig` and `ResttyTerminalConfig`
- introduce explicit `services` and `mount` boundaries so `terminal` stays behavior-only
- make `surface` pass `terminal` through to runtime with only mount/session/service injection
- make runtime creation accept the same `terminal` vocabulary used by public API
- define `ResttyRuntime` and `createResttyRuntime(...)` as the runtime boundary
- introduce explicit runtime lifecycle states and first-class runtime events

Exit criteria:

- public config types are no longer inherited from manager/runtime option bags
- `surface` and `runtime` share the same terminal config vocabulary
- runtime creation only adds mount/service-specific data on top of terminal config
- runtime lifecycle and events are explicit rather than implicit

### Phase 3: tighten runtime/surface boundaries

- remove runtime re-exports of surface modules
- move cross-cutting logic into clearly owned modules
- split `Restty` internals into smaller coordinators
- split runtime internals by capability instead of growing one wide runtime API
- move DOM-specific status and shell concerns out of runtime core
- consolidate plugin ownership under one `surface/plugins/` area
- narrow `restty/internal`

Exit criteria:

- dependency direction is one-way
- `internal` is curated and explicitly unstable
- `Restty` is smaller and more intentional internally
- `surface` depends on a real runtime boundary rather than concrete runtime implementation details

### Phase 4: rewrite the playground

- create Svelte + Vite playground
- move state into stores and services
- route all playground integration through public `restty` exports
- remove committed generated playground bundles

Exit criteria:

- playground no longer imports from `src/internal.ts`
- `playground/app.ts` is removed
- generated bundle files are not tracked

### Phase 5: enforce repo boundaries

- add architecture lint rules or tests for forbidden imports
- split playground source, static assets, and build output into their final locations
- add ADRs for the config model, runtime boundary, plugin model, and playground architecture

Exit criteria:

- forbidden import rules are enforced automatically
- generated playground output stays out of source control
- key architecture decisions are documented in short ADRs

## Rename Strategy

- rename high-level public option/type names directly without aliases
- update docs and playground examples in the same change set
- keep migration scope tight so there is only one supported naming scheme after the refactor lands

## Risks

- too much naming churn at once can obscure the architectural benefit
- partial migration could leave inconsistent naming across code, docs, and examples
- moving playground first without public API cleanup would hard-code temporary shapes into the new UI

## Mitigations

- do naming and config unification before deep file moves
- land naming changes in one focused pass
- make the playground a consumer of the public API as soon as phase 1 lands

## Acceptance Criteria

This refactor is successful when all of the following are true:

- `runtime` and `surface` remain the top-level architecture names
- public config uses explicit, responsibility-based names
- public and internal config use one shared vocabulary
- `surface` owns surface events and plugin wiring
- terminal config is behavior-only and runtime config is only extended with mount/service-specific data
- `surface` depends on a `ResttyRuntime` boundary rather than concrete runtime implementation files
- runtime exposes explicit lifecycle state and first-class events
- docs match the actual exported API
- active-pane convenience methods are defined by one explicit pane-scoped terminal contract
- `restty/internal` is narrower than it is today while remaining useful for hackable users through curated unstable exports
- the playground is component-based and uses public `restty` exports only
- generated playground bundles are not tracked
- architecture rules prevent `runtime -> surface` imports and playground imports from `src/internal.ts`

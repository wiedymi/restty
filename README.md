# restty

[![Version](https://img.shields.io/npm/v/restty?style=flat-square)](https://www.npmjs.com/package/restty)
[![Downloads](https://img.shields.io/npm/dm/restty)](https://www.npmjs.com/package/restty)
[![Package Size](https://img.shields.io/npm/unpacked-size/restty?style=flat-square)](https://www.npmjs.com/package/restty)
[![CI](https://img.shields.io/github/actions/workflow/status/wiedymi/restty/ci.yml?branch=main&style=flat-square)](https://github.com/wiedymi/restty/actions/workflows/ci.yml)
[![Publish](https://img.shields.io/github/actions/workflow/status/wiedymi/restty/publish.yml?style=flat-square&label=publish)](https://github.com/wiedymi/restty/actions/workflows/publish.yml)
[![Demo](https://img.shields.io/badge/demo-restty.pages.dev-0ea5e9?style=flat-square)](https://restty.pages.dev/)

[![GitHub](https://img.shields.io/badge/-GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/wiedymi)
[![Twitter](https://img.shields.io/badge/-Twitter-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://x.com/wiedymi)
[![Email](https://img.shields.io/badge/-Email-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:contact@wiedymi.com)
[![Discord](https://img.shields.io/badge/-Discord-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/zemMZtrkSb)
[![Support me](https://img.shields.io/badge/-Support%20me-ff69b4?style=flat-square&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/vivy-company)

Powerful, lightweight browser terminal. Batteries included.

Live demo: `https://restty.pages.dev/`

Powered by:

- `libghostty-vt` (WASM terminal core)
- `WebGPU` (with WebGL2 fallback)
- `text-shaper` (shaping + raster)

## Release Status

`restty` is in an early release stage.

- Known issue: kitty image protocol handling can still fail in some edge cases.
- API note: high-level APIs are usable now, but some APIs may still change to improve DX.

If you hit an issue, please open one on GitHub with repro steps.

## Install

```bash
npm i restty
```

## Quick Start

```html
<div id="terminal"></div>
```

```ts
import { Restty } from "restty";

const restty = new Restty({
  root: document.getElementById("terminal") as HTMLElement,
});

restty.connectPty("ws://localhost:8787/pty");
```

That is the primary API: `new Restty(...)`.
`restty` creates pane DOM, canvas, and hidden IME input for you.

## Common Tasks

### Apply a built-in theme

```ts
import { getBuiltinTheme } from "restty";

const theme = getBuiltinTheme("Aizen Dark");
if (theme) restty.applyTheme(theme);
```

### Parse and apply a Ghostty theme file

```ts
import { parseGhosttyTheme } from "restty";

const theme = parseGhosttyTheme(`
foreground = #c0caf5
background = #1a1b26
cursor-color = #c0caf5
`);

restty.applyTheme(theme, "inline");
```

### Split panes and operate per pane

```ts
restty.splitActivePane("vertical");
restty.splitActivePane("horizontal");

for (const pane of restty.panes()) {
  pane.connectPty("ws://localhost:8787/pty");
}
```

### Use active-pane convenience methods

```ts
restty.setFontSize(15);
restty.sendInput("ls -la\n");
restty.copySelectionToClipboard();
```

### Provide custom fonts

By default, restty uses a local-first font preset with CDN fallback. To fully control fonts, disable the preset and pass `fontSources`.

```ts
const restty = new Restty({
  root: document.getElementById("terminal") as HTMLElement,
  appOptions: {
    fontPreset: "none",
  },
  fontSources: [
    {
      type: "url",
      url: "https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@v2.304/fonts/ttf/JetBrainsMono-Regular.ttf",
      label: "JetBrains Mono",
    },
    {
      type: "local",
      matchers: ["jetbrains mono nerd font", "fira code nerd font"],
      label: "Local fallback",
    },
  ],
});
```

Update fonts at runtime (all panes):

```ts
await restty.setFontSources([
  { type: "local", matchers: ["sf mono"], required: true },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf",
  },
]);
```

### Touch behavior (pan-first by default)

On touch devices, restty defaults to pan-first scrolling with long-press selection.

```ts
const restty = new Restty({
  root: document.getElementById("terminal") as HTMLElement,
  appOptions: {
    // "long-press" (default) | "drag" | "off"
    touchSelectionMode: "long-press",
    // Optional tuning knobs:
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
  },
});
```

### Plugin system (native)

Use plugins when you want to extend restty behavior without patching core.

```ts
import type { ResttyPlugin } from "restty";

const metricsPlugin: ResttyPlugin = {
  id: "example/metrics",
  apiVersion: 1,
  activate(ctx) {
    const paneCreated = ctx.on("pane:created", ({ paneId }) => {
      console.log("pane created", paneId);
    });
    const outgoing = ctx.addInputInterceptor(({ text }) => text.replace(/\t/g, "  "));
    const lifecycle = ctx.addLifecycleHook(({ phase, action }) => {
      console.log("lifecycle", phase, action);
    });
    const stage = ctx.addRenderStage({
      id: "metrics/tint",
      mode: "after-main",
      uniforms: [0.12],
      shader: {
        wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  return vec4f(min(vec3f(1.0), color.rgb + vec3f(params0.x, 0.0, 0.0)), color.a);
}
`,
      },
    });
    return () => {
      paneCreated.dispose();
      outgoing.dispose();
      lifecycle.dispose();
      stage.dispose();
    };
  },
};

await restty.use(metricsPlugin, { sampleRate: 1 });
console.log(restty.pluginInfo("example/metrics"));
restty.unuse("example/metrics");
```

Declarative loading (manifest + registry):

```ts
await restty.loadPlugins(
  [{ id: "example/metrics", options: { sampleRate: 1 } }],
  {
    "example/metrics": () => metricsPlugin,
  },
);
```

See `docs/plugins.md` for full plugin authoring details.

### Shader stages

Shader stages let you extend the final frame pipeline with WGSL/GLSL passes.

Global stages:

```ts
restty.setShaderStages([
  {
    id: "app/crt-lite",
    mode: "after-main",
    backend: "both",
    uniforms: [0.24, 0.12],
    shader: {
      wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let v = clamp(params0.x, 0.0, 0.8);
  let centered = (uv - vec2f(0.5, 0.5)) * 2.0;
  let vignette = max(0.0, 1.0 - v * dot(centered, centered));
  return vec4f(color.rgb * vignette, color.a);
}
`,
    },
  },
]);

const stage = restty.addShaderStage({
  id: "app/mono",
  mode: "after-main",
  uniforms: [1.0],
  shader: {
    wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  let l = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
  return vec4f(l * 0.12, l * 0.95, l * 0.35, color.a);
}
`,
  },
});

stage.setEnabled(false);
restty.removeShaderStage("app/mono");
```

### xterm compatibility layer

For migration from xterm.js-style app code, use `restty/xterm`:

```ts
import { Terminal } from "restty/xterm";

const term = new Terminal({ cols: 100, rows: 30 });
term.open(document.getElementById("terminal") as HTMLElement);

term.onData((data) => console.log("input", data));
term.onResize(({ cols, rows }) => console.log("resize", cols, rows));

term.write("hello");
term.writeln(" world");
term.resize(120, 40);
term.loadAddon({
  activate() {},
  dispose() {},
});
```

Compatibility scope:

- Good for common embed/migration flows.
- Not full xterm internals parity (buffer/parser/marker ecosystem APIs are not all implemented).
- Prefer native `Restty` API for long-term integrations.

## API Snapshot

Primary class:

- `new Restty({ root, ...options })`
- `createRestty(options)`

Xterm compatibility:

- `import { Terminal } from "restty/xterm"`
- Supports `open`, `write`, `writeln`, `resize`, `focus`, `blur`, `clear`, `reset`, `onData`, `onResize`, `options`, `loadAddon`, `dispose`

Pane access:

- `panes()` / `pane(id)` / `activePane()` / `focusedPane()` / `forEachPane(visitor)`
- `splitActivePane("vertical" | "horizontal")` / `splitPane(id, direction)` / `closePane(id)`

Active-pane convenience:

- `connectPty(url)` / `disconnectPty()` / `isPtyConnected()`
- `setRenderer("auto" | "webgpu" | "webgl2")`
- `setFontSize(number)` / `setFontSources([...])`
- `applyTheme(theme)` / `resetTheme()`
- `setMouseMode("auto" | "on" | "off")`
- `sendInput(text)` / `sendKeyInput(text)`
- `copySelectionToClipboard()` / `pasteFromClipboard()`
- `resize(cols, rows)` / `focus()` / `blur()`
- `updateSize(force?)`
- `destroy()`

Plugin host:

- `use(plugin, options?)` / `loadPlugins(manifest, registry)` / `unuse(pluginId)` / `plugins()` / `pluginInfo(pluginId?)`
- plugin context supports `on(...)`, `addInputInterceptor(...)`, `addOutputInterceptor(...)`, `addLifecycleHook(...)`, `addRenderHook(...)`, `addRenderStage(...)`

Shader stages:

- `setShaderStages(stages)` / `getShaderStages()`
- `addShaderStage(stage)` / `removeShaderStage(id)`

## Advanced / Internal Modules

Use these only when you need lower-level control:

- `restty/internal`: full internal barrel (unstable; includes low-level modules like WASM/input/pty helpers)

## Local Development

```bash
git clone https://github.com/wiedymi/restty.git
cd restty
git submodule update --init --recursive
bun install
bun run build:themes
bun run playground
```

Open `http://localhost:5173`.

## Code Layout

- `src/surface/`: public API (`Restty`), pane manager orchestration, plugin host, xterm shim.
- `src/runtime/`: terminal runtime/render loop implementation.
- `src/renderer/`, `src/input/`, `src/pty/`, `src/fonts/`, `src/theme/`, `src/wasm/`, `src/selection/`: subsystem modules.
- `src/app/`: compatibility re-export layer while internals are refactored.

## Repository Commands

```bash
bun run build         # build package output
bun run test          # full tests
bun run test:ci       # CI-safe test target
bun run lint          # lint
bun run format:check  # formatting check
bun run build:assets  # static playground bundle (playground/public/playground.js)
bun run playground    # one-command local dev (PTY + playground dev server)
bun run pty           # PTY websocket server only
```

## Documentation

- `docs/README.md` - docs index
- `docs/usage.md` - practical integration guide
- `docs/xterm-compat.md` - xterm migration shim
- `docs/how-it-works.md` - runtime flow
- `docs/internals/` - implementation notes and architecture
- `THIRD_PARTY_NOTICES.md` - third-party credits and notices

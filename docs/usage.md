# Usage

This guide focuses on the primary integration path: `new Restty(...)`.

## 1) Minimal integration

```ts
import { Restty } from "restty";

const restty = new Restty({
  root: document.getElementById("paneRoot") as HTMLElement,
});

restty.connectPty("ws://localhost:8787/pty");
```

## 2) Constructor options you will use most

```ts
import { Restty } from "restty";

const restty = new Restty({
  root: document.getElementById("paneRoot") as HTMLElement,

  // Pane manager behavior
  createInitialPane: true,
  shortcuts: true,
  defaultContextMenu: true,

  // Pane visuals
  paneStyles: {
    inactivePaneOpacity: 0.82,
    dividerThicknessPx: 1,
  },

  // App defaults for each pane
  appOptions: {
    renderer: "auto", // "auto" | "webgpu" | "webgl2"
    fontSize: 16,
    // Optional text-shaper hinting controls:
    // hinting off by default for parity/thickness reasons.
    fontHinting: false,
    fontHintTarget: "auto", // "auto" | "light" | "normal"
    autoResize: true,
    // Touch behavior:
    // "long-press" (default) | "drag" | "off"
    touchSelectionMode: "long-press",
    touchSelectionLongPressMs: 450,
    touchSelectionMoveThresholdPx: 10,
  },
});
```

Touch mode summary:

- `"long-press"`: one-finger pan scroll, selection starts after long press.
- `"drag"`: immediate drag selection (legacy behavior).
- `"off"`: disable touch selection and keep touch scrolling.

## 3) Single-pane convenience API

These methods target the current active pane.

```ts
restty.connectPty("ws://localhost:8787/pty");
restty.setRenderer("auto");
restty.setFontSize(15);

restty.sendInput("echo 'hello'\n");
restty.sendKeyInput("\u001b[A");

restty.setMouseMode("auto");
await restty.copySelectionToClipboard();
await restty.pasteFromClipboard();

restty.focus();
restty.resize(120, 32);
restty.blur();
restty.updateSize();
restty.disconnectPty();
```

## 4) Multi-pane workflow

Use pane splitting APIs, then operate per pane through `ResttyPaneHandle`.

```ts
restty.splitActivePane("vertical");
restty.splitActivePane("horizontal");

for (const pane of restty.panes()) {
  pane.connectPty("ws://localhost:8787/pty");
  pane.setFontSize(14);
}

const focused = restty.focusedPane();
if (focused) {
  focused.sendInput("pwd\n");
}
```

If needed, legacy/raw pane objects are still available:

- `restty.getPanes()`
- `restty.getActivePane()`
- `restty.getFocusedPane()`

## 5) Themes

### Built-in themes

```ts
import { getBuiltinTheme } from "restty";

const theme = getBuiltinTheme("Aizen Dark");
if (theme) restty.applyTheme(theme);
```

### Ghostty theme text

```ts
import { parseGhosttyTheme } from "restty";

const theme = parseGhosttyTheme(`
foreground = #c0caf5
background = #1a1b26
cursor-color = #c0caf5
`);

restty.applyTheme(theme, "inline");
```

## 6) Fonts

By default, restty loads a local-first font preset with CDN fallback.

To fully control font loading:

```ts
const restty = new Restty({
  root: document.getElementById("paneRoot") as HTMLElement,
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
      matchers: ["sf mono", "jetbrains mono nerd font"],
      required: false,
    },
  ],
});
```

Update all panes at runtime:

```ts
await restty.setFontSources([
  { type: "local", matchers: ["sf mono"], required: true },
  {
    type: "url",
    url: "https://cdn.jsdelivr.net/gh/ryanoasis/nerd-fonts@v3.4.0/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFontMono-Regular.ttf",
  },
]);
```

## 7) Cleanup

```ts
restty.destroy();
```

Call `destroy()` when removing the terminal from the page to release GPU/WASM/PTY resources.

## 8) Advanced modules

Use these only if `Restty` is not enough:

- `restty/internal`: full internal barrel (unstable; includes low-level WASM/PTY/input APIs)

Low-level example:

```ts
import { loadResttyWasm } from "restty/internal";

const wasm = await loadResttyWasm();
const handle = wasm.create(80, 24, 2000);

wasm.write(handle, "echo 'hello from restty'\r\n");
wasm.renderUpdate(handle);

const state = wasm.getRenderState(handle);
if (state) {
  console.log(state.rows, state.cols, state.codepoints.length);
}

wasm.destroy(handle);
```

## 9) Plugin host (native)

```ts
import type { ResttyPlugin } from "restty";

const logPlugin: ResttyPlugin = {
  id: "example/log-pane-events",
  version: "1.0.0",
  apiVersion: 1,
  requires: {
    pluginApi: { min: 1, max: 1 },
  },
  activate(ctx) {
    const created = ctx.on("pane:created", ({ paneId }) => {
      console.log("pane created", paneId);
    });
    const active = ctx.on("pane:active-changed", ({ paneId }) => {
      console.log("active pane", paneId);
    });
    const outgoing = ctx.addInputInterceptor(({ text }) => text.replace(/\t/g, "  "));
    const incoming = ctx.addOutputInterceptor(({ text }) => text);
    const lifecycle = ctx.addLifecycleHook(({ phase, action }) => {
      console.log("lifecycle", phase, action);
    });
    const render = ctx.addRenderHook(({ phase, paneId, dropped }) => {
      console.log("render", phase, paneId, dropped);
    });
    const stage = ctx.addRenderStage({
      id: "example/log-pane-events/tint",
      mode: "after-main",
      uniforms: [0.05],
      shader: {
        wgsl: `
fn resttyStage(color: vec4f, uv: vec2f, time: f32, params0: vec4f, params1: vec4f) -> vec4f {
  return vec4f(min(vec3f(1.0), color.rgb + vec3f(params0.x, 0.0, 0.0)), color.a);
}
`,
      },
    });
    return () => {
      created.dispose();
      active.dispose();
      outgoing.dispose();
      incoming.dispose();
      lifecycle.dispose();
      render.dispose();
      stage.dispose();
    };
  },
};

await restty.use(logPlugin);
console.log(restty.plugins()); // ["example/log-pane-events"]
console.log(restty.pluginInfo("example/log-pane-events"));
restty.unuse("example/log-pane-events");

// Optional manifest + registry loading
await restty.loadPlugins(
  [{ id: "example/log-pane-events", options: { level: "info" } }],
  {
    "example/log-pane-events": () => logPlugin,
  },
);
```

## 10) Shader stages

Use shader stages when you want frame-level visual effects.

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

stage.setUniforms([0.9]);
stage.setEnabled(true);
stage.dispose();
```

## 11) xterm compatibility shim

```ts
import { Terminal } from "restty/xterm";

const term = new Terminal({ cols: 100, rows: 30 });
term.open(document.getElementById("term")!);

term.onData((data) => console.log("input", data));
term.onResize(({ cols, rows }) => console.log("resize", cols, rows));

term.write("hello");
term.writeln(" world");
term.resize(120, 40);
term.options = { ...term.options, cursorBlink: true };
term.focus();
term.blur();
term.clear();
term.reset();

term.loadAddon({
  activate() {
    console.log("addon active");
  },
  dispose() {
    console.log("addon disposed");
  },
});
```

## Local playground workflow

```bash
git submodule update --init --recursive
bun install
bun run build:themes
bun run playground
```

Open `http://localhost:5173`, then connect to `ws://localhost:8787/pty` from the UI.

`bun run playground` starts both the PTY websocket server and playground dev server.

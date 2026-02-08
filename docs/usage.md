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

By default, restty loads a CDN-based font preset.

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

- `restty/wasm`: direct WASM API (`loadResttyWasm`, `ResttyWasm`)
- `restty/pty`: PTY transport helpers
- `restty/input`: input handler utilities
- `restty/internal`: full internal barrel (unstable)

Low-level example:

```ts
import { loadResttyWasm } from "restty/wasm";

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

## Local playground workflow

```bash
git submodule update --init --recursive
bun install
bun run build:themes
bun run build:assets
bun run pty
bun run playground
```

Open `http://localhost:5173`, then connect to `ws://localhost:8787/pty` from the UI.

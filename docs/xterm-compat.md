# Xterm Compatibility

`restty` now ships an xterm-style shim under `restty/xterm`.

## Supported API

```ts
import { Terminal } from "restty/xterm";
```

Supported methods:

- `open(element)`
- `write(data, callback?)`
- `writeln(data?, callback?)`
- `resize(cols, rows)`
- `focus()`
- `blur()`
- `clear()`
- `reset()`
- `onData(listener)`
- `onResize(listener)`
- `options` / `setOption(key, value)` / `getOption(key)`
- `loadAddon(addon)`
- `dispose()`

Addon contract:

```ts
type TerminalAddon = {
  activate: (terminal: Terminal) => void;
  dispose: () => void;
};
```

## Example

```ts
import { Terminal } from "restty/xterm";

const term = new Terminal({ cols: 120, rows: 32 });
term.open(document.getElementById("term")!);

term.onData((data) => {
  console.log("input", data);
});
term.onResize(({ cols, rows }) => {
  console.log("resize", cols, rows);
});

term.write("hello");
term.writeln(" world");
term.resize(140, 40);
term.options = { ...term.options, cursorBlink: true };
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

## Notes

- `write`/`writeln` called before `open` are buffered and flushed on `open`.
- `onData` emits non-PTY input observed by the restty input pipeline.
- `onResize` fires from `resize(cols, rows)`.
- Addons are activated once and disposed when terminal is disposed.
- Extra xterm-style option keys are accepted and stored in `options` for migration ergonomics.
- This is a focused compatibility subset for migration, not full xterm internals parity.

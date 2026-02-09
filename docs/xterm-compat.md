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

term.write("hello");
term.writeln(" world");
term.resize(140, 40);

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
- Addons are activated once and disposed when terminal is disposed.
- This is a focused compatibility subset for migration, not full xterm internals parity.

# Xterm Migration

Migration-oriented example using the `restty/xterm` compatibility wrapper.

## Run

```sh
npm install
npm run dev
```

Start `../local-pty-server` if you want the Connect button to attach to a local
shell.

## xterm.js-style shape

```ts
import { Terminal } from "restty/xterm";

const term = new Terminal({ cols: 100, rows: 30 });
term.open(document.getElementById("terminal") as HTMLElement);
term.write("hello");
term.onData((data) => console.log(data));
```

For full restty APIs during migration, use `term.restty` after `open(...)`.

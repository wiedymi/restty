# Minimal Browser

Plain browser integration using the stable `Restty` API.

## Run

```sh
npm install
npm run dev
```

Open the Vite URL and optionally start `../local-pty-server` in another terminal.
The default PTY URL is `ws://localhost:8787/pty`.

## Key API

```ts
import { Restty } from "restty";

const restty = new Restty({
  root: document.getElementById("terminal") as HTMLElement,
});

restty.connectPty("ws://localhost:8787/pty");
```

# restty examples

Small runnable examples for the public `restty` API.

## Examples

- `minimal-browser`: plain browser integration with `new Restty(...)`.
- `react`: React component lifecycle wiring for `Restty`.
- `local-pty-server`: local WebSocket PTY server for `ws://localhost:8787/pty`.
- `custom-transport`: custom in-memory `PtyTransport`.
- `xterm-migration`: `restty/xterm` compatibility wrapper for xterm.js-style code.

## Running in this repository

Most frontend examples depend on the repository package through `"restty": "file:../.."`.
If `dist/` is stale, run the root package build first.

```sh
bun run build
```

Then install and run an example:

```sh
cd examples/minimal-browser
npm install
npm run dev
```

For examples that connect to a shell, run the local PTY server in a second terminal:

```sh
cd examples/local-pty-server
npm install
npm start
```

When copying an example into another app, replace the file dependency with the npm package:

```sh
npm install restty
```

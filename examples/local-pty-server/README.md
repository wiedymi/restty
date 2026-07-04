# Local PTY Server

Tiny WebSocket PTY server for browser examples.

It speaks the protocol expected by `createWebSocketPtyTransport`:

- client sends `{ "type": "input", "data": "..." }`
- client sends `{ "type": "resize", "cols": 120, "rows": 32 }`
- server sends terminal bytes as text frames
- server may send JSON status, error, and exit messages

## Run

```sh
npm install
npm start
```

The server listens at `ws://localhost:8787/pty` by default.

Optional environment variables:

```sh
PORT=9000 PTY_PATH=/shell SHELL=/bin/zsh npm start
```

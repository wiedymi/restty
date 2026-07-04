import os from "node:os";
import process from "node:process";
import * as pty from "node-pty";
import { WebSocket, WebSocketServer } from "ws";

const port = Number(process.env.PORT ?? 8787);
const path = process.env.PTY_PATH ?? "/pty";
const host = process.env.HOST ?? "127.0.0.1";
const shell = process.env.SHELL || (process.platform === "win32" ? "powershell.exe" : "bash");

const server = new WebSocketServer({ host, port, path });

function sendJson(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function parseMessage(raw) {
  const text = typeof raw === "string" ? raw : raw.toString("utf8");
  return JSON.parse(text);
}

function positiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.floor(number));
}

server.on("connection", (socket) => {
  let terminalExited = false;

  const term = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME ?? os.homedir(),
    env: {
      ...process.env,
      COLORTERM: "truecolor",
      TERM: "xterm-256color",
    },
  });

  const writeData = term.onData((data) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  });

  const exit = term.onExit(({ exitCode }) => {
    terminalExited = true;
    sendJson(socket, { type: "exit", code: exitCode });
    socket.close();
  });

  sendJson(socket, { type: "status", shell });

  socket.on("message", (raw) => {
    try {
      const message = parseMessage(raw);

      if (message.type === "input") {
        term.write(String(message.data ?? ""));
        return;
      }

      if (message.type === "resize") {
        term.resize(positiveInt(message.cols, 80), positiveInt(message.rows, 24));
        return;
      }

      sendJson(socket, { type: "error", message: `Unknown message type: ${message.type}` });
    } catch (error) {
      sendJson(socket, {
        type: "error",
        message: error instanceof Error ? error.message : "Invalid PTY message",
      });
    }
  });

  socket.on("close", () => {
    writeData.dispose();
    exit.dispose();
    if (!terminalExited) {
      term.kill();
    }
  });
});

server.on("listening", () => {
  console.log(`restty PTY server listening on ws://${host}:${port}${path}`);
});

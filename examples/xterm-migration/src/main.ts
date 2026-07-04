import { Terminal } from "restty/xterm";
import "./style.css";

const terminalRoot = document.querySelector<HTMLDivElement>("#terminal");
const ptyUrlInput = document.querySelector<HTMLInputElement>("#pty-url");
const connectButton = document.querySelector<HTMLButtonElement>("#connect");
const disconnectButton = document.querySelector<HTMLButtonElement>("#disconnect");
const writeButton = document.querySelector<HTMLButtonElement>("#write");
const resizeButton = document.querySelector<HTMLButtonElement>("#resize");

if (!terminalRoot || !ptyUrlInput) {
  throw new Error("Missing terminal root");
}

const term = new Terminal({
  cols: 100,
  rows: 30,
  surface: {
    paneStyles: true,
    searchUi: true,
  },
  terminal: {
    renderer: "auto",
    fontSize: 15,
  },
});

term.open(terminalRoot);
term.writeln("\x1b[1;36mrestty/xterm\x1b[0m compatibility example");
term.writeln("Type to exercise onData, or connect to a local PTY server.");
term.writeln("");

term.onData((data) => {
  if (term.restty?.isPtyConnected()) return;
  term.write(data.replace(/\r/g, "\r\n"));
});

term.onResize(({ cols, rows }) => {
  term.writeln(`\x1b[90mresize ${cols}x${rows}\x1b[0m`);
});

term.loadAddon({
  activate(activeTerm) {
    activeTerm.writeln("\x1b[90maddon activated\x1b[0m");
  },
  dispose() {},
});

connectButton?.addEventListener("click", () => {
  term.restty?.connectPty(ptyUrlInput.value.trim() || "ws://localhost:8787/pty");
});

disconnectButton?.addEventListener("click", () => {
  term.restty?.disconnectPty();
});

writeButton?.addEventListener("click", () => {
  term.writeln(`button write at ${new Date().toLocaleTimeString()}`);
});

resizeButton?.addEventListener("click", () => {
  term.resize(term.cols === 100 ? 120 : 100, term.rows === 30 ? 36 : 30);
});

window.addEventListener("beforeunload", () => {
  term.dispose();
});

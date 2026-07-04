import { Restty, getBuiltinTheme } from "restty";
import "./style.css";

const terminalRoot = document.querySelector<HTMLDivElement>("#terminal");
const ptyUrlInput = document.querySelector<HTMLInputElement>("#pty-url");
const connectButton = document.querySelector<HTMLButtonElement>("#connect");
const disconnectButton = document.querySelector<HTMLButtonElement>("#disconnect");
const splitButton = document.querySelector<HTMLButtonElement>("#split");
const demoButton = document.querySelector<HTMLButtonElement>("#demo-output");

if (!terminalRoot || !ptyUrlInput) {
  throw new Error("Missing terminal root");
}

const getPtyUrl = () => ptyUrlInput.value.trim() || "ws://localhost:8787/pty";
const theme = getBuiltinTheme("Aizen Dark");

const restty = new Restty({
  root: terminalRoot,
  surface: {
    shortcuts: true,
    paneStyles: true,
    searchUi: true,
    defaultContextMenu: {
      getPtyUrl,
    },
  },
  terminal: {
    renderer: "auto",
    fontSize: 15,
    ligatures: true,
    theme: theme ?? undefined,
  },
});

function writeDemoOutput() {
  restty.sendInput(
    [
      "\r\n\x1b[1;36mrestty\x1b[0m minimal browser example",
      "This output was written without a PTY.",
      "Start examples/local-pty-server to connect to a real shell.",
      "",
    ].join("\r\n"),
    "pty",
  );
}

connectButton?.addEventListener("click", () => {
  restty.connectPty(getPtyUrl());
});

disconnectButton?.addEventListener("click", () => {
  restty.disconnectPty();
});

splitButton?.addEventListener("click", () => {
  const pane = restty.splitActivePane("vertical");
  pane?.connectPty(getPtyUrl());
});

demoButton?.addEventListener("click", writeDemoOutput);

writeDemoOutput();

window.addEventListener("beforeunload", () => {
  restty.destroy();
});

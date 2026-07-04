import { Restty, getBuiltinTheme } from "restty";
import { createEchoTransport } from "./echo-transport";
import "./style.css";

const terminalRoot = document.querySelector<HTMLDivElement>("#terminal");
const connectButton = document.querySelector<HTMLButtonElement>("#connect");
const disconnectButton = document.querySelector<HTMLButtonElement>("#disconnect");
const sendButton = document.querySelector<HTMLButtonElement>("#send-command");

if (!terminalRoot) {
  throw new Error("Missing terminal root");
}

const restty = new Restty({
  root: terminalRoot,
  surface: {
    paneStyles: true,
    searchUi: true,
  },
  terminal: {
    renderer: "auto",
    fontSize: 15,
    theme: getBuiltinTheme("Aizen Dark") ?? undefined,
  },
  services: {
    ptyTransport: createEchoTransport(),
  },
});

connectButton?.addEventListener("click", () => {
  restty.connectPty("memory://echo");
});

disconnectButton?.addEventListener("click", () => {
  restty.disconnectPty();
});

sendButton?.addEventListener("click", () => {
  restty.sendKeyInput("help\r");
});

restty.connectPty("memory://echo");

window.addEventListener("beforeunload", () => {
  restty.destroy();
});

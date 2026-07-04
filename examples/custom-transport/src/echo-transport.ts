import type { PtyCallbacks, PtyConnectOptions, PtyResizeMeta, PtyTransport } from "restty";

export function createEchoTransport(): PtyTransport {
  let connected = false;
  let callbacks: PtyCallbacks | null = null;
  let line = "";

  function write(text: string) {
    callbacks?.onData?.(text);
  }

  function prompt() {
    write("\x1b[32mecho\x1b[0m $ ");
  }

  function submitLine() {
    const command = line.trim();
    write("\r\n");
    if (command) {
      write(`received: ${command}\r\n`);
    }
    line = "";
    prompt();
  }

  function disconnect() {
    if (!connected) return;
    connected = false;
    callbacks?.onDisconnect?.();
    callbacks = null;
    line = "";
  }

  return {
    connect(options: PtyConnectOptions) {
      connected = true;
      callbacks = options.callbacks;
      callbacks.onConnect?.();
      callbacks.onStatus?.("echo");
      write("Connected to an in-memory restty transport.\r\n");
      prompt();
    },
    disconnect,
    sendInput(data: string) {
      if (!connected) return false;

      for (const char of data) {
        if (char === "\r" || char === "\n") {
          submitLine();
          continue;
        }

        if (char === "\u0003") {
          write("^C\r\n");
          line = "";
          prompt();
          continue;
        }

        if (char === "\u007f") {
          line = line.slice(0, -1);
          write("\b \b");
          continue;
        }

        line += char;
        write(char);
      }

      return true;
    },
    resize(cols: number, rows: number, _meta?: PtyResizeMeta) {
      if (!connected) return false;
      write(`\r\n[resize ${cols}x${rows}]\r\n`);
      prompt();
      write(line);
      return true;
    },
    isConnected() {
      return connected;
    },
    destroy() {
      disconnect();
    },
  };
}

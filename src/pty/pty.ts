import type {
  PtyCallbacks,
  PtyConnectionState,
  PtyConnectOptions,
  PtyMessage,
  PtyServerMessage,
  PtyTransport,
} from "./types";

export function decodePtyBinary(
  decoder: TextDecoder,
  payload: ArrayBuffer | Uint8Array,
  stream = true,
): string {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  return decoder.decode(bytes, { stream });
}

export function createPtyConnection(): PtyConnectionState {
  return {
    socket: null,
    connected: false,
    url: "",
    decoder: null,
  };
}

export function connectPty(state: PtyConnectionState, url: string, callbacks: PtyCallbacks): void {
  if (state.connected) return;
  if (!url) return;

  state.url = url;
  const ws = new WebSocket(url);
  const decoder = new TextDecoder();
  state.decoder = decoder;
  ws.binaryType = "arraybuffer";

  const flushDecoder = () => {
    if (!state.decoder) return;
    const tail = state.decoder.decode();
    state.decoder = null;
    if (tail) callbacks.onData?.(tail);
  };

  ws.addEventListener("open", () => {
    state.connected = true;
    state.socket = ws;
    callbacks.onConnect?.();
  });

  ws.addEventListener("close", () => {
    flushDecoder();
    if (state.socket === ws) {
      state.socket = null;
      state.connected = false;
    }
    callbacks.onDisconnect?.();
  });

  ws.addEventListener("error", () => {
    flushDecoder();
    if (state.socket === ws) {
      state.socket = null;
      state.connected = false;
    }
    callbacks.onDisconnect?.();
  });

  ws.addEventListener("message", (event) => {
    if (state.socket !== ws) return;
    const payload = event.data;

    if (payload instanceof ArrayBuffer) {
      const text = decodePtyBinary(decoder, payload, true);
      if (text) callbacks.onData?.(text);
      return;
    }

    if (payload instanceof Blob) {
      payload.arrayBuffer().then((buf) => {
        const text = decodePtyBinary(decoder, buf, true);
        if (text) callbacks.onData?.(text);
      });
      return;
    }

    if (typeof payload === "string") {
      if (handleServerMessage(payload, callbacks)) return;
      callbacks.onData?.(payload);
    }
  });
}

export function disconnectPty(state: PtyConnectionState): void {
  if (state.decoder) {
    state.decoder.decode();
    state.decoder = null;
  }
  const socket = state.socket;
  state.socket = null;
  state.connected = false;
  if (socket) {
    try {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    } catch {
      // Ignore close errors
    }
  }
}

export function sendPtyInput(state: PtyConnectionState, data: string): boolean {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return false;
  const message: PtyMessage = { type: "input", data };
  state.socket.send(JSON.stringify(message));
  return true;
}

export function sendPtyResize(state: PtyConnectionState, cols: number, rows: number): boolean {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return false;
  const message: PtyMessage = { type: "resize", cols, rows };
  state.socket.send(JSON.stringify(message));
  return true;
}

function handleServerMessage(payload: string, callbacks: PtyCallbacks): boolean {
  try {
    const msg = JSON.parse(payload) as PtyServerMessage;

    if (msg.type === "status") {
      callbacks.onStatus?.(msg.shell ?? "");
      return true;
    }

    if (msg.type === "error") {
      callbacks.onError?.(msg.message ?? "", msg.errors);
      return true;
    }

    if (msg.type === "exit") {
      callbacks.onExit?.(msg.code ?? 0);
      return true;
    }
  } catch {
    // Not JSON, treat as data
  }
  return false;
}

export function isPtyConnected(state: PtyConnectionState): boolean {
  return state.connected && state.socket?.readyState === WebSocket.OPEN;
}

export function createWebSocketPtyTransport(
  state: PtyConnectionState = createPtyConnection(),
): PtyTransport {
  return {
    connect: (options: PtyConnectOptions) => {
      const url = options.url?.trim?.() ?? "";
      if (!url) {
        throw new Error("PTY URL is required for WebSocket transport");
      }
      connectPty(state, url, options.callbacks);
    },
    disconnect: () => {
      disconnectPty(state);
    },
    sendInput: (data: string) => {
      return sendPtyInput(state, data);
    },
    resize: (cols: number, rows: number) => {
      return sendPtyResize(state, cols, rows);
    },
    isConnected: () => {
      return isPtyConnected(state);
    },
    destroy: () => {
      disconnectPty(state);
    },
  };
}

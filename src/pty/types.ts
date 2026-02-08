/**
 * Messages sent from the client to the PTY server.
 * - input: terminal keystrokes or pasted text
 * - resize: window size change notification
 */
export type PtyMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number };

/** Server notification that the PTY session is ready, with the active shell name. */
export type PtyStatusMessage = { type: "status"; shell?: string };
/** Server notification of an error during PTY operation. */
export type PtyErrorMessage = { type: "error"; message?: string; errors?: string[] };
/** Server notification that the PTY process has exited. */
export type PtyExitMessage = { type: "exit"; code?: number };

/** Union of all message types sent from the PTY server to the client. */
export type PtyServerMessage = PtyStatusMessage | PtyErrorMessage | PtyExitMessage;

/**
 * PTY connection lifecycle phase.
 * - idle: no active connection
 * - connecting: WebSocket handshake in progress
 * - connected: session is live
 * - closing: teardown in progress
 */
export type PtyLifecycleState = "idle" | "connecting" | "connected" | "closing";

/**
 * Internal state of a PTY WebSocket connection.
 */
export type PtyConnectionState = {
  /** Active WebSocket instance, or null when disconnected. */
  socket: WebSocket | null;
  /** Current lifecycle phase of the connection. */
  status: PtyLifecycleState;
  /** WebSocket endpoint URL. */
  url: string;
  /** Decoder for binary WebSocket frames, or null before connection. */
  decoder: TextDecoder | null;
  /** Monotonic ID used to discard stale connection callbacks. */
  connectId: number;
};

/**
 * Event callbacks for PTY connection lifecycle and data flow.
 */
export type PtyCallbacks = {
  /** Called when the WebSocket connection is established. */
  onConnect?: () => void;
  /** Called when the connection is closed or lost. */
  onDisconnect?: () => void;
  /** Called with terminal output data received from the PTY. */
  onData?: (data: string) => void;
  /** Called with the shell name when the PTY reports its status. */
  onStatus?: (shell: string) => void;
  /** Called when the PTY server reports an error. */
  onError?: (message: string, errors?: string[]) => void;
  /** Called with the exit code when the PTY process terminates. */
  onExit?: (code: number) => void;
};

/**
 * Options for establishing a PTY connection.
 */
export type PtyConnectOptions = {
  /** WebSocket endpoint URL to connect to. */
  url: string;
  /** Initial terminal width in columns. */
  cols?: number;
  /** Initial terminal height in rows. */
  rows?: number;
  /** Event callbacks for connection lifecycle and data. */
  callbacks: PtyCallbacks;
};

/**
 * Transport abstraction for PTY communication (WebSocket, WebContainer, etc.).
 */
export type PtyTransport = {
  /** Open a connection to the PTY server. */
  connect: (options: PtyConnectOptions) => void | Promise<void>;
  /** Close the current connection. */
  disconnect: () => void;
  /** Send terminal input data; returns true if the data was sent. */
  sendInput: (data: string) => boolean;
  /** Notify the PTY of a terminal resize; returns true if the message was sent. */
  resize: (cols: number, rows: number) => boolean;
  /** Whether the transport currently has an active connection. */
  isConnected: () => boolean;
  /** Release all resources held by the transport. */
  destroy?: () => void | Promise<void>;
};

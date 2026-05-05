import {
  createWebSocketPtyTransport,
  type PtyCallbacks,
  type PtyConnectOptions,
  type PtyResizeMeta,
  type PtyTransport,
} from "../../../../src/index.ts";
import type { PlaygroundConnectionBackend } from "./types.ts";

type CreateAdaptivePtyTransportOptions = {
  getConnectionBackend: () => PlaygroundConnectionBackend;
  getPtyUrl: () => string;
  getWebContainerCommand: () => string;
  getWebContainerCwd: () => string;
  onStatusChange?: (status: string) => void;
  createWebSocketTransport?: () => PtyTransport;
  createWebContainerTransport?: (options: {
    getCommand: () => string;
    getCwd: () => string;
  }) => PtyTransport | Promise<PtyTransport>;
  createJustBashTransport?: () => PtyTransport | Promise<PtyTransport>;
};

type DeferredPtyTransportLoader = () => PtyTransport | Promise<PtyTransport>;

async function loadWebContainerPtyTransport(options: {
  getCommand: () => string;
  getCwd: () => string;
}): Promise<PtyTransport> {
  const { createWebContainerPtyTransport } = await import("./webcontainer-transport.ts");
  return createWebContainerPtyTransport(options);
}

async function loadJustBashPtyTransport(): Promise<PtyTransport> {
  const { createJustBashPtyTransport } = await import("./just-bash-transport.ts");
  return createJustBashPtyTransport();
}

function createDeferredPtyTransport(loadTransport: DeferredPtyTransportLoader): PtyTransport {
  let connectToken = 0;
  let loadedTransport: PtyTransport | null = null;
  let transportPromise: Promise<PtyTransport> | null = null;

  const ensureTransport = async (): Promise<PtyTransport> => {
    if (loadedTransport) return loadedTransport;
    if (!transportPromise) {
      transportPromise = Promise.resolve(loadTransport())
        .then((transport) => {
          loadedTransport = transport;
          return transport;
        })
        .catch((error) => {
          transportPromise = null;
          throw error;
        });
    }
    return transportPromise;
  };

  return {
    connect: async (options: PtyConnectOptions) => {
      const token = ++connectToken;
      const transport = await ensureTransport();
      if (token !== connectToken) return;
      await transport.connect(options);
    },
    disconnect: () => {
      connectToken += 1;
      loadedTransport?.disconnect();
    },
    sendInput: (data: string) => {
      return loadedTransport?.sendInput(data) ?? false;
    },
    resize: (cols: number, rows: number, meta?: PtyResizeMeta) => {
      return loadedTransport?.resize(cols, rows, meta) ?? false;
    },
    isConnected: () => {
      return loadedTransport?.isConnected() ?? false;
    },
    destroy: async () => {
      connectToken += 1;
      const transport =
        loadedTransport ?? (transportPromise ? await transportPromise.catch(() => null) : null);
      await transport?.destroy?.();
    },
  };
}

function withStatusCallbacks(
  callbacks: PtyCallbacks,
  onStatusChange: ((status: string) => void) | undefined,
): PtyCallbacks {
  return {
    ...callbacks,
    onConnect: () => {
      onStatusChange?.("connected");
      callbacks.onConnect?.();
    },
    onDisconnect: () => {
      onStatusChange?.("disconnected");
      callbacks.onDisconnect?.();
    },
    onStatus: (shell) => {
      onStatusChange?.(shell);
      callbacks.onStatus?.(shell);
    },
    onError: (message, errors) => {
      onStatusChange?.(message);
      callbacks.onError?.(message, errors);
    },
    onExit: (code) => {
      onStatusChange?.(`exited ${code}`);
      callbacks.onExit?.(code);
    },
  };
}

export function createAdaptivePtyTransport(
  options: CreateAdaptivePtyTransportOptions,
): PtyTransport {
  const wsTransport = options.createWebSocketTransport?.() ?? createWebSocketPtyTransport();
  const justBashTransport = createDeferredPtyTransport(
    () => options.createJustBashTransport?.() ?? loadJustBashPtyTransport(),
  );
  const webContainerTransport = createDeferredPtyTransport(
    () =>
      options.createWebContainerTransport?.({
        getCommand: options.getWebContainerCommand,
        getCwd: options.getWebContainerCwd,
      }) ??
      loadWebContainerPtyTransport({
        getCommand: options.getWebContainerCommand,
        getCwd: options.getWebContainerCwd,
      }),
  );

  let activeTransport: PtyTransport | null = null;

  const pickTransport = () => {
    const backend = options.getConnectionBackend();
    if (backend === "just-bash") return justBashTransport;
    if (backend === "webcontainer") return webContainerTransport;
    return wsTransport;
  };

  const disconnectAll = () => {
    const transports = new Set<PtyTransport>([
      wsTransport,
      justBashTransport,
      webContainerTransport,
    ]);
    if (activeTransport) transports.add(activeTransport);
    for (const transport of transports) {
      transport.disconnect();
    }
    activeTransport = null;
  };

  return {
    connect: (connectOptions: PtyConnectOptions) => {
      const nextTransport = pickTransport();
      if (activeTransport && activeTransport !== nextTransport) {
        activeTransport.disconnect();
      }
      activeTransport = nextTransport;
      options.onStatusChange?.("connecting");
      return nextTransport.connect({
        ...connectOptions,
        url:
          options.getConnectionBackend() === "ws"
            ? options.getPtyUrl()
            : connectOptions.url,
        callbacks: withStatusCallbacks(connectOptions.callbacks, options.onStatusChange),
      });
    },
    disconnect: () => {
      disconnectAll();
      options.onStatusChange?.("disconnected");
    },
    sendInput: (data: string) => {
      return activeTransport?.sendInput(data) ?? false;
    },
    resize: (cols: number, rows: number, meta?: PtyResizeMeta) => {
      return activeTransport?.resize(cols, rows, meta) ?? false;
    },
    isConnected: () => {
      return activeTransport?.isConnected() ?? false;
    },
    destroy: async () => {
      disconnectAll();
      await wsTransport.destroy?.();
      await justBashTransport.destroy?.();
      await webContainerTransport.destroy?.();
    },
  };
}

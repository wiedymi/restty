import {
  createWebSocketPtyTransport,
  type PtyConnectOptions,
  type PtyResizeMeta,
  type PtyTransport,
} from "../../src/index.ts";
import type { ConnectionBackend } from "./connection-state.ts";

type CreateAdaptivePtyTransportOptions = {
  getConnectionBackend: () => ConnectionBackend;
  getPtyUrl: () => string;
  getWebContainerCommand: () => string;
  getWebContainerCwd: () => string;
  createWebSocketTransport?: () => PtyTransport;
  createWebContainerTransport?: (options: {
    getCommand: () => string;
    getCwd: () => string;
  }) => PtyTransport | Promise<PtyTransport>;
};

type DeferredPtyTransportLoader = () => PtyTransport | Promise<PtyTransport>;

async function loadWebContainerPtyTransport(options: {
  getCommand: () => string;
  getCwd: () => string;
}): Promise<PtyTransport> {
  const { createWebContainerPtyTransport } = await import("./webcontainer-pty.ts");
  return createWebContainerPtyTransport(options);
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

export function createAdaptivePtyTransport(
  options: CreateAdaptivePtyTransportOptions,
): PtyTransport {
  const wsTransport = options.createWebSocketTransport?.() ?? createWebSocketPtyTransport();
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

  const pickTransport = () =>
    options.getConnectionBackend() === "webcontainer" ? webContainerTransport : wsTransport;

  const disconnectAll = () => {
    const transports = new Set<PtyTransport>([wsTransport, webContainerTransport]);
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
      return nextTransport.connect(connectOptions);
    },
    disconnect: () => {
      disconnectAll();
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
      await webContainerTransport.destroy?.();
    },
  };
}

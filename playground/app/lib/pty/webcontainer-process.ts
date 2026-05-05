import type { WebContainerProcess } from "@webcontainer/api";
import type { PtyCallbacks } from "../../../../src/index.ts";

export type WebContainerProcessLike = Pick<
  WebContainerProcess,
  "exit" | "input" | "kill" | "output" | "resize"
>;

type AttachWebContainerProcessOptions = {
  callbacks: PtyCallbacks;
  isTokenActive: (token: number) => boolean;
  process: WebContainerProcessLike;
  statusLabel: string;
  token: number;
  welcomeData?: string;
};

export function createWebContainerProcessController() {
  let callbacks: PtyCallbacks | null = null;
  let connected = false;
  let inputWriter: WritableStreamDefaultWriter<string> | null = null;
  let outputReader: ReadableStreamDefaultReader<string> | null = null;
  let proc: WebContainerProcessLike | null = null;

  function resetStreams() {
    try {
      inputWriter?.releaseLock();
    } catch {
      // Ignore release failures.
    }
    try {
      outputReader?.releaseLock();
    } catch {
      // Ignore release failures.
    }
    inputWriter = null;
    outputReader = null;
  }

  function clearProcessState() {
    connected = false;
    proc = null;
    callbacks = null;
    resetStreams();
  }

  function stop(emitDisconnect: boolean) {
    const cb = callbacks;
    callbacks = null;
    connected = false;

    try {
      outputReader?.cancel();
    } catch {
      // Ignore reader cancel failures.
    }
    resetStreams();

    if (proc) {
      try {
        proc.kill();
      } catch {
        // Ignore kill failures.
      }
      proc = null;
    }

    if (emitDisconnect) cb?.onDisconnect?.();
  }

  function handleConnectError(cb: PtyCallbacks, err: unknown) {
    clearProcessState();
    const message = err instanceof Error ? err.message : String(err);
    cb.onError?.("Failed to start WebContainer process", [message]);
    cb.onDisconnect?.();
  }

  function startOutputPump(
    token: number,
    cb: PtyCallbacks,
    isTokenActive: (token: number) => boolean,
  ) {
    const reader = outputReader;
    if (!reader) return;

    void (async () => {
      try {
        while (isTokenActive(token)) {
          const { value, done } = await reader.read();
          if (done || !isTokenActive(token)) break;
          if (value) cb.onData?.(value);
        }
      } catch (err) {
        if (!isTokenActive(token)) return;
        const message = err instanceof Error ? err.message : String(err);
        cb.onError?.("WebContainer output stream failed", [message]);
      }
    })();
  }

  function attachProcess({
    callbacks: cb,
    isTokenActive,
    process,
    statusLabel,
    token,
    welcomeData,
  }: AttachWebContainerProcessOptions) {
    callbacks = cb;
    proc = process;
    inputWriter = process.input.getWriter();
    outputReader = process.output.getReader();
    connected = true;

    cb.onConnect?.();
    cb.onStatus?.(statusLabel);
    if (welcomeData) cb.onData?.(welcomeData);

    startOutputPump(token, cb, isTokenActive);

    void process.exit
      .then((code) => {
        if (!isTokenActive(token)) return;
        clearProcessState();
        cb.onExit?.(code);
        cb.onDisconnect?.();
      })
      .catch((err) => {
        if (!isTokenActive(token)) return;
        clearProcessState();
        const message = err instanceof Error ? err.message : String(err);
        cb.onError?.("WebContainer process exited with error", [message]);
        cb.onDisconnect?.();
      });
  }

  function sendInput(data: string, mapInput: (data: string) => string) {
    if (!connected || !inputWriter) return false;
    const payload = mapInput(data);
    void inputWriter.write(payload).catch(() => {
      // Lifecycle callbacks handle disconnects; ignore per-write races.
    });
    return true;
  }

  function resize(cols: number, rows: number) {
    if (!connected || !proc) return false;
    try {
      proc.resize({ cols, rows });
      return true;
    } catch {
      return false;
    }
  }

  return {
    attachProcess,
    handleConnectError,
    isConnected: () => connected,
    resize,
    sendInput,
    stop,
  };
}

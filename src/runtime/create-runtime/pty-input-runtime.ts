import { readPastePayloadFromDataTransfer } from "./clipboard-paste";
import { formatPasteText } from "./format-utils";
import type {
  CursorPosition,
  PtyInputRuntime,
  PtyInputRuntimeOptions,
} from "./pty-input-runtime.types";

export function createPtyInputRuntime(options: PtyInputRuntimeOptions): PtyInputRuntime {
  const {
    ptyTransport,
    ptyOutputBuffer,
    inputHandler,
    getGridSize,
    getResizeMeta,
    getCursorForCpr,
    sendInput,
    runBeforeInputHook,
    shouldClearSelection,
    clearSelection,
    syncOutputResetMs,
    syncOutputResetSeq,
  } = options;
  let lastReportedPtyStatus = "";
  let lastReportedMouseStatus = "";
  let syncOutputResetTimer = 0;

  function setPtyStatus(text: string): void {
    if (text === lastReportedPtyStatus) return;
    lastReportedPtyStatus = text;
    options.emitRuntimeEvent?.({ type: "pty-status", status: text });
  }

  function setMouseStatus(text: string): void {
    if (text === lastReportedMouseStatus) return;
    lastReportedMouseStatus = text;
  }

  function updateMouseStatus(): void {
    const status = inputHandler.getMouseStatus();
    const label = status.active ? `${status.mode} (${status.detail})` : status.mode;
    setMouseStatus(label);
  }

  function cancelPtyOutputFlush(): void {
    ptyOutputBuffer.cancel();
  }

  function cancelSyncOutputReset(): void {
    if (syncOutputResetTimer) {
      clearTimeout(syncOutputResetTimer);
      syncOutputResetTimer = 0;
    }
  }

  function scheduleSyncOutputReset(): void {
    if (syncOutputResetTimer) return;
    syncOutputResetTimer = setTimeout(() => {
      syncOutputResetTimer = 0;
      if (!inputHandler.isSynchronizedOutput()) return;
      const sanitized = inputHandler.filterOutput(syncOutputResetSeq) || syncOutputResetSeq;
      sendInput(sanitized, "pty");
    }, syncOutputResetMs);
  }

  function flushPtyOutputBuffer(): void {
    ptyOutputBuffer.flush();
  }

  function queuePtyOutput(text: string): void {
    ptyOutputBuffer.queue(text);
  }

  function disconnectPty(): void {
    flushPtyOutputBuffer();
    cancelPtyOutputFlush();
    cancelSyncOutputReset();
    ptyOutputBuffer.clear();
    ptyTransport.disconnect();
    updateMouseStatus();
    setPtyStatus("disconnected");
  }

  function connectPty(url = ""): void {
    if (ptyTransport.isConnected()) return;
    const initialGrid = getGridSize();
    setPtyStatus("connecting...");
    try {
      const connectResult = ptyTransport.connect({
        url,
        cols: initialGrid.cols || 80,
        rows: initialGrid.rows || 24,
        callbacks: {
          onConnect: () => {
            setPtyStatus("connected");
            updateMouseStatus();
            const connectedGrid = getGridSize();
            if (connectedGrid.cols && connectedGrid.rows) {
              ptyTransport.resize(
                connectedGrid.cols,
                connectedGrid.rows,
                getResizeMeta?.() ?? undefined,
              );
            }
          },
          onDisconnect: () => {
            setPtyStatus("disconnected");
            updateMouseStatus();
          },
          onStatus: () => {},
          onError: () => {
            disconnectPty();
          },
          onExit: () => {
            disconnectPty();
          },
          onData: (text) => {
            const sanitized = inputHandler.filterOutput(text);
            updateMouseStatus();
            if (sanitized) queuePtyOutput(sanitized);
          },
        },
      });
      Promise.resolve(connectResult).catch((err: unknown) => {
        console.error("[restty] pty connect error", err);
        disconnectPty();
      });
    } catch (err) {
      console.error("[restty] pty connect error", err);
      disconnectPty();
    }
  }

  function sendKeyInput(text: string, source = "key"): void {
    if (!text) return;
    const intercepted = runBeforeInputHook(text, source);
    if (!intercepted) return;
    if (source !== "program" && shouldClearSelection()) {
      clearSelection();
    }
    if (ptyTransport.isConnected()) {
      const payload = inputHandler.mapKeyForPty(intercepted);
      ptyTransport.sendInput(payload);
      return;
    }
    sendInput(intercepted, source, { skipHooks: true });
  }

  function sendPasteText(text: string): void {
    if (!text) return;
    const bracketedPasteEnabled = !!inputHandler.isBracketedPaste();
    sendKeyInput(formatPasteText(text, bracketedPasteEnabled));
  }

  function sendPastePayloadFromDataTransfer(
    dataTransfer: DataTransfer | null | undefined,
  ): boolean {
    const payload = readPastePayloadFromDataTransfer(dataTransfer);
    if (!payload) return false;
    sendPasteText(payload.text);
    return true;
  }

  function getCprPosition(): CursorPosition {
    return getCursorForCpr();
  }

  return {
    setPtyStatus,
    updateMouseStatus,
    scheduleSyncOutputReset,
    cancelSyncOutputReset,
    connectPty,
    disconnectPty,
    sendKeyInput,
    sendPasteText,
    sendPastePayloadFromDataTransfer,
    getCprPosition,
  };
}

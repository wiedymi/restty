import type { InputHandler } from "../../input";
import type { PtyResizeMeta, PtyTransport } from "../../pty";
import type { PtyOutputBufferController } from "./pty-output-buffer";
import { readPastePayloadFromDataTransfer } from "./clipboard-paste";
import { formatPasteText } from "./format-utils";

type CursorPosition = {
  row: number;
  col: number;
};

type SendInput = (text: string, source?: string, options?: { skipHooks?: boolean }) => void;

export type CreatePtyInputRuntimeOptions = {
  ptyTransport: PtyTransport;
  ptyOutputBuffer: PtyOutputBufferController;
  inputHandler: InputHandler;
  ptyStatusEl?: HTMLElement | null;
  mouseStatusEl?: HTMLElement | null;
  onPtyStatus?: ((status: string) => void) | null;
  onMouseStatus?: ((status: string) => void) | null;
  appendLog: (line: string) => void;
  getGridSize: () => { cols: number; rows: number };
  getResizeMeta?: () => PtyResizeMeta | null;
  getCursorForCpr: () => CursorPosition;
  sendInput: SendInput;
  runBeforeInputHook: (text: string, source: string) => string | null;
  shouldClearSelection: () => boolean;
  clearSelection: () => void;
  syncOutputResetMs: number;
  syncOutputResetSeq: string;
};

export type PtyInputRuntime = {
  setPtyStatus: (text: string) => void;
  updateMouseStatus: () => void;
  scheduleSyncOutputReset: () => void;
  cancelSyncOutputReset: () => void;
  connectPty: (url?: string) => void;
  disconnectPty: () => void;
  sendKeyInput: (text: string, source?: string) => void;
  sendPasteText: (text: string) => void;
  sendPastePayloadFromDataTransfer: (dataTransfer: DataTransfer | null | undefined) => boolean;
  getCprPosition: () => CursorPosition;
};

function formatError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message);
  }
  return String(err);
}

export function createPtyInputRuntime(options: CreatePtyInputRuntimeOptions): PtyInputRuntime {
  const {
    ptyTransport,
    ptyOutputBuffer,
    inputHandler,
    ptyStatusEl,
    mouseStatusEl,
    onPtyStatus,
    onMouseStatus,
    appendLog,
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
    if (ptyStatusEl) ptyStatusEl.textContent = text;
    onPtyStatus?.(text);
  }

  function setMouseStatus(text: string): void {
    if (text === lastReportedMouseStatus) return;
    lastReportedMouseStatus = text;
    if (mouseStatusEl) mouseStatusEl.textContent = text;
    onMouseStatus?.(text);
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
            appendLog("[pty] connected");
          },
          onDisconnect: () => {
            appendLog("[pty] disconnected");
            setPtyStatus("disconnected");
            updateMouseStatus();
          },
          onStatus: (shell) => {
            appendLog(`[pty] shell ${shell ?? ""}`);
          },
          onError: (message, errors) => {
            appendLog(`[pty] error ${message ?? ""}`);
            if (errors) {
              for (const err of errors) appendLog(`[pty] spawn ${err}`);
            }
            disconnectPty();
          },
          onExit: (code) => {
            appendLog(`[pty] exit ${code ?? ""}`);
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
        appendLog(`[pty] error ${formatError(err)}`);
        disconnectPty();
      });
    } catch (err) {
      appendLog(`[pty] error ${formatError(err)}`);
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

import type { InputHandler } from "../../input";
import type { PtyResizeMeta, PtyTransport } from "../../pty";
import type { ResttyRuntimeEvent } from "../core/runtime-events";
import type { PtyOutputBufferController } from "./pty-output-buffer";

export type CursorPosition = {
  row: number;
  col: number;
};

export type RuntimeSendInput = (
  text: string,
  source?: string,
  options?: { skipHooks?: boolean },
) => void;

export type PtyInputRuntimeOptions = {
  ptyTransport: PtyTransport;
  ptyOutputBuffer: PtyOutputBufferController;
  inputHandler: InputHandler;
  ptyStatusEl?: HTMLElement | null;
  mouseStatusEl?: HTMLElement | null;
  emitRuntimeEvent?: (event: Extract<ResttyRuntimeEvent, { type: "pty-status" }>) => void;
  onPtyStatus?: ((status: string) => void) | null;
  onMouseStatus?: ((status: string) => void) | null;
  appendLog: (line: string) => void;
  getGridSize: () => { cols: number; rows: number };
  getResizeMeta?: () => PtyResizeMeta | null;
  getCursorForCpr: () => CursorPosition;
  sendInput: RuntimeSendInput;
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

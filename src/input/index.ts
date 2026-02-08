import { encodeBeforeInput, encodeKeyEvent, mapKeyForPty, sequences } from "./keymap";
import { MouseController } from "./mouse";
import { OutputFilter } from "./output";
import type { InputHandler, InputHandlerConfig, InputHandlerOptions, MouseMode } from "./types";

/**
 * Create a terminal input handler with key, IME, PTY, and mouse support.
 */
export function createInputHandler(options: InputHandlerOptions = {}): InputHandler {
  const config: InputHandlerConfig = options.config || {};

  const cursorProvider = options.getCursorPosition || (() => ({ row: 1, col: 1 }));
  const replySink = options.sendReply || (() => {});
  const positionToCell = options.positionToCell || (() => ({ row: 0, col: 0 }));
  const positionToPixel = options.positionToPixel || null;

  const mouse = new MouseController({
    sendReply: replySink,
    positionToCell,
    positionToPixel: positionToPixel ?? undefined,
  });
  const filter = new OutputFilter({
    getCursorPosition: cursorProvider,
    sendReply: replySink,
    mouse,
    getDefaultColors: options.getDefaultColors,
    onClipboardRead: options.onClipboardRead,
    onClipboardWrite: options.onClipboardWrite,
    onWindowOp: options.onWindowOp,
    getWindowMetrics: options.getWindowMetrics,
  });

  return {
    sequences,
    encodeKeyEvent: (event) =>
      encodeKeyEvent(event, config, options.getKittyKeyboardFlags?.() ?? 0),
    encodeBeforeInput,
    mapKeyForPty,
    filterOutput: (output) => filter.filter(output),
    setReplySink: (fn) => {
      mouse.setReplySink(fn);
      filter.setReplySink(fn);
    },
    setCursorProvider: (fn) => {
      filter.setCursorProvider(fn);
    },
    setPositionToCell: (fn) => {
      mouse.setPositionToCell(fn);
    },
    setPositionToPixel: (fn) => {
      mouse.setPositionToPixel(fn);
    },
    setWindowOpHandler: (fn) => {
      filter.setWindowOpHandler(fn);
    },
    setMouseMode: (mode: MouseMode) => {
      mouse.setMode(mode);
    },
    getMouseStatus: () => mouse.getStatus(),
    isMouseActive: () => mouse.isActive(),
    isBracketedPaste: () => filter.isBracketedPaste(),
    isFocusReporting: () => filter.isFocusReporting(),
    isAltScreen: () => filter.isAltScreen(),
    isSynchronizedOutput: () => filter.isSynchronizedOutput(),
    sendMouseEvent: (kind, event) => mouse.sendMouseEvent(kind, event),
  };
}

export type {
  CellPosition,
  CursorPosition,
  InputHandler,
  InputHandlerConfig,
  InputHandlerOptions,
  MouseMode,
  MouseStatus,
} from "./types";

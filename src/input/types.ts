/**
 * 1-based cursor position (terminal coordinates).
 */
export type CursorPosition = {
  row: number;
  col: number;
};

/**
 * 0-based cell coordinates (grid coordinates).
 */
export type CellPosition = {
  row: number;
  col: number;
};

/**
 * Mouse reporting mode.
 * - auto: follow app requests (DECSET/DECRST)
 * - on: always report mouse
 * - off: never report mouse
 */
export type MouseMode = "auto" | "on" | "off";

/**
 * Input handler configuration flags.
 */
export type InputHandlerConfig = {
  /**
   * Encode Ctrl+<key> combos to control characters (default true).
   */
  enableCtrlCombos?: boolean;
};

/** Default terminal colors for OSC 10/11/12 query responses (RGB 0-255). */
export type DefaultColors = {
  fg?: [number, number, number];
  bg?: [number, number, number];
  cursor?: [number, number, number];
};

/** Terminal window metrics for XTWINOPS reporting (CSI 14/16/18 t). */
export type WindowMetrics = {
  rows: number;
  cols: number;
  widthPx: number;
  heightPx: number;
  cellWidthPx: number;
  cellHeightPx: number;
};

/**
 * Parsed window manipulation operation (CSI ... t).
 * - resize: terminal resize request
 * - unknown: unhandled window operation
 */
export type WindowOp =
  | {
      type: "resize";
      rows: number;
      cols: number;
      params: number[];
      raw: string;
    }
  | {
      type: "unknown";
      params: number[];
      raw: string;
    };

/**
 * Input handler construction options.
 */
export type InputHandlerOptions = {
  /**
   * Configuration knobs for key encoding and feature flags.
   */
  config?: InputHandlerConfig;
  /**
   * Provide the current cursor position for CPR replies.
   */
  getCursorPosition?: () => CursorPosition;
  /**
   * Sink for output replies (CPR/DA/mouse).
   */
  sendReply?: (data: string) => void;
  /**
   * Map pointer events to cell coordinates.
   */
  positionToCell?: (event: MouseEvent | PointerEvent | WheelEvent) => CellPosition;
  /**
   * Map pointer events to pixel coordinates (1-based, terminal space).
   */
  positionToPixel?: (event: MouseEvent | PointerEvent | WheelEvent) => { x: number; y: number };
  /**
   * Provide default colors for OSC 10/11/12 queries (RGB 0-255).
   */
  getDefaultColors?: () => DefaultColors;
  /**
   * Optional handler for window manipulation sequences (CSI ... t).
   */
  onWindowOp?: (op: WindowOp) => void;
  /**
   * Optional provider for XTWINOPS report queries (CSI 14/16/18 t).
   */
  getWindowMetrics?: () => WindowMetrics;
  /**
   * Optional clipboard handlers for OSC 52.
   */
  onClipboardWrite?: (text: string) => void | Promise<void>;
  onClipboardRead?: () => string | null | Promise<string | null>;
  /**
   * Return active Kitty keyboard protocol flags (CSI ? u query result).
   */
  getKittyKeyboardFlags?: () => number;
};

/**
 * Exposed mouse status for UI debugging.
 */
export type MouseStatus = {
  mode: MouseMode;
  active: boolean;
  detail: "sgr" | "x10" | "utf8" | "urxvt" | "sgr_pixels";
  enabled: boolean;
};

/**
 * Public input handler API.
 */
export type InputHandler = {
  sequences: {
    enter: string;
    backspace: string;
    delete: string;
    tab: string;
    shiftTab: string;
    escape: string;
  };
  /**
   * Encode a KeyboardEvent into a terminal byte sequence.
   */
  encodeKeyEvent: (event: KeyboardEvent) => string;
  /**
   * Encode a beforeinput event into a terminal byte sequence.
   */
  encodeBeforeInput: (event: InputEvent) => string;
  /**
   * Map encoded sequences to PTY-friendly forms.
   */
  mapKeyForPty: (seq: string) => string;
  /**
   * Filter PTY output and handle control queries (CPR/DA/mouse mode).
   */
  filterOutput: (output: string) => string;
  setReplySink: (fn: (data: string) => void) => void;
  setCursorProvider: (fn: () => CursorPosition) => void;
  setPositionToCell: (fn: (event: MouseEvent | PointerEvent | WheelEvent) => CellPosition) => void;
  setPositionToPixel: (
    fn: (event: MouseEvent | PointerEvent | WheelEvent) => { x: number; y: number },
  ) => void;
  setWindowOpHandler: (fn: (op: WindowOp) => void) => void;
  setMouseMode: (mode: MouseMode) => void;
  getMouseStatus: () => MouseStatus;
  isMouseActive: () => boolean;
  isBracketedPaste: () => boolean;
  isFocusReporting: () => boolean;
  isAltScreen: () => boolean;
  isSynchronizedOutput: () => boolean;
  /**
   * Encode pointer input as terminal mouse events (SGR).
   */
  sendMouseEvent: (
    kind: "down" | "up" | "move" | "wheel",
    event: PointerEvent | WheelEvent,
  ) => boolean;
};

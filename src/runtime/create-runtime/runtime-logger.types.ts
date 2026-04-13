export type RuntimeLogFilter = {
  re: RegExp;
  note: string;
};

export type RuntimeLoggerOptions = {
  logEl?: HTMLElement | null;
  onLog?: ((entry: string) => void) | null;
  logLimit?: number;
  wasmLogFilters?: RuntimeLogFilter[];
};

export type RuntimeLogger = {
  log: (msg: string) => void;
  appendLog: (line: string) => void;
  shouldSuppressWasmLog: (text: string) => boolean;
};

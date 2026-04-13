import type { RuntimeLogFilter, RuntimeLogger, RuntimeLoggerOptions } from "./runtime-logger.types";

const DEFAULT_LOG_LIMIT = 200;
const DEFAULT_WASM_LOG_FILTERS: RuntimeLogFilter[] = [
  {
    re: /warning\\(stream\\): ignoring CSI .* t/i,
    note: "[wasm] note: CSI t window ops not implemented (safe to ignore)",
  },
  {
    re: /warning\\(stream\\): unknown CSI m with intermediate/i,
    note: "[wasm] note: CSI m intermediates ignored (safe to ignore)",
  },
];

export function createRuntimeLogger(options: RuntimeLoggerOptions): RuntimeLogger {
  const logEl = options.logEl ?? null;
  const onLog = options.onLog ?? null;
  const logLimit = options.logLimit ?? DEFAULT_LOG_LIMIT;
  const wasmLogFilters = options.wasmLogFilters ?? DEFAULT_WASM_LOG_FILTERS;
  const logBuffer: string[] = [];
  const wasmLogNotes = new Set<string>();

  function appendLog(line: string): void {
    const timestamp = new Date().toISOString().slice(11, 23);
    const entry = `${timestamp} ${line}`;
    logBuffer.push(entry);
    if (logBuffer.length > logLimit) {
      logBuffer.splice(0, logBuffer.length - logLimit);
    }
    if (logEl) logEl.textContent = line;
    onLog?.(entry);
  }

  function log(msg: string): void {
    appendLog(`[ui] ${msg}`);
  }

  function shouldSuppressWasmLog(text: string): boolean {
    for (const filter of wasmLogFilters) {
      if (!filter.re.test(text)) continue;
      if (!wasmLogNotes.has(filter.note)) {
        wasmLogNotes.add(filter.note);
        appendLog(filter.note);
      }
      return true;
    }
    return false;
  }

  return {
    log,
    appendLog,
    shouldSuppressWasmLog,
  };
}

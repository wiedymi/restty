export const DEFAULT_MAX_SCROLLBACK_BYTES = 10_000_000;
export const MAX_MAX_SCROLLBACK_BYTES = 256_000_000;

type MaxScrollbackOptions = {
  maxScrollbackBytes?: number;
  maxScrollback?: number;
};

export function normalizeMaxScrollbackBytes(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_MAX_SCROLLBACK_BYTES;
  const asInt = Math.trunc(value);
  if (asInt <= 0) return 0;
  if (asInt >= MAX_MAX_SCROLLBACK_BYTES) return MAX_MAX_SCROLLBACK_BYTES;
  return asInt;
}

export function resolveMaxScrollbackBytes(options: MaxScrollbackOptions): number {
  return normalizeMaxScrollbackBytes(options.maxScrollbackBytes ?? options.maxScrollback);
}

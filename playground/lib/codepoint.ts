export function parseCodepointInput(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.startsWith("U+")) {
    const hex = upper.slice(2);
    const cp = Number.parseInt(hex, 16);
    return Number.isFinite(cp) ? cp : null;
  }
  if (upper.startsWith("0X")) {
    const cp = Number.parseInt(upper.slice(2), 16);
    return Number.isFinite(cp) ? cp : null;
  }
  if (/^[0-9A-F]+$/i.test(trimmed) && trimmed.length >= 4) {
    const cp = Number.parseInt(trimmed, 16);
    return Number.isFinite(cp) ? cp : null;
  }
  const codepoint = trimmed.codePointAt(0);
  return codepoint ?? null;
}

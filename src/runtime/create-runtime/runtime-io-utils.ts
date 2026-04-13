export function openLink(uri: string): void {
  if (!uri || typeof window === "undefined") return;
  try {
    const url = new URL(uri, window.location.href);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) return;
    const win = window.open(url.toString(), "_blank", "noopener,noreferrer");
    if (win) win.opener = null;
  } catch {
    // ignore invalid URLs
  }
}

export function sourceLabelFromUrl(url: string, index: number): string {
  const trimmed = url.trim();
  if (!trimmed) return `font-${index + 1}`;
  try {
    const parsed = new URL(trimmed, typeof window !== "undefined" ? window.location.href : "");
    const file = parsed.pathname.split("/").filter(Boolean).pop();
    return file || parsed.hostname || `font-${index + 1}`;
  } catch {
    const parts = trimmed.split("/").filter(Boolean);
    const file = parts[parts.length - 1] ?? "";
    return file || `font-${index + 1}`;
  }
}

export function sourceBufferFromView(view: ArrayBufferView): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = view;
  if (byteOffset === 0 && byteLength === buffer.byteLength) {
    return buffer.slice(0);
  }
  return buffer.slice(byteOffset, byteOffset + byteLength);
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r?\n/g, "\r\n");
}

export function fitTextTailToWidth(
  text: string,
  maxWidthPx: number,
  measureWidthPx: (value: string) => number,
): {
  text: string;
  offset: number;
  widthPx: number;
} {
  if (!text) {
    return { text: "", offset: 0, widthPx: 0 };
  }
  const safeMaxWidth = Number.isFinite(maxWidthPx) ? Math.max(0, maxWidthPx) : 0;
  if (safeMaxWidth <= 0) {
    return { text: "", offset: text.length, widthPx: 0 };
  }

  const fullWidth = measureWidthPx(text);
  if (fullWidth <= safeMaxWidth) {
    return { text, offset: 0, widthPx: fullWidth };
  }

  const boundaries: number[] = [];
  let codeUnitOffset = 0;
  for (const cp of text) {
    boundaries.push(codeUnitOffset);
    codeUnitOffset += cp.length;
  }
  boundaries.push(text.length);

  let fallbackOffset = boundaries[Math.max(0, boundaries.length - 2)] ?? 0;
  let fallbackText = text.slice(fallbackOffset);
  let fallbackWidth = measureWidthPx(fallbackText);

  for (let i = 1; i < boundaries.length - 1; i += 1) {
    const offset = boundaries[i] ?? 0;
    const candidate = text.slice(offset);
    const candidateWidth = measureWidthPx(candidate);
    if (candidateWidth <= safeMaxWidth) {
      return { text: candidate, offset, widthPx: candidateWidth };
    }
    fallbackOffset = offset;
    fallbackText = candidate;
    fallbackWidth = candidateWidth;
  }

  return {
    text: fallbackText,
    offset: fallbackOffset,
    widthPx: Math.min(fallbackWidth, safeMaxWidth),
  };
}

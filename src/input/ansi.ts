const ESC = "\x1b";

/** Parse a DEC private mode set/reset sequence (CSI ? ... h/l) into mode codes and enabled state. */
export function parsePrivateModeSeq(seq: string): { codes: number[]; enabled: boolean } | null {
  if (!seq.startsWith(`${ESC}[?`) || seq.length < 5) return null;
  const final = seq[seq.length - 1];
  if (final !== "h" && final !== "l") return null;
  const body = seq.slice(3, -1);
  if (!body || /[^0-9;]/.test(body)) return null;
  const parts = body.split(";");
  const codes: number[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part) return null;
    const code = Number(part);
    if (!Number.isFinite(code)) return null;
    codes.push(code);
  }
  return { codes, enabled: final === "h" };
}

/** Parse a window manipulation sequence (CSI ... t) into its numeric parameters. */
export function parseWindowOpSeq(seq: string): number[] | null {
  if (!seq.startsWith(`${ESC}[`) || !seq.endsWith("t")) return null;
  const body = seq.slice(2, -1);
  if (/[^0-9;]/.test(body)) return null;
  return body ? body.split(";").map((part) => Number(part)) : [];
}

/** Test whether a CSI sequence is a Device Attributes query (DA1/DA2/DA3). */
export function isDeviceAttributesQuery(seq: string): boolean {
  if (!seq.startsWith(`${ESC}[`) || !seq.endsWith("c")) return false;
  const body = seq.slice(2, -1);
  let i = 0;
  while (i < body.length && (body[i] === "?" || body[i] === ">")) i += 1;
  while (i < body.length && body.charCodeAt(i) >= 48 && body.charCodeAt(i) <= 57) i += 1;
  if (i < body.length && body[i] === ";") {
    i += 1;
    while (i < body.length && body.charCodeAt(i) >= 48 && body.charCodeAt(i) <= 57) i += 1;
  }
  return i === body.length;
}

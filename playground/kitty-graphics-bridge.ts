import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ESC = "\x1b";
const KITTY_APC_PREFIX = "\x1b_G";
const TMUX_DCS_PREFIX = "\x1bPtmux;";
const ST = "\x1b\\";
const BEL = "\x07";

type KittyParam = {
  key: string;
  value: string | null;
};

type ImageSize = {
  width: number;
  height: number;
};

const SIGNED_INT_KEYS = new Set(["z", "H", "V"]);
const CHAR_VALUE_KEYS = new Set(["a", "t", "o", "d"]);
const U32_MAX = 0xffff_ffffn;
const I32_MAX = 0x7fff_ffffn;
const I32_MIN = -0x8000_0000n;
const GHOSTTY_MAX_DIMENSION = 10000;
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

export type KittyGraphicsBridgeOptions = {
  readFile?: (path: string) => Uint8Array;
  trace?: boolean;
};

function parseParams(raw: string): KittyParam[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((part) => part.length > 0)
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq < 0) {
        return { key: part, value: null };
      }
      return {
        key: part.slice(0, eq),
        value: part.slice(eq + 1),
      };
    });
}

function serializeParams(params: KittyParam[]): string {
  return params
    .map((param) => (param.value === null ? param.key : `${param.key}=${param.value}`))
    .join(",");
}

function getParam(params: KittyParam[], key: string): string | null {
  for (const param of params) {
    if (param.key === key) return param.value ?? "";
  }
  return null;
}

function setParam(params: KittyParam[], key: string, value: string) {
  let set = false;
  for (const param of params) {
    if (param.key !== key) continue;
    param.value = value;
    set = true;
  }
  if (!set) {
    params.push({ key, value });
  }
}

function parseIntString(value: string): bigint | null {
  if (!/^[+-]?\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function sanitizeParams(params: KittyParam[]): { params: KittyParam[]; changed: boolean } {
  const out: KittyParam[] = [];
  let changed = false;

  for (const param of params) {
    if (param.key.length !== 1 || param.value === null) {
      changed = true;
      continue;
    }

    const key = param.key;
    const value = param.value;
    if (value.length === 0) {
      changed = true;
      continue;
    }

    if (value.length === 1) {
      out.push(param);
      continue;
    }

    if (CHAR_VALUE_KEYS.has(key)) {
      out.push({ key, value: value[0] });
      changed = true;
      continue;
    }

    const intValue = parseIntString(value);
    if (intValue !== null) {
      if (SIGNED_INT_KEYS.has(key)) {
        const clamped = intValue < I32_MIN ? I32_MIN : intValue > I32_MAX ? I32_MAX : intValue;
        const next = clamped.toString();
        out.push({ key, value: next });
        if (next !== value) changed = true;
      } else {
        const normalized = intValue < 0n ? 0n : intValue > U32_MAX ? U32_MAX : intValue;
        const next = normalized.toString();
        out.push({ key, value: next });
        if (next !== value) changed = true;
      }
      continue;
    }

    // Accept float-like numeric strings from Lua formatting (e.g. "61.0")
    // and normalize them to integer text the Ghostty parser accepts.
    const num = Number(value);
    if (Number.isFinite(num)) {
      if (SIGNED_INT_KEYS.has(key)) {
        const truncated = Math.trunc(num);
        const bounded = Math.max(-2147483648, Math.min(2147483647, truncated));
        const next = String(bounded);
        out.push({ key, value: next });
        if (next !== value) changed = true;
      } else {
        const truncated = Math.trunc(num);
        const bounded = Math.max(0, Math.min(4294967295, truncated));
        const next = String(bounded);
        out.push({ key, value: next });
        if (next !== value) changed = true;
      }
      continue;
    }

    // Unsupported multi-character non-numeric value; drop to avoid parser errors.
    changed = true;
  }

  return { params: out, changed };
}

function dedupeParamsLastWins(params: KittyParam[]): { params: KittyParam[]; changed: boolean } {
  if (params.length <= 1) return { params, changed: false };
  const seen = new Set<string>();
  const outRev: KittyParam[] = [];
  for (let i = params.length - 1; i >= 0; i -= 1) {
    const param = params[i]!;
    if (seen.has(param.key)) continue;
    seen.add(param.key);
    outRev.push(param);
  }
  outRev.reverse();
  return { params: outRev, changed: outRev.length !== params.length };
}

function clampUnsignedParam(params: KittyParam[], key: string, max: number): boolean {
  const current = getParam(params, key);
  if (current === null) return false;
  const n = Number(current);
  if (!Number.isFinite(n)) return false;
  const bounded = Math.max(0, Math.min(max, Math.trunc(n)));
  const next = String(bounded);
  if (next === current) return false;
  setParam(params, key, next);
  return true;
}

function parseUnsigned(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

function decodeBase64ToUtf8(payload: string): string | null {
  const cleaned = payload.replace(/\s+/g, "");
  if (!cleaned) return "";
  try {
    const bytes = Buffer.from(cleaned, "base64");
    if (bytes.length === 0 && cleaned.length > 0) return null;
    const decoded = bytes.toString("utf8");
    if (decoded.includes("\0")) return null;
    return decoded;
  } catch {
    return null;
  }
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return null;
  }
  // "IHDR"
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

type TerminatorMatch = {
  index: number;
  length: 1 | 2;
};

function findApcTerminator(data: string, from: number): TerminatorMatch | null {
  const bel = data.indexOf(BEL, from);
  const st = data.indexOf(ST, from);
  if (bel < 0 && st < 0) return null;
  if (bel < 0) return { index: st, length: 2 };
  if (st < 0) return { index: bel, length: 1 };
  return bel < st ? { index: bel, length: 1 } : { index: st, length: 2 };
}

export class KittyGraphicsBridge {
  private remainder = "";
  private utf16Carry = "";
  private readFile: (path: string) => Uint8Array;
  private trace: boolean;
  private imageSizes = new Map<number, ImageSize>();

  constructor(options?: KittyGraphicsBridgeOptions) {
    this.readFile = options?.readFile ?? ((path: string) => readFileSync(path));
    this.trace = options?.trace ?? false;
  }

  private traceKitty(label: string, params: KittyParam[], payloadLength: number) {
    if (!this.trace) return;
    const keys = ["a", "U", "C", "i", "I", "p", "f", "t", "s", "v", "x", "y", "X", "Y", "w", "h", "c", "r", "z", "m", "q"];
    const summary: string[] = [];
    for (const key of keys) {
      const value = getParam(params, key);
      if (value !== null) summary.push(`${key}=${value}`);
    }
    console.log(
      `[pty] kitty ${label} ${summary.join(" ")} payload=${payloadLength}`,
    );
  }

  private rewriteKittyApcBody(body: string): string {
    if (!body.startsWith("G")) return body;

    const payloadStart = body.indexOf(";");
    const hasPayload = payloadStart >= 0;
    const paramRaw = hasPayload ? body.slice(1, payloadStart) : body.slice(1);
    const payload = hasPayload ? body.slice(payloadStart + 1) : "";
    const rawParams = parseParams(paramRaw);
    const sanitized = sanitizeParams(rawParams);
    const deduped = dedupeParamsLastWins(sanitized.params);
    const params = deduped.params;
    let changed = sanitized.changed || deduped.changed;

    // Normalize potentially invalid/overflowed dimensions emitted by some clients.
    changed = clampUnsignedParam(params, "c", 1000) || changed;
    changed = clampUnsignedParam(params, "r", 1000) || changed;
    changed = clampUnsignedParam(params, "s", GHOSTTY_MAX_DIMENSION) || changed;
    changed = clampUnsignedParam(params, "v", GHOSTTY_MAX_DIMENSION) || changed;
    changed = clampUnsignedParam(params, "w", GHOSTTY_MAX_DIMENSION) || changed;
    changed = clampUnsignedParam(params, "h", GHOSTTY_MAX_DIMENSION) || changed;
    changed = clampUnsignedParam(params, "x", GHOSTTY_MAX_DIMENSION) || changed;
    changed = clampUnsignedParam(params, "y", GHOSTTY_MAX_DIMENSION) || changed;
    changed = clampUnsignedParam(params, "X", GHOSTTY_MAX_DIMENSION) || changed;
    changed = clampUnsignedParam(params, "Y", GHOSTTY_MAX_DIMENSION) || changed;

    changed = this.repairVirtualPlacement(rawParams, params) || changed;

    const medium = (getParam(params, "t") ?? "").toLowerCase();
    const encode = (nextPayload: string) =>
      `G${serializeParams(params)}${hasPayload ? `;${nextPayload}` : ""}`;

    if (medium !== "f" && medium !== "t") {
      if (changed) this.traceKitty("sanitize", params, payload.length);
      return changed ? encode(payload) : body;
    }

    if (!hasPayload) {
      if (changed) this.traceKitty("sanitize-nopayload", params, payload.length);
      return changed ? encode(payload) : body;
    }

    const filePath = decodeBase64ToUtf8(payload);
    if (filePath === null) {
      if (changed) this.traceKitty("sanitize-badpath", params, payload.length);
      return changed ? encode(payload) : body;
    }

    let fileBytes: Uint8Array;
    try {
      fileBytes = this.readFile(filePath);
    } catch {
      if (changed) this.traceKitty("sanitize-readfail", params, payload.length);
      return changed ? encode(payload) : body;
    }

    const format = getParam(params, "f");
    let dims: ImageSize | null = null;
    if (format === "100") {
      dims = parsePngDimensions(fileBytes);
      if (
        dims &&
        (dims.width > GHOSTTY_MAX_DIMENSION || dims.height > GHOSTTY_MAX_DIMENSION)
      ) {
        const resized = this.resizeOversizedPng(filePath);
        if (resized) {
          fileBytes = resized;
          dims = parsePngDimensions(fileBytes);
          this.traceKitty(
            "resize",
            params,
            fileBytes.length,
          );
        }
      }
    } else {
      const width = parseUnsigned(getParam(params, "s"));
      const height = parseUnsigned(getParam(params, "v"));
      if (width && height) dims = { width, height };
    }

    const encoded = Buffer.from(fileBytes).toString("base64");
    setParam(params, "t", "d");
    changed = true;
    if (getParam(params, "m") !== null) {
      setParam(params, "m", "0");
    }
    const imageId = parseUnsigned(getParam(params, "i"));
    if (imageId && dims) {
      this.imageSizes.set(imageId, dims);
    }
    this.traceKitty("rewrite", params, encoded.length);

    return changed ? `G${serializeParams(params)};${encoded}` : body;
  }

  private repairVirtualPlacement(rawParams: KittyParam[], params: KittyParam[]): boolean {
    const action = (getParam(params, "a") ?? "").toLowerCase();
    if (action !== "p") return false;
    if (getParam(params, "U") !== "1") return false;

    let changed = false;
    const imageId = parseUnsigned(getParam(params, "i"));
    const size = imageId ? this.imageSizes.get(imageId) : null;
    if (!size || size.width <= 0 || size.height <= 0) return false;

    const hadRawC = rawParams.some((param) => param.key === "c");
    const hadRawR = rawParams.some((param) => param.key === "r");
    const cols = parseUnsigned(getParam(params, "c"));
    const rows = parseUnsigned(getParam(params, "r"));

    if (hadRawC && cols === null && rows && rows > 0) {
      const guessed = Math.max(1, Math.min(1000, Math.round((rows * size.width) / size.height)));
      setParam(params, "c", String(guessed));
      changed = true;
    }

    if (hadRawR && rows === null) {
      const nextCols = parseUnsigned(getParam(params, "c"));
      if (nextCols && nextCols > 0) {
        const guessed = Math.max(1, Math.min(1000, Math.round((nextCols * size.height) / size.width)));
        setParam(params, "r", String(guessed));
        changed = true;
      }
    }

    return changed;
  }

  private resizeOversizedPng(sourcePath: string): Uint8Array | null {
    if (typeof Bun === "undefined" || typeof Bun.spawnSync !== "function") return null;

    const dir = mkdtempSync(join(tmpdir(), "restty-kitty-resize-"));
    const outPath = join(dir, "resized.png");
    try {
      const proc = Bun.spawnSync([
        "/usr/bin/sips",
        "-s",
        "format",
        "png",
        "-Z",
        String(GHOSTTY_MAX_DIMENSION),
        sourcePath,
        "--out",
        outPath,
      ]);
      if (proc.exitCode !== 0) return null;
      return readFileSync(outPath);
    } catch {
      return null;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  private unwrapTmuxPassthrough(data: string): string {
    let out = "";
    let cursor = 0;

    while (cursor < data.length) {
      const start = data.indexOf(TMUX_DCS_PREFIX, cursor);
      if (start < 0) {
        out += data.slice(cursor);
        break;
      }

      out += data.slice(cursor, start);
      let j = start + TMUX_DCS_PREFIX.length;
      let foundEnd = false;
      while (j < data.length) {
        const ch = data[j];
        if (ch !== ESC) {
          out += ch;
          j += 1;
          continue;
        }

        if (j + 1 >= data.length) {
          this.remainder = data.slice(start);
          return out;
        }

        const next = data[j + 1];
        if (next === ESC) {
          out += ESC;
          j += 2;
          continue;
        }
        if (next === "\\") {
          foundEnd = true;
          j += 2;
          break;
        }

        // Unexpected escape form inside tmux payload; keep it verbatim.
        out += ESC;
        j += 1;
      }

      if (!foundEnd) {
        this.remainder = data.slice(start);
        return out;
      }

      cursor = j;
    }

    return out;
  }

  transform(chunk: string): string {
    if (!chunk) return "";

    let text = chunk;
    if (this.utf16Carry) {
      text = this.utf16Carry + text;
      this.utf16Carry = "";
    }

    if (text.length > 0) {
      const tail = text.charCodeAt(text.length - 1);
      if (tail >= 0xd800 && tail <= 0xdbff) {
        this.utf16Carry = text.slice(-1);
        text = text.slice(0, -1);
      }
    }
    if (!text) return "";

    const input = this.remainder + text;
    this.remainder = "";
    const data = this.unwrapTmuxPassthrough(input);

    let out = "";
    let cursor = 0;

    while (cursor < data.length) {
      const start = data.indexOf(KITTY_APC_PREFIX, cursor);
      if (start < 0) {
        out += data.slice(cursor);
        break;
      }

      out += data.slice(cursor, start);
      const term = findApcTerminator(data, start + KITTY_APC_PREFIX.length);
      if (!term) {
        this.remainder = data.slice(start);
        break;
      }

      const body = data.slice(start + 2, term.index);
      const rewritten = this.rewriteKittyApcBody(body);
      out += `${ESC}_${rewritten}${data.slice(term.index, term.index + term.length)}`;
      cursor = term.index + term.length;
    }

    return out;
  }
}

export function createKittyGraphicsBridge(options?: KittyGraphicsBridgeOptions) {
  return new KittyGraphicsBridge(options);
}

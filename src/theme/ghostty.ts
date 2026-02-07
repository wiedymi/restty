export type ThemeColor = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

export type GhosttyTheme = {
  name?: string;
  colors: {
    background?: ThemeColor;
    foreground?: ThemeColor;
    cursor?: ThemeColor;
    cursorText?: ThemeColor;
    selectionBackground?: ThemeColor;
    selectionForeground?: ThemeColor;
    palette: Array<ThemeColor | undefined>;
  };
  raw: Record<string, string>;
};

const BASIC_COLOR_NAMES: Record<string, ThemeColor> = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 255, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  yellow: { r: 255, g: 255, b: 0 },
  cyan: { r: 0, g: 255, b: 255 },
  magenta: { r: 255, g: 0, b: 255 },
  gray: { r: 128, g: 128, b: 128 },
  grey: { r: 128, g: 128, b: 128 },
};

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(value: string): ThemeColor | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const raw = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const hex = raw.toLowerCase();
  if (!/^[0-9a-f]+$/i.test(hex)) return null;

  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b };
  }

  if (hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = parseInt(hex[3] + hex[3], 16);
    return { r, g, b, a };
  }

  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  if (hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = parseInt(hex.slice(6, 8), 16);
    return { r, g, b, a };
  }

  return null;
}

function parseRgbColor(value: string): ThemeColor | null {
  const match = value.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(",").map((p) => p.trim());
  if (parts.length < 3) return null;
  const rgb = parts.slice(0, 3).map((p) => {
    if (p.endsWith("%")) {
      const v = parseFloat(p.slice(0, -1));
      return clampByte((v / 100) * 255);
    }
    return clampByte(Number.parseFloat(p));
  });
  let a: number | undefined;
  if (parts.length >= 4) {
    const alphaRaw = parts[3];
    if (alphaRaw.endsWith("%")) {
      const v = parseFloat(alphaRaw.slice(0, -1));
      a = clampByte((v / 100) * 255);
    } else {
      const v = Number.parseFloat(alphaRaw);
      a = clampByte(v <= 1 ? v * 255 : v);
    }
  }
  return { r: rgb[0]!, g: rgb[1]!, b: rgb[2]!, a };
}

function parseNamedColor(value: string): ThemeColor | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  if (BASIC_COLOR_NAMES[key]) return BASIC_COLOR_NAMES[key]!;
  if (typeof document !== "undefined") {
    const el = document.createElement("span");
    el.style.color = key;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    el.remove();
    const parsed = parseRgbColor(computed);
    if (parsed) return parsed;
  }
  return null;
}

export function parseGhosttyColor(value: string): ThemeColor | null {
  return parseHexColor(value) || parseRgbColor(value) || parseNamedColor(value);
}

export function colorToFloats(
  color: ThemeColor,
  alphaOverride?: number,
): [number, number, number, number] {
  const a = alphaOverride ?? color.a ?? 255;
  return [color.r / 255, color.g / 255, color.b / 255, a / 255];
}

export function colorToRgbU32(color: ThemeColor): number {
  return ((color.r & 0xff) << 16) | ((color.g & 0xff) << 8) | (color.b & 0xff);
}

export function parseGhosttyTheme(text: string): GhosttyTheme {
  const raw: Record<string, string> = {};
  // eslint-disable-next-line unicorn/no-new-array
  const palette: Array<ThemeColor | undefined> = new Array(256).fill(undefined);
  const colors: GhosttyTheme["colors"] = { palette };

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#") || trimmed.startsWith(";") || trimmed.startsWith("//")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }

    raw[key] = value;

    if (key === "palette") {
      const match = value.match(/^(\d+)\s*=\s*(.+)$/);
      if (!match) continue;
      const idx = Number.parseInt(match[1]!, 10);
      if (!Number.isFinite(idx) || idx < 0 || idx > 255) continue;
      const color = parseGhosttyColor(match[2]!);
      if (color) palette[idx] = color;
      continue;
    }

    const color = parseGhosttyColor(value);
    if (!color) continue;

    switch (key) {
      case "background":
        colors.background = color;
        break;
      case "foreground":
        colors.foreground = color;
        break;
      case "cursor-color":
        colors.cursor = color;
        break;
      case "cursor-text":
        colors.cursorText = color;
        break;
      case "selection-background":
        colors.selectionBackground = color;
        break;
      case "selection-foreground":
        colors.selectionForeground = color;
        break;
      default:
        break;
    }
  }

  return {
    name: raw.name,
    colors,
    raw,
  };
}

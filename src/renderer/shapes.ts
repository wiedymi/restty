import { BOX_LINE_MAP } from "./box-drawing-map";
import type { NerdConstraint } from "../fonts/nerd-constraints";

/** RGBA color tuple with components in 0-1 range. */
export type Color = [number, number, number, number];
/** Flat array of rect instance data (x, y, w, h, r, g, b, a per rect). */
export type RectData = number[];

/**
 * Font metrics used for Nerd Font glyph constraint calculations.
 */
export type NerdMetrics = {
  /** Cell width in pixels. */
  cellWidth: number;
  /** Cell height in pixels. */
  cellHeight: number;
  /** Font face bounding-box width. */
  faceWidth: number;
  /** Font face bounding-box height. */
  faceHeight: number;
  /** Vertical offset of the font face within the cell. */
  faceY: number;
  /** Target icon height for multi-cell-width glyphs. */
  iconHeight: number;
  /** Target icon height for single-cell-width glyphs. */
  iconHeightSingle: number;
};

/** Positioned bounding box for a rendered glyph. */
export type GlyphBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Box-drawing line style: no line. */
export const BOX_STYLE_NONE = 0;
/** Box-drawing line style: thin/light stroke. */
export const BOX_STYLE_LIGHT = 1;
/** Box-drawing line style: thick/heavy stroke. */
export const BOX_STYLE_HEAVY = 2;
/** Box-drawing line style: double parallel strokes. */
export const BOX_STYLE_DOUBLE = 3;

/** Test whether a codepoint falls in a Unicode Private Use Area. */
export function isPrivateUse(cp: number): boolean {
  return (
    (cp >= 0xe000 && cp <= 0xf8ff) ||
    (cp >= 0xf0000 && cp <= 0xffffd) ||
    (cp >= 0x100000 && cp <= 0x10fffd)
  );
}

/** Test whether a codepoint is a space-like character (NUL, SP, or EN SPACE). */
export function isSpaceCp(cp: number): boolean {
  return cp === 0 || cp === 0x20 || cp === 0x2002;
}

/** Test whether a codepoint is in the Box Drawing block (U+2500-U+257F). */
export function isBoxDrawing(cp: number): boolean {
  return cp >= 0x2500 && cp <= 0x257f;
}

/** Test whether a codepoint is in the Block Elements block (U+2580-U+259F). */
export function isBlockElement(cp: number): boolean {
  return cp >= 0x2580 && cp <= 0x259f;
}

/** Test whether a codepoint is in the Legacy Computing Symbols blocks. */
export function isLegacyComputing(cp: number): boolean {
  return (cp >= 0x1fb00 && cp <= 0x1fbff) || (cp >= 0x1cc00 && cp <= 0x1cebf);
}

/** Test whether a codepoint is a Powerline symbol (U+E0B0-U+E0D7). */
export function isPowerline(cp: number): boolean {
  return cp >= 0xe0b0 && cp <= 0xe0d7;
}

/** Test whether a codepoint is in the Braille Patterns block (U+2800-U+28FF). */
export function isBraille(cp: number): boolean {
  return cp >= 0x2800 && cp <= 0x28ff;
}

/** Test whether a codepoint is any GPU-drawable graphics element (box, block, legacy, powerline). */
export function isGraphicsElement(cp: number): boolean {
  return isBoxDrawing(cp) || isBlockElement(cp) || isLegacyComputing(cp) || isPowerline(cp);
}

/** Test whether a codepoint is a symbol that may need special rendering (PUA or graphics). */
export function isSymbolCp(cp: number): boolean {
  return isPrivateUse(cp) || isGraphicsElement(cp);
}

/** Return a new color with its alpha channel multiplied by the given factor. */
export function applyAlpha(color: Color, alpha: number): Color {
  return [color[0], color[1], color[2], color[3] * alpha];
}

/** Append a rect instance (position, size, color) to the output array. */
export function pushRect(
  out: RectData,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
): void {
  out.push(x, y, w, h, color[0], color[1], color[2], color[3]);
}

/** Append a rect snapped to pixel boundaries (floor origin, ceil extent). */
export function pushRectSnapped(
  out: RectData,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
): void {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + w);
  const y1 = Math.ceil(y + h);
  const width = Math.max(0, x1 - x0);
  const height = Math.max(0, y1 - y0);
  if (width <= 0 || height <= 0) return;
  out.push(x0, y0, width, height, color[0], color[1], color[2], color[3]);
}

/** Append a rect with rounded position and at-least-1px dimensions for box drawing. */
export function pushRectBox(
  out: RectData,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  if (width <= 0 || height <= 0) return;
  out.push(x0, y0, width, height, color[0], color[1], color[2], color[3]);
}

// Fractional fill helper
function fillFrac(
  out: RectData,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  fx0: number,
  fx1: number,
  fy0: number,
  fy1: number,
  color: Color,
): void {
  const px0 = x + cellW * fx0;
  const px1 = x + cellW * fx1;
  const py0 = y + cellH * fy0;
  const py1 = y + cellH * fy1;
  pushRectSnapped(out, px0, py0, px1 - px0, py1 - py0, color);
}

/** Rasterize a Unicode Block Element (U+2580-U+259F) into rect instances. */
export function drawBlockElement(
  cp: number,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  color: Color,
  out: RectData,
): boolean {
  const full = () => pushRectSnapped(out, x, y, cellW, cellH, color);
  const lower = (fraction: number) =>
    fillFrac(out, x, y, cellW, cellH, 0, 1, 1 - fraction, 1, color);
  const upper = (fraction: number) => fillFrac(out, x, y, cellW, cellH, 0, 1, 0, fraction, color);
  const left = (fraction: number) => fillFrac(out, x, y, cellW, cellH, 0, fraction, 0, 1, color);
  const right = (fraction: number) =>
    fillFrac(out, x, y, cellW, cellH, 1 - fraction, 1, 0, 1, color);

  switch (cp) {
    case 0x2580:
      upper(0.5);
      return true;
    case 0x2581:
      lower(0.125);
      return true;
    case 0x2582:
      lower(0.25);
      return true;
    case 0x2583:
      lower(0.375);
      return true;
    case 0x2584:
      lower(0.5);
      return true;
    case 0x2585:
      lower(0.625);
      return true;
    case 0x2586:
      lower(0.75);
      return true;
    case 0x2587:
      lower(0.875);
      return true;
    case 0x2588:
      full();
      return true;
    case 0x2589:
      left(0.875);
      return true;
    case 0x258a:
      left(0.75);
      return true;
    case 0x258b:
      left(0.625);
      return true;
    case 0x258c:
      left(0.5);
      return true;
    case 0x258d:
      left(0.375);
      return true;
    case 0x258e:
      left(0.25);
      return true;
    case 0x258f:
      left(0.125);
      return true;
    case 0x2590:
      right(0.5);
      return true;
    case 0x2591:
      pushRectSnapped(out, x, y, cellW, cellH, applyAlpha(color, 0.25));
      return true;
    case 0x2592:
      pushRectSnapped(out, x, y, cellW, cellH, applyAlpha(color, 0.5));
      return true;
    case 0x2593:
      pushRectSnapped(out, x, y, cellW, cellH, applyAlpha(color, 0.75));
      return true;
    case 0x2594:
      upper(0.125);
      return true;
    case 0x2595:
      right(0.125);
      return true;
    case 0x2596:
      fillFrac(out, x, y, cellW, cellH, 0, 0.5, 0.5, 1, color);
      return true;
    case 0x2597:
      fillFrac(out, x, y, cellW, cellH, 0.5, 1, 0.5, 1, color);
      return true;
    case 0x2598:
      fillFrac(out, x, y, cellW, cellH, 0, 0.5, 0, 0.5, color);
      return true;
    case 0x2599:
      fillFrac(out, x, y, cellW, cellH, 0, 0.5, 0, 1, color);
      fillFrac(out, x, y, cellW, cellH, 0.5, 1, 0.5, 1, color);
      return true;
    case 0x259a:
      fillFrac(out, x, y, cellW, cellH, 0, 0.5, 0, 0.5, color);
      fillFrac(out, x, y, cellW, cellH, 0.5, 1, 0.5, 1, color);
      return true;
    case 0x259b:
      fillFrac(out, x, y, cellW, cellH, 0, 1, 0, 0.5, color);
      fillFrac(out, x, y, cellW, cellH, 0, 0.5, 0.5, 1, color);
      return true;
    case 0x259c:
      fillFrac(out, x, y, cellW, cellH, 0, 1, 0, 0.5, color);
      fillFrac(out, x, y, cellW, cellH, 0.5, 1, 0.5, 1, color);
      return true;
    case 0x259d:
      fillFrac(out, x, y, cellW, cellH, 0.5, 1, 0, 0.5, color);
      return true;
    case 0x259e:
      fillFrac(out, x, y, cellW, cellH, 0.5, 1, 0, 0.5, color);
      fillFrac(out, x, y, cellW, cellH, 0, 0.5, 0.5, 1, color);
      return true;
    case 0x259f:
      fillFrac(out, x, y, cellW, cellH, 0.5, 1, 0, 1, color);
      fillFrac(out, x, y, cellW, cellH, 0, 0.5, 0.5, 1, color);
      return true;
    default:
      return false;
  }
}

/**
 * Rasterize a Unicode Box Drawing character (U+2500-U+257F) into rect instances.
 * Handles straight segments, dashed lines, rounded corners, and diagonal lines.
 */
export function drawBoxDrawing(
  cp: number,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  color: Color,
  out: RectData,
): boolean {
  const spec = BOX_LINE_MAP.get(cp);
  if (!spec) {
    const minDim = Math.min(cellW, cellH);
    const light = Math.max(1, Math.round(minDim * 0.08));
    const heavy = Math.max(light + 1, Math.round(light * 1.8));

    const dashedH = (count: number, thickness: number) => {
      const gap = Math.max(1, Math.round(thickness));
      const totalGap = gap * (count - 1);
      const seg = Math.max(1, Math.floor((cellW - totalGap) / count));
      const y0 = y + cellH * 0.5 - thickness * 0.5;
      let px = x;
      for (let i = 0; i < count; i += 1) {
        pushRectBox(out, px, y0, seg, thickness, color);
        px += seg + gap;
      }
    };

    const dashedV = (count: number, thickness: number) => {
      const gap = Math.max(1, Math.round(thickness));
      const totalGap = gap * (count - 1);
      const seg = Math.max(1, Math.floor((cellH - totalGap) / count));
      const x0 = x + cellW * 0.5 - thickness * 0.5;
      let py = y;
      for (let i = 0; i < count; i += 1) {
        pushRectBox(out, x0, py, thickness, seg, color);
        py += seg + gap;
      }
    };

    const drawDiagonal = (dir: "ul_lr" | "ur_ll") => {
      const thickness = light;
      const steps = Math.max(2, Math.round(Math.max(cellW, cellH)));
      for (let i = 0; i < steps; i += 1) {
        const t = steps === 1 ? 0 : i / (steps - 1);
        const px = dir === "ul_lr" ? x + t * cellW : x + (1 - t) * cellW;
        const py = y + t * cellH;
        pushRectBox(out, px - thickness * 0.5, py - thickness * 0.5, thickness, thickness, color);
      }
    };

    // Draw rounded corner box drawing characters (matching Ghostty's approach)
    // Control points go INWARD toward center for a tighter curve that doesn't bulge into the box
    const drawArc = (corner: "tl" | "tr" | "bl" | "br") => {
      const thickness = light;
      const halfThick = thickness * 0.5;
      const cx = x + cellW * 0.5;
      const cy = y + cellH * 0.5;
      const r = Math.min(cellW, cellH) * 0.5;
      const steps = Math.max(24, Math.round(r * 4));

      // Control point factor - small value pulls curve INWARD toward center
      const s = 0.25;

      const cubicBezier = (
        x0: number,
        y0: number,
        cx1: number,
        cy1: number,
        cx2: number,
        cy2: number,
        x1: number,
        y1: number,
      ) => {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const mt = 1 - t;
          const px =
            mt * mt * mt * x0 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x1;
          const py =
            mt * mt * mt * y0 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y1;
          pushRectBox(out, px - halfThick, py - halfThick, thickness, thickness, color);
        }
      };

      if (corner === "br") {
        // ╭: curve from (cx, cy+r) to (cx+r, cy), control points toward center
        pushRectBox(out, cx - halfThick, cy + r, thickness, y + cellH - (cy + r), color);
        cubicBezier(
          cx,
          cy + r, // start: below center
          cx,
          cy + s * r, // C1: above start, toward center
          cx + s * r,
          cy, // C2: left of end, toward center
          cx + r,
          cy, // end: right of center
        );
        pushRectBox(out, cx + r, cy - halfThick, x + cellW - (cx + r), thickness, color);
      } else if (corner === "bl") {
        // ╮: curve from (cx, cy+r) to (cx-r, cy)
        pushRectBox(out, cx - halfThick, cy + r, thickness, y + cellH - (cy + r), color);
        cubicBezier(cx, cy + r, cx, cy + s * r, cx - s * r, cy, cx - r, cy);
        pushRectBox(out, x, cy - halfThick, cx - r - x, thickness, color);
      } else if (corner === "tl") {
        // ╯: curve from (cx, cy-r) to (cx-r, cy)
        pushRectBox(out, cx - halfThick, y, thickness, cy - r - y, color);
        cubicBezier(cx, cy - r, cx, cy - s * r, cx - s * r, cy, cx - r, cy);
        pushRectBox(out, x, cy - halfThick, cx - r - x, thickness, color);
      } else {
        // ╰: curve from (cx, cy-r) to (cx+r, cy)
        pushRectBox(out, cx - halfThick, y, thickness, cy - r - y, color);
        cubicBezier(cx, cy - r, cx, cy - s * r, cx + s * r, cy, cx + r, cy);
        pushRectBox(out, cx + r, cy - halfThick, x + cellW - (cx + r), thickness, color);
      }
    };

    switch (cp) {
      case 0x2504:
        dashedH(3, light);
        return true;
      case 0x2505:
        dashedH(3, heavy);
        return true;
      case 0x2508:
        dashedH(4, light);
        return true;
      case 0x2509:
        dashedH(4, heavy);
        return true;
      case 0x2506:
        dashedV(3, light);
        return true;
      case 0x2507:
        dashedV(3, heavy);
        return true;
      case 0x250a:
        dashedV(4, light);
        return true;
      case 0x250b:
        dashedV(4, heavy);
        return true;
      case 0x254c:
        dashedH(2, light);
        return true;
      case 0x254d:
        dashedH(2, heavy);
        return true;
      case 0x254e:
        dashedV(2, light);
        return true;
      case 0x254f:
        dashedV(2, heavy);
        return true;
      case 0x256d:
        // ╭ - curve at bottom-right of center, lines to bottom and right edges
        drawArc("br");
        return true;
      case 0x256e:
        // ╮ - curve at bottom-left of center, lines to bottom and left edges
        drawArc("bl");
        return true;
      case 0x256f:
        // ╯ - curve at top-left of center, lines to top and left edges
        drawArc("tl");
        return true;
      case 0x2570:
        // ╰ - curve at top-right of center, lines to top and right edges
        drawArc("tr");
        return true;
      case 0x2571:
        drawDiagonal("ur_ll");
        return true;
      case 0x2572:
        drawDiagonal("ul_lr");
        return true;
      case 0x2573:
        drawDiagonal("ul_lr");
        drawDiagonal("ur_ll");
        return true;
      default:
        return false;
    }
  }

  const [up, right, down, left] = spec;
  const minDim = Math.min(cellW, cellH);
  const light = Math.max(1, Math.round(minDim * 0.08));
  const heavy = Math.max(light + 1, Math.round(light * 1.8));
  const gap = Math.max(1, Math.round(light));
  const cx = x + cellW * 0.5;
  const cy = y + cellH * 0.5;

  const drawH = (style: number, x0: number, x1: number) => {
    if (style === BOX_STYLE_NONE) return;
    if (x1 <= x0) return;
    const thickness = style === BOX_STYLE_HEAVY ? heavy : light;
    const t = Math.max(1, Math.round(thickness));
    if (style === BOX_STYLE_DOUBLE) {
      const offset = (gap + t) * 0.5;
      const y0 = cy - offset - t * 0.5;
      const y1 = cy + offset - t * 0.5;
      pushRectSnapped(out, x0, y0, x1 - x0, t, color);
      pushRectSnapped(out, x0, y1, x1 - x0, t, color);
      return;
    }
    const y0 = cy - t * 0.5;
    pushRectSnapped(out, x0, y0, x1 - x0, t, color);
  };

  const drawV = (style: number, y0: number, y1: number) => {
    if (style === BOX_STYLE_NONE) return;
    if (y1 <= y0) return;
    const thickness = style === BOX_STYLE_HEAVY ? heavy : light;
    const t = Math.max(1, Math.round(thickness));
    if (style === BOX_STYLE_DOUBLE) {
      const offset = (gap + t) * 0.5;
      const x0 = cx - offset - t * 0.5;
      const x1 = cx + offset - t * 0.5;
      pushRectSnapped(out, x0, y0, t, y1 - y0, color);
      pushRectSnapped(out, x1, y0, t, y1 - y0, color);
      return;
    }
    const x0 = cx - t * 0.5;
    pushRectSnapped(out, x0, y0, t, y1 - y0, color);
  };

  if (left !== BOX_STYLE_NONE && left === right) drawH(left, x, x + cellW);
  else {
    drawH(left, x, cx);
    drawH(right, cx, x + cellW);
  }

  if (up !== BOX_STYLE_NONE && up === down) drawV(up, y, y + cellH);
  else {
    drawV(up, y, cy);
    drawV(down, cy, y + cellH);
  }

  return true;
}

/** Rasterize a Unicode Braille Pattern (U+2800-U+28FF) into rect dot instances. */
export function drawBraille(
  cp: number,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  color: Color,
  out: RectData,
): boolean {
  if (!isBraille(cp)) return false;
  const bits = cp - 0x2800;
  if (!bits) return true;

  const dotW = Math.max(1, Math.round(cellW * 0.18));
  const dotH = Math.max(1, Math.round(cellH * 0.18));
  const colX = [x + cellW * 0.25 - dotW * 0.5, x + cellW * 0.75 - dotW * 0.5];
  const rowY = [
    y + cellH * 0.125 - dotH * 0.5,
    y + cellH * 0.375 - dotH * 0.5,
    y + cellH * 0.625 - dotH * 0.5,
    y + cellH * 0.875 - dotH * 0.5,
  ];
  const dots: [number, number, number][] = [
    [0, 0, 0x01],
    [0, 1, 0x02],
    [0, 2, 0x04],
    [1, 0, 0x08],
    [1, 1, 0x10],
    [1, 2, 0x20],
    [0, 3, 0x40],
    [1, 3, 0x80],
  ];
  for (const [cx, cy, mask] of dots) {
    if (bits & mask) {
      pushRectSnapped(out, colX[cx]!, rowY[cy]!, dotW, dotH, color);
    }
  }
  return true;
}

/** Rasterize a Powerline glyph (U+E0B0-U+E0D7) into rect scanline instances. */
export function drawPowerline(
  cp: number,
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  color: Color,
  out: RectData,
): boolean {
  if (!isPowerline(cp)) return false;

  const w = cellW;
  const h = cellH;
  const steps = Math.max(2, Math.round(Math.max(w, h)));

  const drawTriangle = (mode: string) => {
    for (let i = 0; i < steps; i += 1) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const py = y + t * h;
      let x0 = x;
      let x1 = x + w;
      if (mode === "right") {
        const span = w * (1 - Math.abs(t - 0.5) * 2);
        x1 = x + span;
      } else if (mode === "left") {
        const span = w * (1 - Math.abs(t - 0.5) * 2);
        x0 = x + (w - span);
      } else if (mode === "diag_ul_lr") {
        x1 = x + t * w;
      } else if (mode === "diag_ur_ll") {
        x0 = x + t * w;
      } else if (mode === "diag_ul_lr_inv") {
        x1 = x + (1 - t) * w;
      } else if (mode === "diag_ur_ll_inv") {
        x0 = x + (1 - t) * w;
      }
      pushRectSnapped(out, x0, py, Math.max(1, x1 - x0), 1, color);
    }
  };

  switch (cp) {
    case 0xe0b0:
      drawTriangle("right");
      return true;
    case 0xe0b2:
      drawTriangle("left");
      return true;
    case 0xe0b8:
      drawTriangle("diag_ul_lr");
      return true;
    case 0xe0ba:
      drawTriangle("diag_ur_ll");
      return true;
    case 0xe0bc:
      drawTriangle("diag_ul_lr_inv");
      return true;
    case 0xe0be:
      drawTriangle("diag_ur_ll_inv");
      return true;
    case 0xe0b9:
    case 0xe0bb:
    case 0xe0bd:
    case 0xe0bf:
    case 0xe0b1:
    case 0xe0b3:
      drawTriangle(cp === 0xe0b9 || cp === 0xe0bf ? "diag_ul_lr" : "diag_ur_ll");
      return true;
    default:
      return false;
  }
}

/**
 * Apply a Nerd Font constraint to a glyph bounding box, adjusting size and
 * alignment to fit within the cell according to the constraint rules.
 */
export function constrainGlyphBox(
  glyph: GlyphBox,
  constraint: NerdConstraint,
  metrics: NerdMetrics,
  constraintWidth: number,
): GlyphBox {
  if (!constraint) return glyph;

  const sizeMode = constraint.size ?? "none";
  const alignH = constraint.align_horizontal ?? "none";
  const alignV = constraint.align_vertical ?? "none";
  const padLeft = constraint.pad_left ?? 0;
  const padRight = constraint.pad_right ?? 0;
  const padTop = constraint.pad_top ?? 0;
  const padBottom = constraint.pad_bottom ?? 0;
  const relW = constraint.relative_width ?? 1;
  const relH = constraint.relative_height ?? 1;
  const relX = constraint.relative_x ?? 0;
  const relY = constraint.relative_y ?? 0;
  const maxWidth = constraint.max_constraint_width ?? 2;
  const minConstraintWidth = Math.min(constraintWidth, maxWidth);

  if (glyph.width <= 0 || glyph.height <= 0) return glyph;

  const groupWidth = glyph.width / relW;
  const groupHeight = glyph.height / relH;
  let groupX = glyph.x - groupWidth * relX;
  let groupY = glyph.y - groupHeight * relY;

  const padWidthFactor = minConstraintWidth - (padLeft + padRight);
  const padHeightFactor = 1 - (padBottom + padTop);
  const targetWidth = padWidthFactor * metrics.faceWidth;
  const baseHeight =
    (constraint.height ?? "cell") === "icon"
      ? minConstraintWidth > 1
        ? metrics.iconHeight
        : metrics.iconHeightSingle
      : metrics.faceHeight;
  const targetHeight = padHeightFactor * baseHeight;

  let widthFactor = targetWidth / groupWidth;
  let heightFactor = targetHeight / groupHeight;

  const scaleDownFit = Math.min(1, widthFactor, heightFactor);
  const scaleCover = Math.min(widthFactor, heightFactor);

  if (sizeMode === "fit") {
    widthFactor = scaleDownFit;
    heightFactor = scaleDownFit;
  } else if (sizeMode === "cover") {
    widthFactor = scaleCover;
    heightFactor = scaleCover;
  } else if (sizeMode === "fit_cover1") {
    widthFactor = scaleCover;
    heightFactor = scaleCover;
    if (minConstraintWidth > 1 && heightFactor > 1) {
      const single = constrainGlyphBox(
        { x: 0, y: 0, width: groupWidth, height: groupHeight },
        { ...constraint, max_constraint_width: 1 },
        metrics,
        1,
      );
      const singleScale = single.height / groupHeight;
      heightFactor = Math.max(1, singleScale);
      widthFactor = heightFactor;
    }
  } else if (sizeMode === "stretch") {
    // keep widthFactor/heightFactor
  } else {
    widthFactor = 1;
    heightFactor = 1;
  }

  if (constraint.max_xy_ratio !== undefined && constraint.max_xy_ratio !== null) {
    const ratio = constraint.max_xy_ratio;
    if (groupWidth * widthFactor > groupHeight * heightFactor * ratio) {
      widthFactor = (groupHeight * heightFactor * ratio) / groupWidth;
    }
  }

  const centerX = groupX + groupWidth * 0.5;
  const centerY = groupY + groupHeight * 0.5;
  const scaledGroupWidth = groupWidth * widthFactor;
  const scaledGroupHeight = groupHeight * heightFactor;
  groupX = centerX - scaledGroupWidth * 0.5;
  groupY = centerY - scaledGroupHeight * 0.5;

  const padBottomDy = padBottom * metrics.faceHeight;
  const padTopDy = padTop * metrics.faceHeight;
  const startY = metrics.faceY + padBottomDy;
  const endY = metrics.faceY + (metrics.faceHeight - scaledGroupHeight - padTopDy);
  const centerYAligned = (startY + endY) * 0.5;

  if (!(sizeMode === "none" && alignV === "none")) {
    if (alignV === "start") groupY = startY;
    else if (alignV === "end") groupY = endY;
    else if (alignV === "center" || alignV === "center1") groupY = centerYAligned;
    else groupY = Math.max(startY, Math.min(groupY, endY));
  }

  const padLeftDx = padLeft * metrics.faceWidth;
  const padRightDx = padRight * metrics.faceWidth;
  const fullFaceSpan = metrics.faceWidth + (minConstraintWidth - 1) * metrics.cellWidth;
  const startX = padLeftDx;
  const endX = fullFaceSpan - scaledGroupWidth - padRightDx;

  if (!(sizeMode === "none" && alignH === "none")) {
    if (alignH === "start") groupX = startX;
    else if (alignH === "end") groupX = Math.max(startX, endX);
    else if (alignH === "center") groupX = Math.max(startX, (startX + endX) * 0.5);
    else if (alignH === "center1") {
      const end1 = metrics.faceWidth - scaledGroupWidth - padRightDx;
      groupX = Math.max(startX, (startX + end1) * 0.5);
    } else {
      groupX = Math.max(startX, Math.min(groupX, endX));
    }
  }

  return {
    width: glyph.width * widthFactor,
    height: glyph.height * heightFactor,
    x: groupX + scaledGroupWidth * relX,
    y: groupY + scaledGroupHeight * relY,
  };
}

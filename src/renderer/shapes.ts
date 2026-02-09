import { BOX_LINE_MAP } from "./box-drawing-map";
import type { NerdConstraint } from "../fonts/nerd-constraints";
import { isGraphicsElementCodepoint, isSymbolLikeCodepoint } from "../unicode/symbols";

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
  return isGraphicsElementCodepoint(cp);
}

/** Test whether a codepoint is a symbol that may need special rendering (PUA or graphics). */
export function isSymbolCp(cp: number): boolean {
  return isSymbolLikeCodepoint(cp);
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
  boxThicknessPx?: number,
): boolean {
  // Ghostty derives box_thickness from underline thickness.
  // When callers provide it, use that directly for closer parity.
  const hasBoxThickness =
    Number.isFinite(boxThicknessPx) && typeof boxThicknessPx === "number" && boxThicknessPx > 0;
  const lightStroke = hasBoxThickness ? Math.max(1, Math.round(boxThicknessPx)) : Math.max(1, Math.floor(cellH / 16));
  const heavyStroke = lightStroke * 2;
  const spec = BOX_LINE_MAP.get(cp);
  if (!spec) {
    const light = lightStroke;
    const heavy = heavyStroke;
    const cellWInt = Math.max(1, Math.round(cellW));
    const cellHInt = Math.max(1, Math.round(cellH));
    const satSub = (a: number, b: number) => (a > b ? a - b : 0);

    // Mirror Ghostty dash tiling so adjacent cells compose into even dash rhythm.
    const dashedH = (count: number, thickness: number, desiredGap: number) => {
      const thickPx = Math.max(1, Math.round(thickness));
      const gapCount = count;
      if (cellWInt < count + gapCount) {
        const y0 = y + Math.floor(satSub(cellHInt, thickPx) / 2);
        pushRectBox(out, x, y0, cellWInt, thickPx, color);
        return;
      }
      const maxGap = Math.floor(cellWInt / (2 * count));
      const gapWidth = Math.min(Math.max(1, Math.round(desiredGap)), maxGap);
      const totalGapWidth = gapCount * gapWidth;
      const totalDashWidth = cellWInt - totalGapWidth;
      const dashWidth = Math.floor(totalDashWidth / count);
      let extra = totalDashWidth % count;
      const y0 = y + Math.floor(satSub(cellHInt, thickPx) / 2);
      let px = x + Math.floor(gapWidth / 2);
      for (let i = 0; i < count; i += 1) {
        let seg = dashWidth;
        if (extra > 0) {
          seg += 1;
          extra -= 1;
        }
        pushRectBox(out, px, y0, seg, thickPx, color);
        px += seg + gapWidth;
      }
    };

    const dashedV = (count: number, thickness: number, desiredGap: number) => {
      const thickPx = Math.max(1, Math.round(thickness));
      const gapCount = count;
      if (cellHInt < count + gapCount) {
        const x0 = x + Math.floor(satSub(cellWInt, thickPx) / 2);
        pushRectBox(out, x0, y, thickPx, cellHInt, color);
        return;
      }
      const maxGap = Math.floor(cellHInt / (2 * count));
      const gapHeight = Math.min(Math.max(1, Math.round(desiredGap)), maxGap);
      const totalGapHeight = gapCount * gapHeight;
      const totalDashHeight = cellHInt - totalGapHeight;
      const dashHeight = Math.floor(totalDashHeight / count);
      let extra = totalDashHeight % count;
      const x0 = x + Math.floor(satSub(cellWInt, thickPx) / 2);
      let py = y;
      for (let i = 0; i < count; i += 1) {
        let seg = dashHeight;
        if (extra > 0) {
          seg += 1;
          extra -= 1;
        }
        pushRectBox(out, x0, py, thickPx, seg, color);
        py += seg + gapHeight;
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

    const drawRoundedCorner = (cornerCp: 0x256d | 0x256e | 0x256f | 0x2570) => {
      // Mirror Ghostty's rounded box corners: cubic centerline + butt-capped stroke.
      const thickness = Math.max(1, Math.round(light));
      const half = thickness * 0.5;
      const s = 0.25;
      const cx = x + Math.floor((cellW - thickness) * 0.5) + half;
      const cy = y + Math.floor((cellH - thickness) * 0.5) + half;
      const r = Math.min(cellW, cellH) * 0.5;

      type Point = { x: number; y: number };
      const p0: Point = { x: cx, y };
      const p1: Point = { x: cx, y: cy - r };
      const c1: Point = { x: cx, y: cy - s * r };
      const c2: Point = { x: cx, y: cy };
      const p2: Point = { x: cx, y: cy };
      const p3: Point = { x: cx, y: cy };
      let p4: Point = { x: x + cellW, y: cy };

      switch (cornerCp) {
        case 0x256d: // ╭
          p0.y = y + cellH;
          p1.y = cy + r;
          c1.y = cy + s * r;
          c2.x = cx + s * r;
          p2.x = cx + r;
          p3.x = cx + r;
          p4 = { x: x + cellW, y: cy };
          break;
        case 0x256e: // ╮
          p0.y = y + cellH;
          p1.y = cy + r;
          c1.y = cy + s * r;
          c2.x = cx - s * r;
          p2.x = cx - r;
          p3.x = cx - r;
          p4 = { x, y: cy };
          break;
        case 0x256f: // ╯
          c2.x = cx - s * r;
          p2.x = cx - r;
          p3.x = cx - r;
          p4 = { x, y: cy };
          break;
        case 0x2570: // ╰
          c2.x = cx + s * r;
          p2.x = cx + r;
          p3.x = cx + r;
          p4 = { x: x + cellW, y: cy };
          break;
      }

      type Segment = {
        ax: number;
        ay: number;
        ux: number;
        uy: number;
        nx: number;
        ny: number;
        len: number;
      };
      const segments: Segment[] = [];
      const addSegment = (a: Point, b: Point) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len <= 1e-6) return;
        const ux = dx / len;
        const uy = dy / len;
        segments.push({ ax: a.x, ay: a.y, ux, uy, nx: -uy, ny: ux, len });
      };

      const cubicPoint = (
        a: Point,
        b: Point,
        c: Point,
        d: Point,
        t: number,
      ): Point => {
        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;
        return {
          x: mt2 * mt * a.x + 3 * mt2 * t * b.x + 3 * mt * t2 * c.x + t2 * t * d.x,
          y: mt2 * mt * a.y + 3 * mt2 * t * b.y + 3 * mt * t2 * c.y + t2 * t * d.y,
        };
      };

      const steps = Math.max(10, Math.round(Math.max(cellW, cellH) * 1.5));
      const curvePoints: Point[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        curvePoints.push(cubicPoint(p1, c1, c2, p2, t));
      }

      addSegment(p0, p1);
      for (let i = 1; i < curvePoints.length; i += 1) {
        addSegment(curvePoints[i - 1]!, curvePoints[i]!);
      }
      addSegment(p3, p4);

      const minX = Math.max(Math.floor(x), Math.floor(Math.min(p0.x, p4.x, cx - r) - half - 1));
      const maxX = Math.min(
        Math.ceil(x + cellW) - 1,
        Math.ceil(Math.max(p0.x, p4.x, cx + r) + half + 1),
      );
      const minY = Math.max(Math.floor(y), Math.floor(Math.min(p0.y, p4.y, cy - r) - half - 1));
      const maxY = Math.min(
        Math.ceil(y + cellH) - 1,
        Math.ceil(Math.max(p0.y, p4.y, cy + r) + half + 1),
      );
      if (maxX < minX || maxY < minY) return;

      const sampleOffsets: ReadonlyArray<readonly [number, number]> = [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ];

      const sampleInsideStroke = (sx: number, sy: number): boolean => {
        for (const seg of segments) {
          const rx = sx - seg.ax;
          const ry = sy - seg.ay;
          const along = rx * seg.ux + ry * seg.uy;
          if (along < 0 || along > seg.len) continue;
          const perp = Math.abs(rx * seg.nx + ry * seg.ny);
          if (perp <= half + 1e-6) return true;
        }
        return false;
      };

      for (let py = minY; py <= maxY; py += 1) {
        let runX = -1;
        let runCoverage = 0;
        for (let px = minX; px <= maxX; px += 1) {
          let coverage = 0;
          for (const [ox, oy] of sampleOffsets) {
            if (sampleInsideStroke(px + ox, py + oy)) coverage += 1;
          }
          if (coverage > 0 && runX < 0) {
            runX = px;
            runCoverage = coverage;
            continue;
          }
          if (coverage > 0 && coverage === runCoverage) continue;
          if (runX >= 0) {
            const alphaColor: Color = [
              color[0],
              color[1],
              color[2],
              color[3] * (runCoverage / sampleOffsets.length),
            ];
            pushRectBox(out, runX, py, px - runX, 1, alphaColor);
            runX = coverage > 0 ? px : -1;
            runCoverage = coverage;
          }
        }
        if (runX >= 0) {
          const alphaColor: Color = [
            color[0],
            color[1],
            color[2],
            color[3] * (runCoverage / sampleOffsets.length),
          ];
          pushRectBox(out, runX, py, maxX - runX + 1, 1, alphaColor);
        }
      }
    };

    switch (cp) {
      case 0x2504:
        dashedH(3, light, Math.max(4, light));
        return true;
      case 0x2505:
        dashedH(3, heavy, Math.max(4, light));
        return true;
      case 0x2508:
        dashedH(4, light, Math.max(4, light));
        return true;
      case 0x2509:
        dashedH(4, heavy, Math.max(4, light));
        return true;
      case 0x2506:
        dashedV(3, light, Math.max(4, light));
        return true;
      case 0x2507:
        dashedV(3, heavy, Math.max(4, light));
        return true;
      case 0x250a:
        dashedV(4, light, Math.max(4, light));
        return true;
      case 0x250b:
        dashedV(4, heavy, Math.max(4, light));
        return true;
      case 0x254c:
        dashedH(2, light, light);
        return true;
      case 0x254d:
        dashedH(2, heavy, heavy);
        return true;
      case 0x254e:
        dashedV(2, light, heavy);
        return true;
      case 0x254f:
        dashedV(2, heavy, heavy);
        return true;
      case 0x256d:
      case 0x256e:
      case 0x256f:
      case 0x2570:
        drawRoundedCorner(cp);
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
  const light = lightStroke;
  const heavy = heavyStroke;
  const cellWInt = Math.max(1, Math.round(cellW));
  const cellHInt = Math.max(1, Math.round(cellH));

  const satSub = (a: number, b: number) => (a > b ? a - b : 0);
  const hLightTop = Math.floor(satSub(cellHInt, light) / 2);
  const hLightBottom = hLightTop + light;
  const hHeavyTop = Math.floor(satSub(cellHInt, heavy) / 2);
  const hHeavyBottom = hHeavyTop + heavy;
  const hDoubleTop = satSub(hLightTop, light);
  const hDoubleBottom = hLightBottom + light;

  const vLightLeft = Math.floor(satSub(cellWInt, light) / 2);
  const vLightRight = vLightLeft + light;
  const vHeavyLeft = Math.floor(satSub(cellWInt, heavy) / 2);
  const vHeavyRight = vHeavyLeft + heavy;
  const vDoubleLeft = satSub(vLightLeft, light);
  const vDoubleRight = vLightRight + light;

  const upBottom =
    left === BOX_STYLE_HEAVY || right === BOX_STYLE_HEAVY
      ? hHeavyBottom
      : left !== right || down === up
        ? left === BOX_STYLE_DOUBLE || right === BOX_STYLE_DOUBLE
          ? hDoubleBottom
          : hLightBottom
        : left === BOX_STYLE_NONE && right === BOX_STYLE_NONE
          ? hLightBottom
          : hLightTop;

  const downTop =
    left === BOX_STYLE_HEAVY || right === BOX_STYLE_HEAVY
      ? hHeavyTop
      : left !== right || up === down
        ? left === BOX_STYLE_DOUBLE || right === BOX_STYLE_DOUBLE
          ? hDoubleTop
          : hLightTop
        : left === BOX_STYLE_NONE && right === BOX_STYLE_NONE
          ? hLightTop
          : hLightBottom;

  const leftRight =
    up === BOX_STYLE_HEAVY || down === BOX_STYLE_HEAVY
      ? vHeavyRight
      : up !== down || left === right
        ? up === BOX_STYLE_DOUBLE || down === BOX_STYLE_DOUBLE
          ? vDoubleRight
          : vLightRight
        : up === BOX_STYLE_NONE && down === BOX_STYLE_NONE
          ? vLightRight
          : vLightLeft;

  const rightLeft =
    up === BOX_STYLE_HEAVY || down === BOX_STYLE_HEAVY
      ? vHeavyLeft
      : up !== down || right === left
        ? up === BOX_STYLE_DOUBLE || down === BOX_STYLE_DOUBLE
          ? vDoubleLeft
          : vLightLeft
        : up === BOX_STYLE_NONE && down === BOX_STYLE_NONE
          ? vLightLeft
          : vLightRight;

  const drawBox = (x0: number, y0: number, x1: number, y1: number) => {
    if (x1 <= x0 || y1 <= y0) return;
    pushRectSnapped(out, x + x0, y + y0, x1 - x0, y1 - y0, color);
  };

  const drawHorizontalBand = (style: number) => {
    if (style === BOX_STYLE_LIGHT) {
      drawBox(0, hLightTop, cellWInt, hLightBottom);
      return;
    }
    if (style === BOX_STYLE_HEAVY) {
      drawBox(0, hHeavyTop, cellWInt, hHeavyBottom);
      return;
    }
    if (style === BOX_STYLE_DOUBLE) {
      drawBox(0, hDoubleTop, cellWInt, hLightTop);
      drawBox(0, hLightBottom, cellWInt, hDoubleBottom);
    }
  };

  const drawVerticalBand = (style: number) => {
    if (style === BOX_STYLE_LIGHT) {
      drawBox(vLightLeft, 0, vLightRight, cellHInt);
      return;
    }
    if (style === BOX_STYLE_HEAVY) {
      drawBox(vHeavyLeft, 0, vHeavyRight, cellHInt);
      return;
    }
    if (style === BOX_STYLE_DOUBLE) {
      drawBox(vDoubleLeft, 0, vLightLeft, cellHInt);
      drawBox(vLightRight, 0, vDoubleRight, cellHInt);
    }
  };

  // Fast path for pure straight lines to avoid overlapping rects in instance output.
  if (up === BOX_STYLE_NONE && down === BOX_STYLE_NONE && left !== BOX_STYLE_NONE && left === right) {
    drawHorizontalBand(left);
    return true;
  }
  if (left === BOX_STYLE_NONE && right === BOX_STYLE_NONE && up !== BOX_STYLE_NONE && up === down) {
    drawVerticalBand(up);
    return true;
  }

  switch (up) {
    case BOX_STYLE_NONE:
      break;
    case BOX_STYLE_LIGHT:
      drawBox(vLightLeft, 0, vLightRight, upBottom);
      break;
    case BOX_STYLE_HEAVY:
      drawBox(vHeavyLeft, 0, vHeavyRight, upBottom);
      break;
    case BOX_STYLE_DOUBLE: {
      const leftBottom = left === BOX_STYLE_DOUBLE ? hLightTop : upBottom;
      const rightBottom = right === BOX_STYLE_DOUBLE ? hLightTop : upBottom;
      drawBox(vDoubleLeft, 0, vLightLeft, leftBottom);
      drawBox(vLightRight, 0, vDoubleRight, rightBottom);
      break;
    }
  }

  switch (right) {
    case BOX_STYLE_NONE:
      break;
    case BOX_STYLE_LIGHT:
      drawBox(rightLeft, hLightTop, cellWInt, hLightBottom);
      break;
    case BOX_STYLE_HEAVY:
      drawBox(rightLeft, hHeavyTop, cellWInt, hHeavyBottom);
      break;
    case BOX_STYLE_DOUBLE: {
      const topLeft = up === BOX_STYLE_DOUBLE ? vLightRight : rightLeft;
      const bottomLeft = down === BOX_STYLE_DOUBLE ? vLightRight : rightLeft;
      drawBox(topLeft, hDoubleTop, cellWInt, hLightTop);
      drawBox(bottomLeft, hLightBottom, cellWInt, hDoubleBottom);
      break;
    }
  }

  switch (down) {
    case BOX_STYLE_NONE:
      break;
    case BOX_STYLE_LIGHT:
      drawBox(vLightLeft, downTop, vLightRight, cellHInt);
      break;
    case BOX_STYLE_HEAVY:
      drawBox(vHeavyLeft, downTop, vHeavyRight, cellHInt);
      break;
    case BOX_STYLE_DOUBLE: {
      const leftTop = left === BOX_STYLE_DOUBLE ? hLightBottom : downTop;
      const rightTop = right === BOX_STYLE_DOUBLE ? hLightBottom : downTop;
      drawBox(vDoubleLeft, leftTop, vLightLeft, cellHInt);
      drawBox(vLightRight, rightTop, vDoubleRight, cellHInt);
      break;
    }
  }

  switch (left) {
    case BOX_STYLE_NONE:
      break;
    case BOX_STYLE_LIGHT:
      drawBox(0, hLightTop, leftRight, hLightBottom);
      break;
    case BOX_STYLE_HEAVY:
      drawBox(0, hHeavyTop, leftRight, hHeavyBottom);
      break;
    case BOX_STYLE_DOUBLE: {
      const topRight = up === BOX_STYLE_DOUBLE ? vLightLeft : leftRight;
      const bottomRight = down === BOX_STYLE_DOUBLE ? vLightLeft : leftRight;
      drawBox(0, hDoubleTop, topRight, hLightTop);
      drawBox(0, hLightBottom, bottomRight, hDoubleBottom);
      break;
    }
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

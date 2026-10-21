import { isBraille } from "./classify";
import { pushRect } from "./geometry";
import type { Color, RectData } from "./types";

// [column, row, bit] for each of the 8 braille dots.
const DOTS: [number, number, number][] = [
  [0, 0, 0x01],
  [0, 1, 0x02],
  [0, 2, 0x04],
  [1, 0, 0x08],
  [1, 1, 0x10],
  [1, 2, 0x20],
  [0, 3, 0x40],
  [1, 3, 0x80],
];

/**
 * Rasterize a Unicode Braille Pattern (U+2800-U+28FF) into square rect dot instances.
 * Pixel layout follows Ghostty's `draw2800_28FF` sprite.
 */
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

  const width = Math.floor(cellW);
  const height = Math.floor(cellH);
  let w = Math.floor(Math.min(width / 4, height / 8));
  let xSpacing = Math.floor(width / 4);
  let ySpacing = Math.floor(height / 8);
  let xMargin = Math.floor(xSpacing / 2);
  let yMargin = Math.floor(ySpacing / 2);
  let xLeft = width - 2 * xMargin - xSpacing - 2 * w;
  let yLeft = height - 2 * yMargin - 3 * ySpacing - 4 * w;

  if (xLeft >= 2 && yLeft >= 4 && w === 0) {
    w += 1;
    xLeft -= 2;
    yLeft -= 4;
  }
  if (xLeft >= 2 && xMargin === 0) {
    xMargin = 1;
    xLeft -= 2;
  }
  if (yLeft >= 2 && yMargin === 0) {
    yMargin = 1;
    yLeft -= 2;
  }
  if (xLeft >= 1) {
    xSpacing += 1;
    xLeft -= 1;
  }
  if (yLeft >= 3) {
    ySpacing += 1;
    yLeft -= 3;
  }
  if (xLeft >= 2) {
    xMargin += 1;
    xLeft -= 2;
  }
  if (yLeft >= 2) {
    yMargin += 1;
    yLeft -= 2;
  }
  if (xLeft >= 2 && yLeft >= 4) w += 1;
  if (w <= 0) return true;

  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const colX = [x0 + xMargin, x0 + xMargin + w + xSpacing];
  const rowY = [0, 1, 2, 3].map((i) => y0 + yMargin + i * (w + ySpacing));
  for (const [cx, cy, mask] of DOTS) {
    if (bits & mask) pushRect(out, colX[cx]!, rowY[cy]!, w, w, color);
  }
  return true;
}

import { clamp } from "../../grid";
import { pushRect, type Color } from "../../renderer";

export function drawUnderlineStyle(
  underlineData: number[],
  style: number,
  x: number,
  rowY: number,
  cellW: number,
  cellH: number,
  baseY: number,
  underlineOffsetPx: number,
  underlineThicknessPx: number,
  color: Color,
): void {
  if (style <= 0) return;
  const thickness = underlineThicknessPx;
  const minY = rowY + 1;
  const maxY = rowY + cellH - thickness - 1;
  const underlineY = clamp(baseY + underlineOffsetPx, minY, maxY);
  if (style === 1) {
    pushRect(underlineData, x, underlineY, cellW, thickness, color);
    return;
  }
  if (style === 2) {
    pushRect(underlineData, x, underlineY, cellW, thickness, color);
    const gap = Math.max(1, Math.round(thickness * 0.6));
    let secondY = underlineY + thickness + gap;
    if (secondY > maxY) secondY = Math.max(minY, underlineY - thickness - gap);
    pushRect(underlineData, x, secondY, cellW, thickness, color);
    return;
  }
  if (style === 3) {
    const step = Math.max(2, Math.round(cellW * 0.25));
    const waveOffset = Math.max(1, Math.round(thickness * 0.8));
    for (let dx = 0; dx < cellW; dx += step) {
      const up = Math.floor(dx / step) % 2 === 0;
      const y = underlineY + (up ? 0 : waveOffset);
      pushRect(underlineData, x + dx, y, Math.min(step, cellW - dx), thickness, color);
    }
    return;
  }
  if (style === 4) {
    const dot = Math.max(1, Math.round(thickness));
    const gap = Math.max(1, Math.round(dot));
    for (let dx = 0; dx < cellW; dx += dot + gap) {
      pushRect(underlineData, x + dx, underlineY, Math.min(dot, cellW - dx), thickness, color);
    }
    return;
  }
  if (style === 5) {
    const dash = Math.max(1, Math.round(cellW * 0.6));
    const gap = Math.max(1, Math.round(cellW * 0.2));
    for (let dx = 0; dx < cellW; dx += dash + gap) {
      pushRect(underlineData, x + dx, underlineY, Math.min(dash, cellW - dx), thickness, color);
    }
  }
}

export function drawStrikethrough(
  underlineData: number[],
  x: number,
  rowY: number,
  cellW: number,
  cellH: number,
  color: Color,
): void {
  const thickness = Math.max(1, Math.round(cellH * 0.08));
  const y = Math.round(rowY + cellH * 0.5 - thickness * 0.5);
  pushRect(underlineData, x, y, cellW, thickness, color);
}

export function drawOverline(
  underlineData: number[],
  x: number,
  rowY: number,
  cellW: number,
  color: Color,
): void {
  const thickness = 1;
  const y = Math.round(rowY + 1);
  pushRect(underlineData, x, y, cellW, thickness, color);
}

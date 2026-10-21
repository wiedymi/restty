import { expect, test } from "bun:test";
import { drawBraille } from "../src/renderer/shapes/braille";

const color: [number, number, number, number] = [1, 1, 1, 1];

function rects(cp: number, cellW: number, cellH: number, x = 0, y = 0) {
  const out: number[] = [];
  drawBraille(cp, x, y, cellW, cellH, color, out);
  const result: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < out.length; i += 8) {
    result.push({ x: out[i]!, y: out[i + 1]!, w: out[i + 2]!, h: out[i + 3]! });
  }
  return result;
}

test("drawBraille draws square dots in tall cells like Ghostty", () => {
  for (const [w, h] of [
    [8, 16],
    [9, 19],
    [10, 22],
    [17, 36],
  ] as const) {
    const dots = rects(0x28ff, w, h);
    expect(dots.length).toBe(8);
    for (const dot of dots) {
      expect(dot.w).toBe(dot.h);
      expect(dot.w).toBeGreaterThan(0);
      expect(dot.x + dot.w).toBeLessThanOrEqual(w);
      expect(dot.y + dot.h).toBeLessThanOrEqual(h);
    }
  }
});

test("drawBraille matches Ghostty layout for a 10x22 cell", () => {
  // Ghostty draw2800_28FF: w=2, x = [1, 6], y = [2, 7, 12, 17]
  const dots = rects(0x28ff, 10, 22);
  const xs = [...new Set(dots.map((d) => d.x))].sort((a, b) => a - b);
  const ys = [...new Set(dots.map((d) => d.y))].sort((a, b) => a - b);
  expect(xs).toEqual([1, 6]);
  expect(ys).toEqual([2, 7, 12, 17]);
  expect(dots.every((d) => d.w === 2 && d.h === 2)).toBe(true);
});

test("drawBraille maps bits to dot positions and snaps the cell origin", () => {
  // U+2801 = dot 1 (top-left), U+2880 = dot 8 (bottom-right)
  const [tl] = rects(0x2801, 10, 22, 100.4, 50.6);
  const [br] = rects(0x2880, 10, 22, 100.4, 50.6);
  expect(tl).toEqual({ x: 101, y: 53, w: 2, h: 2 });
  expect(br).toEqual({ x: 106, y: 68, w: 2, h: 2 });
  expect(rects(0x2800, 10, 22)).toEqual([]);
});

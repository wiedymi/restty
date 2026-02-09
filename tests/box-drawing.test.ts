import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { drawBoxDrawing } from "../src/renderer/shapes";

type Color = [number, number, number, number];

function rasterize(rects: number[], width: number, height: number): Uint8Array {
  const bitmap = new Uint8Array(width * height);
  for (let i = 0; i < rects.length; i += 8) {
    const x = Math.floor(rects[i] ?? 0);
    const y = Math.floor(rects[i + 1] ?? 0);
    const w = Math.floor(rects[i + 2] ?? 0);
    const h = Math.floor(rects[i + 3] ?? 0);
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(width, x + w);
    const y1 = Math.min(height, y + h);
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) {
        bitmap[yy * width + xx] = 1;
      }
    }
  }
  return bitmap;
}

function rasterizeCounts(rects: number[], width: number, height: number): Uint8Array {
  const bitmap = new Uint8Array(width * height);
  for (let i = 0; i < rects.length; i += 8) {
    const x = Math.floor(rects[i] ?? 0);
    const y = Math.floor(rects[i + 1] ?? 0);
    const w = Math.floor(rects[i + 2] ?? 0);
    const h = Math.floor(rects[i + 3] ?? 0);
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(width, x + w);
    const y1 = Math.min(height, y + h);
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) {
        const idx = yy * width + xx;
        bitmap[idx] = Math.min(255, (bitmap[idx] ?? 0) + 1);
      }
    }
  }
  return bitmap;
}

function densestRow(bitmap: Uint8Array, width: number, height: number): number {
  let bestRow = 0;
  let bestCount = -1;
  for (let y = 0; y < height; y += 1) {
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      count += bitmap[y * width + x] ?? 0;
    }
    if (count > bestCount) {
      bestCount = count;
      bestRow = y;
    }
  }
  return bestRow;
}

function densestCol(bitmap: Uint8Array, width: number, height: number): number {
  let bestCol = 0;
  let bestCount = -1;
  for (let x = 0; x < width; x += 1) {
    let count = 0;
    for (let y = 0; y < height; y += 1) {
      count += bitmap[y * width + x] ?? 0;
    }
    if (count > bestCount) {
      bestCount = count;
      bestCol = x;
    }
  }
  return bestCol;
}

function hasInkNear(
  bitmap: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius = 1,
): boolean {
  const x0 = Math.max(0, Math.floor(cx) - radius);
  const y0 = Math.max(0, Math.floor(cy) - radius);
  const x1 = Math.min(width - 1, Math.floor(cx) + radius);
  const y1 = Math.min(height - 1, Math.floor(cy) + radius);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if ((bitmap[y * width + x] ?? 0) > 0) return true;
    }
  }
  return false;
}

test("box drawing horizontal lines stay continuous across adjacent cells", () => {
  const color: Color = [1, 1, 1, 1];
  const sizes = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 31, 33, 41];

  for (const cellW of sizes) {
    for (const cellH of sizes) {
      const cols = 8;
      const width = cellW * cols;
      const height = cellH;
      const rects: number[] = [];
      for (let col = 0; col < cols; col += 1) {
        drawBoxDrawing(0x2500, col * cellW, 0, cellW, cellH, color, rects);
      }
      const bitmap = rasterize(rects, width, height);
      const row = densestRow(bitmap, width, height);
      for (let x = 0; x < width; x += 1) {
        expect(bitmap[row * width + x]).toBe(1);
      }
    }
  }
});

test("box drawing vertical lines stay continuous across adjacent cells", () => {
  const color: Color = [1, 1, 1, 1];
  const sizes = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 31, 33, 41];

  for (const cellW of sizes) {
    for (const cellH of sizes) {
      const rows = 8;
      const width = cellW;
      const height = cellH * rows;
      const rects: number[] = [];
      for (let row = 0; row < rows; row += 1) {
        drawBoxDrawing(0x2502, 0, row * cellH, cellW, cellH, color, rects);
      }
      const bitmap = rasterize(rects, width, height);
      const col = densestCol(bitmap, width, height);
      for (let y = 0; y < height; y += 1) {
        expect(bitmap[y * width + col]).toBe(1);
      }
    }
  }
});

test("box drawing single-stroke lines avoid per-cell overlap hot spots", () => {
  const color: Color = [1, 1, 1, 1];
  const sizes = [9, 10, 11, 12, 13, 16, 18, 21, 24, 27, 31, 33];

  for (const cellW of sizes) {
    for (const cellH of sizes) {
      const cols = 8;
      const width = cellW * cols;
      const rects: number[] = [];
      for (let col = 0; col < cols; col += 1) {
        drawBoxDrawing(0x2500, col * cellW, 0, cellW, cellH, color, rects);
      }

      const counts = rasterizeCounts(rects, width, cellH);
      const row = densestRow(rasterize(rects, width, cellH), width, cellH);
      for (let x = 0; x < width; x += 1) {
        expect(counts[row * width + x]).toBe(1);
      }

      const rows = 8;
      const tallHeight = cellH * rows;
      const vRects: number[] = [];
      for (let rowIdx = 0; rowIdx < rows; rowIdx += 1) {
        drawBoxDrawing(0x2502, 0, rowIdx * cellH, cellW, cellH, color, vRects);
      }
      const vCounts = rasterizeCounts(vRects, cellW, tallHeight);
      const col = densestCol(rasterize(vRects, cellW, tallHeight), cellW, tallHeight);
      for (let y = 0; y < tallHeight; y += 1) {
        expect(vCounts[y * cellW + col]).toBe(1);
      }
    }
  }
});

test("both WebGPU and WebGL loops use the same procedural box drawing path", () => {
  const appPath = join(process.cwd(), "src/app/index.ts");
  const source = readFileSync(appPath, "utf8");
  const matches =
    source.match(
      /drawBoxDrawing\(cp,\s*x,\s*rowY,\s*cellW,\s*cellH,\s*fg,\s*fgRectData,\s*underlineThicknessPx\)/g,
    ) ?? [];
  expect(matches.length).toBe(2);
});

test("rounded corners connect to neighboring straight lines at cell boundaries", () => {
  const color: Color = [1, 1, 1, 1];
  const sizes = [7, 8, 9, 10, 11, 12, 13, 16, 19, 24, 31, 41];

  for (const cellW of sizes) {
    for (const cellH of sizes) {
      const width = cellW * 2;
      const height = cellH * 2;
      const rects: number[] = [];

      //   │
      //   ╰─
      drawBoxDrawing(0x2502, 0, 0, cellW, cellH, color, rects);
      drawBoxDrawing(0x2570, 0, cellH, cellW, cellH, color, rects);
      drawBoxDrawing(0x2500, cellW, cellH, cellW, cellH, color, rects);

      const bitmap = rasterize(rects, width, height);
      const seamTopX = cellW * 0.5;
      const seamTopY = cellH;
      const seamRightX = cellW;
      const seamRightY = cellH * 1.5;
      expect(hasInkNear(bitmap, width, height, seamTopX, seamTopY, 1)).toBe(true);
      expect(hasInkNear(bitmap, width, height, seamRightX, seamRightY, 1)).toBe(true);
    }
  }
});

test("double-dashed box lines match Ghostty dash spacing for U+254C/U+254E", () => {
  const color: Color = [1, 1, 1, 1];

  const hRects: number[] = [];
  drawBoxDrawing(0x254c, 0, 0, 20, 34, color, hRects, 2);
  expect(hRects).toEqual([
    1, 16, 8, 2, 1, 1, 1, 1,
    11, 16, 8, 2, 1, 1, 1, 1,
  ]);

  const vRects: number[] = [];
  drawBoxDrawing(0x254e, 0, 0, 20, 34, color, vRects, 2);
  expect(vRects).toEqual([
    9, 0, 2, 13, 1, 1, 1, 1,
    9, 17, 2, 13, 1, 1, 1, 1,
  ]);
});

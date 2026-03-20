import type { RenderState } from "../../../wasm";
import type { RuntimeCell } from "./types";

type DesktopWordSelectionRange = {
  start: number;
  end: number;
};

type CellClusterKind = "space" | "word" | "symbol";

type CellCluster = {
  col: number;
  span: number;
  kind: CellClusterKind;
};

function readClusterText(render: RenderState, idx: number): string {
  const cp = render.codepoints[idx] ?? 0;
  if (!cp) return " ";

  let text = String.fromCodePoint(cp);
  const extra =
    render.graphemeLen && render.graphemeOffset && render.graphemeBuffer
      ? (render.graphemeLen[idx] ?? 0)
      : 0;
  if (extra > 0 && render.graphemeOffset && render.graphemeBuffer) {
    const start = render.graphemeOffset[idx] ?? 0;
    const cps = [cp];
    for (let j = 0; j < extra; j += 1) {
      const extraCp = render.graphemeBuffer[start + j];
      if (extraCp) cps.push(extraCp);
    }
    text = String.fromCodePoint(...cps);
  }
  return text;
}

/** Ghostty-style word separators: whitespace plus `,│'|:"` */
const WORD_SEPARATORS = new Set([",", "│", "'", "|", ":", '"', " ", "\t"]);

function classifyCluster(text: string): CellClusterKind {
  if (/^\s+$/u.test(text)) return "space";
  for (const ch of text) {
    if (WORD_SEPARATORS.has(ch)) return "symbol";
  }
  return "word";
}

function getClusterAt(render: RenderState, row: number, col: number): CellCluster | null {
  if (row < 0 || row >= render.rows || col < 0 || col >= render.cols) return null;

  const idx = row * render.cols + col;
  const flag = render.wide ? (render.wide[idx] ?? 0) : 0;
  if (flag === 2 || flag === 3) return null;

  const text = readClusterText(render, idx);
  return {
    col,
    span: flag === 1 ? 2 : 1,
    kind: classifyCluster(text),
  };
}

function findPreviousClusterStart(render: RenderState, row: number, col: number): number | null {
  for (let current = col - 1; current >= 0; current -= 1) {
    const idx = row * render.cols + current;
    const flag = render.wide ? (render.wide[idx] ?? 0) : 0;
    if (flag !== 2 && flag !== 3) return current;
  }
  return null;
}

function findNextClusterStart(
  render: RenderState,
  row: number,
  col: number,
  span: number,
): number | null {
  for (let current = col + Math.max(1, span); current < render.cols; current += 1) {
    const idx = row * render.cols + current;
    const flag = render.wide ? (render.wide[idx] ?? 0) : 0;
    if (flag !== 2 && flag !== 3) return current;
  }
  return null;
}

export function resolveDesktopWordSelectionRange(
  render: RenderState | null,
  cell: RuntimeCell,
): DesktopWordSelectionRange | null {
  if (!render) return null;

  const cluster = getClusterAt(render, cell.row, cell.col);
  if (!cluster) return null;

  let start = cluster.col;
  let end = cluster.col + cluster.span;

  let previousCol = findPreviousClusterStart(render, cell.row, start);
  while (previousCol !== null) {
    const previous = getClusterAt(render, cell.row, previousCol);
    if (!previous || previous.kind !== cluster.kind) break;
    start = previous.col;
    previousCol = findPreviousClusterStart(render, cell.row, start);
  }

  let nextCol = findNextClusterStart(render, cell.row, cluster.col, cluster.span);
  while (nextCol !== null) {
    const next = getClusterAt(render, cell.row, nextCol);
    if (!next || next.kind !== cluster.kind) break;
    end = next.col + next.span;
    nextCol = findNextClusterStart(render, cell.row, next.col, next.span);
  }

  return { start, end };
}

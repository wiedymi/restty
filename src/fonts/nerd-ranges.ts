/** Unicode codepoint ranges for Nerd Font symbols (start, end inclusive). */
export const NERD_SYMBOL_RANGES: Array<[number, number]> = [
  [0xe000, 0xe00a],
  [0xe0a0, 0xe0a3],
  [0xe0b0, 0xe0c8],
  [0xe0ca, 0xe0ca],
  [0xe0cc, 0xe0d7],
  [0xe200, 0xe2a9],
  [0xe300, 0xe3e3],
  [0xe5fa, 0xe6b7],
  [0xe700, 0xe8ef],
  [0xea60, 0xec1e],
  [0xed00, 0xf2ff],
  [0xee00, 0xee0b],
  [0xf300, 0xf381],
  [0xf400, 0xf533],
  [0xf0001, 0xf1af0],
];

/** Check if a codepoint falls within Nerd Font symbol ranges. */
export function isNerdSymbolCodepoint(cp: number): boolean {
  for (const [start, end] of NERD_SYMBOL_RANGES) {
    if (cp >= start && cp <= end) return true;
  }
  return false;
}

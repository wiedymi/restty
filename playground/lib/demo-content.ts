function joinDemoLines(lines: string[]) {
  return lines.join("\r\n");
}

export function createBasicDemoPayload() {
  const lines = [
    "restty demo: basics",
    "",
    "Styles: " +
      "\x1b[1mBold\x1b[0m " +
      "\x1b[3mItalic\x1b[0m " +
      "\x1b[4mUnderline\x1b[0m " +
      "\x1b[7mReverse\x1b[0m " +
      "\x1b[9mStrike\x1b[0m",
    "",
    "RGB: " +
      "\x1b[38;2;255;100;0mOrange\x1b[0m " +
      "\x1b[38;2;120;200;255mSky\x1b[0m " +
      "\x1b[38;2;160;255;160mMint\x1b[0m",
    "BG:  " +
      "\x1b[48;2;60;60;60m  \x1b[0m " +
      "\x1b[48;2;120;40;40m  \x1b[0m " +
      "\x1b[48;2;40;120;40m  \x1b[0m " +
      "\x1b[48;2;40;40;120m  \x1b[0m",
    "",
    "Box: ┌────────────────────┐",
    "     │  mono renderer     │",
    "     └────────────────────┘",
    "",
  ];
  return `\x1b[2J\x1b[H${joinDemoLines(lines)}`;
}

export function createPaletteDemoPayload() {
  const lines = ["restty demo: palette", ""];
  const blocks: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    blocks.push(`\x1b[48;5;${i}m  \x1b[0m`);
  }
  lines.push(`Base 16: ${blocks.join(" ")}`);

  lines.push("");
  for (let row = 0; row < 6; row += 1) {
    const rowBlocks: string[] = [];
    for (let col = 0; col < 12; col += 1) {
      const idx = 16 + row * 12 + col;
      rowBlocks.push(`\x1b[48;5;${idx}m  \x1b[0m`);
    }
    lines.push(rowBlocks.join(""));
  }

  lines.push("");
  const gray: string[] = [];
  for (let i = 232; i <= 255; i += 1) {
    gray.push(`\x1b[48;5;${i}m \x1b[0m`);
  }
  lines.push(`Grayscale: ${gray.join("")}`);
  lines.push("");
  return `\x1b[2J\x1b[H${joinDemoLines(lines)}`;
}

export function createUnicodeDemoPayload() {
  const lines = [
    "restty demo: unicode",
    "",
    "Arrows: ← ↑ → ↓  ↖ ↗ ↘ ↙",
    "Math:   ∑ √ ∞ ≈ ≠ ≤ ≥",
    "Blocks: ░ ▒ ▓ █ ▌ ▐ ▀ ▄",
    "Lines:  ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼",
    "Braille: ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏",
    "",
  ];
  return `\x1b[2J\x1b[H${joinDemoLines(lines)}`;
}

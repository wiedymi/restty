export type PlaygroundShellScriptSpec = {
  target: string;
  fallback: string;
};

export const PLAYGROUND_SHELL_COMMANDS = [
  "./demo.sh",
  "./test.sh",
  "./ansi-art.sh",
  "./animation.sh",
  "./colors.sh",
  "./kitty.sh",
] as const;

export const STALE_NODE_SCRIPT_TARGETS = [
  "demo.js",
  "test.js",
  "ansi-art.js",
  "animation.js",
  "colors.js",
  "kitty.js",
] as const;

const ESC = "\x1b";
const CSI = `${ESC}[`;
const APC = `${ESC}_G`;
const ST = `${ESC}\\`;

function shellQuote(text: string): string {
  return `'${text.replace(/'/g, "'\"'\"'")}'`;
}

function echoLine(text = ""): string {
  return `echo ${shellQuote(text)}`;
}

function shellScript(lines: string[]): string {
  return `#!/usr/bin/env sh\n${lines.map((line) => echoLine(line)).join("\n")}\n`;
}

function range(start: number, endInclusive: number): number[] {
  return Array.from({ length: endInclusive - start + 1 }, (_, index) => start + index);
}

function colorBlock(index: number): string {
  return `${CSI}48;5;${index}m  ${CSI}0m`;
}

function foreground(index: number, text: string): string {
  return `${CSI}38;5;${index}m${text}${CSI}0m`;
}

function truecolor(r: number, g: number, b: number, text: string): string {
  return `${CSI}38;2;${r};${g};${b}m${text}${CSI}0m`;
}

function progressBar(fill: number, total = 30): string {
  return `${CSI}38;5;46m${"█".repeat(fill)}${CSI}38;5;240m${"░".repeat(total - fill)}${CSI}0m`;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    const chunk = (a << 16) | (b << 8) | c;
    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[chunk & 63] : "=";
  }
  return output;
}

function createKittyRgbPayload(width: number, height: number): string {
  const bytes = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const cx = x - width / 2;
      const cy = y - height / 2;
      const radius = Math.sqrt(cx * cx + cy * cy) / Math.sqrt(width * width + height * height);
      bytes[offset] = clampByte(255 - radius * 320 + (x / width) * 60);
      bytes[offset + 1] = clampByte(80 + (y / Math.max(1, height - 1)) * 175);
      bytes[offset + 2] = clampByte(150 + (x / Math.max(1, width - 1)) * 95);
    }
  }
  return encodeBase64(bytes);
}

const BASE16_ROWS = [
  range(0, 7).map(colorBlock).join(""),
  range(8, 15).map(colorBlock).join(""),
];

const COLOR_CUBE_ROWS = range(0, 5).map((red) => {
  const groups = range(0, 5).map((green) =>
    range(0, 5)
      .map((blue) => colorBlock(16 + red * 36 + green * 6 + blue))
      .join(""),
  );
  return groups.join(" ");
});

const GRAYSCALE_ROWS = [
  range(232, 243).map(colorBlock).join(""),
  range(244, 255).map(colorBlock).join(""),
];

const COLOR_WAVE_ROWS = range(0, 11).map((row) =>
  range(0, 39)
    .map((col) => colorBlock(16 + ((row * 13 + col * 5) % 216)))
    .join(""),
);

const TRUECOLOR_LABELS = [
  truecolor(255, 100, 0, "Orange"),
  truecolor(120, 200, 255, "Sky"),
  truecolor(160, 255, 160, "Mint"),
].join(" ");

const DONE = `${CSI}38;5;46mDone.${CSI}0m`;

const KITTY_IMAGE_WIDTH = 32;
const KITTY_IMAGE_HEIGHT = 18;
const KITTY_IMAGE_ID = 424242;
const KITTY_IMAGE_PAYLOAD = createKittyRgbPayload(KITTY_IMAGE_WIDTH, KITTY_IMAGE_HEIGHT);
const KITTY_IMAGE_PACKET =
  `${APC}a=T,f=24,t=d,s=${KITTY_IMAGE_WIDTH},v=${KITTY_IMAGE_HEIGHT},` +
  `i=${KITTY_IMAGE_ID},c=32,r=12,q=2;${KITTY_IMAGE_PAYLOAD}${ST}${CSI}12B`;

const DEMO_SH = shellScript([
  `${CSI}1;38;5;81mrestty shell demo${CSI}0m`,
  "",
  `${foreground(81, "boot")} ${progressBar(30)} 100%`,
  "",
  `${CSI}1mStyles:${CSI}0m ${CSI}1mBold${CSI}0m ${CSI}3mItalic${CSI}0m ${CSI}4mUnderline${CSI}0m`,
  `${CSI}1mUnicode:${CSI}0m 你好 世界 日本語 🇺🇸 👨‍👩‍👧`,
  `${CSI}1mSymbols:${CSI}0m ┌─┬─┐ ░▒▓█ ⠋⠙⠹⠸   `,
  `${CSI}1mTruecolor:${CSI}0m ${TRUECOLOR_LABELS}`,
  "",
  `${CSI}1mMore scripts:${CSI}0m`,
  `  ${foreground(117, "./test.sh")}`,
  `  ${foreground(117, "./ansi-art.sh")}`,
  `  ${foreground(117, "./animation.sh")}`,
  `  ${foreground(117, "./colors.sh")}`,
  `  ${foreground(117, "./kitty.sh")}`,
  "",
  DONE,
]);

const TEST_SH = shellScript([
  `${CSI}1mrestty capability test${CSI}0m`,
  "---------------------------------",
  "",
  `${CSI}1mStyles${CSI}0m`,
  `${CSI}1mBold${CSI}0m ${CSI}2mDim${CSI}0m ${CSI}3mItalic${CSI}0m ${CSI}4mUnderline${CSI}0m ${CSI}9mStrike${CSI}0m ${CSI}7mReverse${CSI}0m`,
  `${CSI}4:1mUnderline single${CSI}0m ${CSI}4:2mUnderline double${CSI}0m`,
  "",
  `${CSI}1mBase 16 colors${CSI}0m`,
  ...BASE16_ROWS,
  "",
  `${CSI}1mUnicode and width${CSI}0m`,
  "你好 世界  日本語  한글  🇺🇸 🇯🇵  👨‍👩‍👧  é ñ ä",
  "",
  `${CSI}1mBox/Braille/Symbols${CSI}0m`,
  "┌──────────────────────────────┐",
  "│  mono renderer box drawing   │",
  "└──────────────────────────────┘",
  "⠀⠁⠂⠄⡀⢀⣀⣿  ░▒▓█  ▁▂▃▄▅▆▇█      ",
  "",
  `Try: ${foreground(117, "./colors.sh")}`,
  `Try: ${foreground(117, "./ansi-art.sh")}`,
  `Try: ${foreground(117, "./animation.sh")}`,
  `Try: ${foreground(117, "./kitty.sh")}`,
  "",
  DONE,
]);

const ANSI_ART_SH = shellScript([
  `${CSI}1;38;5;81m██████╗ ███████╗███████╗████████╗████████╗██╗   ██╗${CSI}0m`,
  `${CSI}1;38;5;117m██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚══██╔══╝╚██╗ ██╔╝${CSI}0m`,
  `${CSI}1;38;5;153m██████╔╝█████╗  ███████╗   ██║      ██║    ╚████╔╝ ${CSI}0m`,
  `${CSI}1;38;5;189m██╔══██╗██╔══╝  ╚════██║   ██║      ██║     ╚██╔╝  ${CSI}0m`,
  `${CSI}1;38;5;225m██║  ██║███████╗███████║   ██║      ██║      ██║   ${CSI}0m`,
  `${CSI}1;38;5;219m╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝      ╚═╝      ╚═╝   ${CSI}0m`,
  "",
  `${CSI}1mStyles:${CSI}0m ${CSI}1mBold${CSI}0m ${CSI}2mDim${CSI}0m ${CSI}3mItalic${CSI}0m ${CSI}4mUnderline${CSI}0m ${CSI}9mStrike${CSI}0m`,
  `${CSI}1mUnicode:${CSI}0m 你好 世界  日本語  한글  🇺🇸 🇯🇵  👨‍👩‍👧`,
  `${CSI}1mSymbols:${CSI}0m ┌─┬─┐  ░▒▓█  ▁▂▃▄▅▆▇█  ⠋⠙⠹⠸      `,
  "",
  DONE,
]);

const ANIMATION_SH = shellScript([
  `${CSI}1mrestty animation showcase${CSI}0m`,
  "",
  `${foreground(81, "[|]")} warming render pipeline`,
  `${foreground(81, "[/]")} warming render pipeline`,
  `${foreground(81, "[-]")} warming render pipeline`,
  `${foreground(81, "[+]")} warming render pipeline`,
  "",
  `atlas update ${progressBar(5)}  16%`,
  `atlas update ${progressBar(15)}  50%`,
  `atlas update ${progressBar(30)} 100%`,
  "",
  ...COLOR_WAVE_ROWS,
  "",
  DONE,
]);

const COLORS_SH = shellScript([
  `${CSI}1mrestty colors showcase${CSI}0m`,
  "",
  `${CSI}1mBase 16${CSI}0m`,
  ...BASE16_ROWS,
  "",
  `${CSI}1m256-color cube${CSI}0m`,
  ...COLOR_CUBE_ROWS,
  "",
  `${CSI}1mGrayscale ramp${CSI}0m`,
  ...GRAYSCALE_ROWS,
  "",
  `${CSI}1mTruecolor text${CSI}0m`,
  TRUECOLOR_LABELS,
  "",
  DONE,
]);

const KITTY_SH = shellScript([
  `${CSI}1mrestty kitty graphics probe${CSI}0m`,
  "",
  "Transmitting built-in RGB image through the Kitty graphics protocol...",
  KITTY_IMAGE_PACKET,
  DONE,
  "If supported, the image should be visible above.",
]);

export const PLAYGROUND_SHELL_SCRIPTS: PlaygroundShellScriptSpec[] = [
  { target: "demo.sh", fallback: DEMO_SH },
  { target: "test.sh", fallback: TEST_SH },
  { target: "ansi-art.sh", fallback: ANSI_ART_SH },
  { target: "animation.sh", fallback: ANIMATION_SH },
  { target: "colors.sh", fallback: COLORS_SH },
  { target: "kitty.sh", fallback: KITTY_SH },
];

export const PLAYGROUND_SHELL_FILE_MODE = 0o755;

export const PLAYGROUND_SHELL_WELCOME = (() => {
  const osc = `${ESC}]`;
  const githubUrl = "https://github.com/wiedymi/restty";
  const githubLabel = `${CSI}4;38;5;81m${githubUrl}${CSI}0m`;
  const githubLink = `${osc}8;;${githubUrl}${ST}${githubLabel}${osc}8;;${ST}`;
  const commandLines = PLAYGROUND_SHELL_COMMANDS.map(
    (command) => `${CSI}38;5;117mTry:${CSI}0m ${command}`,
  );
  const lines = [
    "",
    `${CSI}1;38;5;81m██████╗ ███████╗███████╗████████╗████████╗██╗   ██╗${CSI}0m`,
    `${CSI}1;38;5;117m██╔══██╗██╔════╝██╔════╝╚══██╔══╝╚══██╔══╝╚██╗ ██╔╝${CSI}0m`,
    `${CSI}1;38;5;153m██████╔╝█████╗  ███████╗   ██║      ██║    ╚████╔╝ ${CSI}0m`,
    `${CSI}1;38;5;189m██╔══██╗██╔══╝  ╚════██║   ██║      ██║     ╚██╔╝  ${CSI}0m`,
    `${CSI}1;38;5;225m██║  ██║███████╗███████║   ██║      ██║      ██║   ${CSI}0m`,
    `${CSI}1;38;5;219m╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝      ╚═╝      ╚═╝   ${CSI}0m`,
    "",
    `${CSI}1mWelcome to the restty browser shell${CSI}0m`,
    "Just Bash and WebContainer use the same shell demos.",
    `GitHub: ${githubLink}`,
    "",
    ...commandLines,
    "",
  ];
  return `${lines.join("\r\n")}\r\n`;
})();

import type { WebContainer } from "@webcontainer/api";

type SeedScriptSpec = {
  urls: string[];
  target: string;
  fallback: string;
};

export type WebContainerSeedScriptContainer = Pick<WebContainer, "workdir" | "spawn" | "fs">;

const FALLBACK_DEMO_JS = `#!/usr/bin/env node
console.log("restty demo fallback");
console.log("Run: node ansi-art.js");
console.log("Run: node animation.js");
console.log("Run: node colors.js");
console.log("Run: node kitty.js");
console.log("Run: node test.js");
`;

const FALLBACK_TEST_JS = `#!/usr/bin/env node
console.log("restty test fallback");
console.log("Node is available.");
console.log("Run: node colors.js");
console.log("Run: node kitty.js");
`;

const seedScripts: SeedScriptSpec[] = [
  {
    urls: ["/demo.js", "/playground/public/demo.js"],
    target: "demo.js",
    fallback: FALLBACK_DEMO_JS,
  },
  {
    urls: ["/test.js", "/playground/public/test.js"],
    target: "test.js",
    fallback: FALLBACK_TEST_JS,
  },
  {
    urls: ["/ansi-art.js", "/playground/public/ansi-art.js"],
    target: "ansi-art.js",
    fallback: "#!/usr/bin/env node\nconsole.log('ansi-art fallback');\n",
  },
  {
    urls: ["/animation.js", "/playground/public/animation.js"],
    target: "animation.js",
    fallback: "#!/usr/bin/env node\nconsole.log('animation fallback');\n",
  },
  {
    urls: ["/colors.js", "/playground/public/colors.js"],
    target: "colors.js",
    fallback: "#!/usr/bin/env node\nconsole.log('colors fallback');\n",
  },
  {
    urls: ["/kitty.js", "/playground/public/kitty.js"],
    target: "kitty.js",
    fallback: "#!/usr/bin/env node\nconsole.log('kitty fallback');\n",
  },
];

export function normalizeFetchedScript(text: string): string | null {
  const noBom = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!noBom) return null;

  const firstNonEmpty =
    noBom
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trimStart() ?? "";
  const lower = firstNonEmpty.toLowerCase();
  if (
    lower.startsWith("<!doctype") ||
    lower.startsWith("<html") ||
    lower.startsWith("<head") ||
    lower.startsWith("<body") ||
    lower.startsWith("<")
  ) {
    return null;
  }

  if (firstNonEmpty.startsWith("#!")) {
    if (!/\b(node|bun|deno|js)\b/i.test(firstNonEmpty)) return null;
    return `${noBom}\n`;
  }
  if (!/(?:^|\n)\s*(const|let|var|function|import|export)\b/.test(noBom)) return null;
  return `${noBom}\n`;
}

async function fetchScriptText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/html")) return null;
    return normalizeFetchedScript(await res.text());
  } catch {
    return null;
  }
}

export async function fetchFirstScript(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    const text = await fetchScriptText(url);
    if (text) return text;
  }
  return null;
}

async function ensureScriptsExecutable(
  webcontainer: WebContainerSeedScriptContainer,
): Promise<void> {
  const workdir = webcontainer.workdir;
  const execPaths = [
    "demo.js",
    "test.js",
    "ansi-art.js",
    "animation.js",
    "colors.js",
    "kitty.js",
    `${workdir}/demo.js`,
    `${workdir}/test.js`,
    `${workdir}/ansi-art.js`,
    `${workdir}/animation.js`,
    `${workdir}/colors.js`,
    `${workdir}/kitty.js`,
  ];
  const chmodViaNode = await webcontainer.spawn("node", [
    "-e",
    [
      "const fs = require('node:fs');",
      "const paths = process.argv.slice(1);",
      "let touched = false;",
      "let ok = true;",
      "for (const p of paths) {",
      "  try {",
      "    if (!fs.existsSync(p)) continue;",
      "    touched = true;",
      "    const mode = fs.statSync(p).mode | 0o111;",
      "    fs.chmodSync(p, mode);",
      "    fs.accessSync(p, fs.constants.X_OK);",
      "  } catch {",
      "    ok = false;",
      "  }",
      "}",
      "if (!touched || !ok) process.exit(1);",
    ].join(" "),
    ...execPaths,
  ]);

  const nodeCode = await chmodViaNode.exit.catch(() => 1);
  if (nodeCode === 0) return;

  const chmod = await webcontainer.spawn("chmod", [
    "+x",
    "demo.js",
    "test.js",
    "ansi-art.js",
    "animation.js",
    "colors.js",
    "kitty.js",
  ]);
  const chmodCode = await chmod.exit.catch(() => 1);
  if (chmodCode !== 0) {
    throw new Error("Failed to set executable permissions for node demo scripts");
  }
}

async function removeStaleShellScripts(
  webcontainer: WebContainerSeedScriptContainer,
): Promise<void> {
  const workdir = webcontainer.workdir;
  const stalePaths = ["demo.sh", "test.sh", `${workdir}/demo.sh`, `${workdir}/test.sh`];
  const cleanup = await webcontainer.spawn("node", [
    "-e",
    [
      "const fs = require('node:fs');",
      "for (const p of process.argv.slice(1)) {",
      "  try {",
      "    fs.rmSync(p, { force: true });",
      "  } catch {",
      "    // ignore cleanup failures",
      "  }",
      "}",
    ].join(" "),
    ...stalePaths,
  ]);
  await cleanup.exit.catch(() => 1);
}

export async function ensureWebContainerSeedScripts(
  webcontainer: WebContainerSeedScriptContainer,
): Promise<void> {
  await removeStaleShellScripts(webcontainer);
  for (const spec of seedScripts) {
    const text = await fetchFirstScript(spec.urls);
    await webcontainer.fs.writeFile(spec.target, text ?? spec.fallback);
  }
  await ensureScriptsExecutable(webcontainer);
}

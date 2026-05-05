import type { WebContainer } from "@webcontainer/api";
import { fetchFirstScript } from "./webcontainer-seed-fetch.ts";
import { WEBCONTAINER_SEED_SCRIPTS } from "./webcontainer-seed-manifest.ts";

export type WebContainerSeedScriptContainer = Pick<WebContainer, "workdir" | "spawn" | "fs">;

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
  for (const spec of WEBCONTAINER_SEED_SCRIPTS) {
    const text = await fetchFirstScript(spec.urls);
    await webcontainer.fs.writeFile(spec.target, text ?? spec.fallback);
  }
  await ensureScriptsExecutable(webcontainer);
}

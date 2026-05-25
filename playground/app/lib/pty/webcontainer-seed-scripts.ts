import type { WebContainer } from "@webcontainer/api";
import { STALE_NODE_SCRIPT_TARGETS } from "./playground-shell-scripts.ts";
import { WEBCONTAINER_SEED_SCRIPTS } from "./webcontainer-seed-manifest.ts";

export type WebContainerSeedScriptContainer = Pick<WebContainer, "workdir" | "spawn" | "fs">;

async function ensureScriptsExecutable(
  webcontainer: WebContainerSeedScriptContainer,
): Promise<void> {
  const chmod = await webcontainer.spawn("chmod", [
    "+x",
    ...WEBCONTAINER_SEED_SCRIPTS.map((spec) => spec.target),
  ]);
  const chmodCode = await chmod.exit.catch(() => 1);
  if (chmodCode !== 0) {
    throw new Error("Failed to set executable permissions for shell demo scripts");
  }
}

async function removeStaleNodeScripts(
  webcontainer: WebContainerSeedScriptContainer,
): Promise<void> {
  await Promise.all(
    STALE_NODE_SCRIPT_TARGETS.map((target) =>
      webcontainer.fs.rm(target, { force: true }).catch(() => undefined),
    ),
  );
}

export async function ensureWebContainerSeedScripts(
  webcontainer: WebContainerSeedScriptContainer,
): Promise<void> {
  await removeStaleNodeScripts(webcontainer);
  for (const spec of WEBCONTAINER_SEED_SCRIPTS) {
    await webcontainer.fs.writeFile(spec.target, spec.fallback);
  }
  await ensureScriptsExecutable(webcontainer);
}

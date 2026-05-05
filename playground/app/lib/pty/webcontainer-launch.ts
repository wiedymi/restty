import { WebContainer, type WebContainerProcess } from "@webcontainer/api";
import {
  ensureWebContainerSeedScripts,
  type WebContainerSeedScriptContainer,
} from "./webcontainer-seed-scripts.ts";

export type WebContainerCommandSpec = {
  command: string;
  args: string[];
  label: string;
};

type LaunchWebContainerCommandOptions = {
  cols: number;
  rows: number;
  spec: WebContainerCommandSpec;
  cwd?: string;
  env?: Record<string, string>;
  isTokenActive: () => boolean;
  bootWebContainer?: () => Promise<WebContainerSeedScriptContainer>;
  ensureSeedScripts?: (webcontainer: WebContainerSeedScriptContainer) => Promise<void>;
};

let sharedWebContainerPromise: Promise<WebContainer> | null = null;

async function getSharedWebContainer(): Promise<WebContainer> {
  if (!sharedWebContainerPromise) {
    sharedWebContainerPromise = WebContainer.boot({ coep: "require-corp" });
  }
  return sharedWebContainerPromise;
}

export function parseWebContainerCommand(spec: string): WebContainerCommandSpec {
  const tokens = spec.match(/(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\\.|\S)+/g) ?? [];
  const cleaned = tokens.map((token) => {
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      return token.slice(1, -1);
    }
    return token.replace(/\\(.)/g, "$1");
  });
  return {
    command: cleaned[0] ?? "",
    args: cleaned.slice(1),
    label: cleaned.join(" "),
  };
}

export function normalizeWebContainerCwd(cwd: string | undefined): string | undefined {
  if (!cwd) return undefined;
  const trimmed = cwd.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith("/")) return undefined;
  return trimmed;
}

export async function launchWebContainerCommand({
  cols,
  rows,
  spec,
  cwd,
  env,
  isTokenActive,
  bootWebContainer = getSharedWebContainer,
  ensureSeedScripts = ensureWebContainerSeedScripts,
}: LaunchWebContainerCommandOptions): Promise<WebContainerProcess | null> {
  const webcontainer = await bootWebContainer();
  if (!isTokenActive()) return null;

  await ensureSeedScripts(webcontainer);
  if (!isTokenActive()) return null;

  const spawned = await webcontainer.spawn(spec.command, spec.args, {
    terminal: { cols, rows },
    cwd: normalizeWebContainerCwd(cwd),
    env: {
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      COLUMNS: String(cols),
      LINES: String(rows),
      ...env,
    },
  });

  if (!isTokenActive()) {
    try {
      spawned.kill();
    } catch {
      // Ignore kill errors during aborted startup.
    }
    return null;
  }

  return spawned;
}

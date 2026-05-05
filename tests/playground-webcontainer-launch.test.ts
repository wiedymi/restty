import { expect, test } from "bun:test";
import {
  launchWebContainerCommand,
  normalizeWebContainerCwd,
  parseWebContainerCommand,
} from "../playground/app/lib/pty/webcontainer-launch.ts";

test("parseWebContainerCommand preserves quoted args and escaped tokens", () => {
  expect(parseWebContainerCommand(`node "demo file.js" --flag=one\\ two`)).toEqual({
    command: "node",
    args: ["demo file.js", "--flag=one two"],
    label: "node demo file.js --flag=one two",
  });
});

test("normalizeWebContainerCwd keeps absolute paths and rejects blank or relative ones", () => {
  expect(normalizeWebContainerCwd(" /workspace/demo ")).toBe("/workspace/demo");
  expect(normalizeWebContainerCwd("demo")).toBeUndefined();
  expect(normalizeWebContainerCwd("   ")).toBeUndefined();
  expect(normalizeWebContainerCwd(undefined)).toBeUndefined();
});

test("launchWebContainerCommand seeds scripts and spawns with normalized env and cwd", async () => {
  const spawnCalls: Array<{
    args: string[];
    command: string;
    cwd?: string;
    env: Record<string, string>;
  }> = [];
  let seeded = 0;
  const process = {
    kill: () => {},
  };

  const spawned = await launchWebContainerCommand({
    cols: 120,
    rows: 40,
    spec: parseWebContainerCommand("jsh"),
    cwd: " /workspace/demo ",
    env: {
      HOME: "/home/user",
    },
    isTokenActive: () => true,
    bootWebContainer: async () =>
      ({
        fs: {} as never,
        spawn: async (
          command: string,
          args: string[],
          options: { cwd?: string; env: Record<string, string> },
        ) => {
          spawnCalls.push({ command, args, cwd: options.cwd, env: options.env });
          return process as never;
        },
        workdir: "/workspace",
      }) as never,
    ensureSeedScripts: async () => {
      seeded += 1;
    },
  });

  expect(spawned).toBe(process);
  expect(seeded).toBe(1);
  expect(spawnCalls).toEqual([
    {
      command: "jsh",
      args: [],
      cwd: "/workspace/demo",
      env: {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        COLUMNS: "120",
        LINES: "40",
        HOME: "/home/user",
      },
    },
  ]);
});

test("launchWebContainerCommand kills a stale spawned process", async () => {
  const calls: string[] = [];
  let checks = 0;

  const spawned = await launchWebContainerCommand({
    cols: 80,
    rows: 24,
    spec: parseWebContainerCommand("jsh"),
    isTokenActive: () => {
      checks += 1;
      return checks < 3;
    },
    bootWebContainer: async () =>
      ({
        fs: {} as never,
        spawn: async () =>
          ({
            kill: () => {
              calls.push("kill");
            },
          }) as never,
        workdir: "/workspace",
      }) as never,
    ensureSeedScripts: async () => {
      calls.push("seed");
    },
  });

  expect(spawned).toBeNull();
  expect(calls).toEqual(["seed", "kill"]);
});

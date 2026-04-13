import { afterEach, expect, test } from "bun:test";
import {
  ensureWebContainerSeedScripts,
  fetchFirstScript,
  normalizeFetchedScript,
  type WebContainerSeedScriptContainer,
} from "../playground/lib/webcontainer-seed-scripts.ts";

type SpawnCall = {
  command: string;
  args: string[];
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function createFakeWebContainer(options: {
  spawnExitCodes?: Record<string, number>;
  writes?: Map<string, string>;
}) {
  const writes = options.writes ?? new Map<string, string>();
  const spawnCalls: SpawnCall[] = [];
  const webcontainer: WebContainerSeedScriptContainer = {
    workdir: "/workspace",
    fs: {
      writeFile: async (target: string, text: string) => {
        writes.set(target, text);
      },
    } as WebContainerSeedScriptContainer["fs"],
    spawn: async (command: string, args: string[]) => {
      spawnCalls.push({ command, args });
      return {
        exit: Promise.resolve(options.spawnExitCodes?.[command] ?? 0),
      };
    },
  };

  return { spawnCalls, webcontainer, writes };
}

test("normalizeFetchedScript accepts node scripts and rejects html", () => {
  expect(normalizeFetchedScript("\uFEFF#!/usr/bin/env node\r\nconsole.log('ok');\r\n")).toBe(
    "#!/usr/bin/env node\nconsole.log('ok');\n",
  );
  expect(normalizeFetchedScript("  <html><body>not js</body></html>  ")).toBeNull();
});

test("fetchFirstScript skips html responses and keeps the first valid script", async () => {
  const seenUrls: string[] = [];
  globalThis.fetch = (async (url) => {
    seenUrls.push(String(url));
    if (String(url).includes("bad")) {
      return new Response("<html>nope</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    return new Response("export const demo = 1;", {
      status: 200,
      headers: { "content-type": "application/javascript" },
    });
  }) as typeof fetch;

  await expect(fetchFirstScript(["/bad.js", "/good.js"])).resolves.toBe("export const demo = 1;\n");
  expect(seenUrls).toEqual(["/bad.js", "/good.js"]);
});

test("ensureWebContainerSeedScripts writes fallbacks, removes legacy shell scripts, and chmods demos", async () => {
  globalThis.fetch = (async () => new Response("missing", { status: 404 })) as typeof fetch;

  const { spawnCalls, webcontainer, writes } = createFakeWebContainer({});
  await ensureWebContainerSeedScripts(webcontainer);

  expect(writes.get("demo.js")).toContain("restty demo fallback");
  expect(writes.get("test.js")).toContain("restty test fallback");
  expect(writes.get("kitty.js")).toContain("kitty fallback");
  expect(spawnCalls.map(({ command }) => command)).toEqual(["node", "node"]);
  expect(spawnCalls[0]?.args.slice(-4)).toEqual([
    "demo.sh",
    "test.sh",
    "/workspace/demo.sh",
    "/workspace/test.sh",
  ]);
  expect(spawnCalls[1]?.args.slice(-12)).toEqual([
    "demo.js",
    "test.js",
    "ansi-art.js",
    "animation.js",
    "colors.js",
    "kitty.js",
    "/workspace/demo.js",
    "/workspace/test.js",
    "/workspace/ansi-art.js",
    "/workspace/animation.js",
    "/workspace/colors.js",
    "/workspace/kitty.js",
  ]);
});

test("ensureWebContainerSeedScripts falls back to chmod when node chmod script fails", async () => {
  globalThis.fetch = (async () =>
    new Response("#!/usr/bin/env node\nconsole.log('demo');\n", {
      status: 200,
      headers: { "content-type": "application/javascript" },
    })) as typeof fetch;

  const { spawnCalls, webcontainer, writes } = createFakeWebContainer({
    spawnExitCodes: { node: 1, chmod: 0 },
  });
  await ensureWebContainerSeedScripts(webcontainer);

  expect(writes.get("demo.js")).toBe("#!/usr/bin/env node\nconsole.log('demo');\n");
  expect(spawnCalls.map(({ command }) => command)).toEqual(["node", "node", "chmod"]);
  expect(spawnCalls[2]?.args).toEqual([
    "+x",
    "demo.js",
    "test.js",
    "ansi-art.js",
    "animation.js",
    "colors.js",
    "kitty.js",
  ]);
});

import { afterEach, expect, test } from "bun:test";
import {
  ensureWebContainerSeedScripts,
  type WebContainerSeedScriptContainer,
} from "../playground/app/lib/pty/webcontainer-seed-scripts.ts";
import {
  fetchFirstScript,
  normalizeFetchedScript,
} from "../playground/app/lib/pty/webcontainer-seed-fetch.ts";

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
  removes?: string[];
  writes?: Map<string, string>;
}) {
  const removes = options.removes ?? [];
  const writes = options.writes ?? new Map<string, string>();
  const spawnCalls: SpawnCall[] = [];
  const webcontainer: WebContainerSeedScriptContainer = {
    workdir: "/workspace",
    fs: {
      rm: async (target: string) => {
        removes.push(target);
      },
      writeFile: async (target: string, text: string) => {
        writes.set(target, text);
      },
    } as WebContainerSeedScriptContainer["fs"],
    spawn: async (command: string, args: string[]) => {
      spawnCalls.push({ command, args });
      return {
        exit: Promise.resolve(options.spawnExitCodes?.[command] ?? 0),
      } as never;
    },
  };

  return { removes, spawnCalls, webcontainer, writes };
}

test("normalizeFetchedScript accepts shell scripts and rejects html or node scripts", () => {
  expect(normalizeFetchedScript("\uFEFF#!/usr/bin/env sh\r\necho ok\r\n")).toBe(
    "#!/usr/bin/env sh\necho ok\n",
  );
  expect(normalizeFetchedScript("#!/usr/bin/env node\nconsole.log('ok');\n")).toBeNull();
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
    return new Response("#!/usr/bin/env sh\necho demo\n", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }) as typeof fetch;

  await expect(fetchFirstScript(["/bad.sh", "/good.sh"])).resolves.toBe(
    "#!/usr/bin/env sh\necho demo\n",
  );
  expect(seenUrls).toEqual(["/bad.sh", "/good.sh"]);
});

test("ensureWebContainerSeedScripts writes shell fallbacks, removes stale node scripts, and chmods demos", async () => {
  const { removes, spawnCalls, webcontainer, writes } = createFakeWebContainer({});
  await ensureWebContainerSeedScripts(webcontainer);

  expect(writes.get("demo.sh")).toContain("restty shell demo");
  expect(writes.get("test.sh")).toContain("restty capability test");
  expect(writes.get("kitty.sh")).toContain("restty kitty graphics probe");
  expect(writes.get("colors.sh")).toContain("\x1b[48;5;196m");
  expect(writes.get("kitty.sh")).toContain("\x1b_Ga=T");
  expect(writes.get("kitty.sh")).not.toContain("printf");
  expect(removes).toEqual([
    "demo.js",
    "test.js",
    "ansi-art.js",
    "animation.js",
    "colors.js",
    "kitty.js",
  ]);
  expect(spawnCalls).toEqual([
    {
      command: "chmod",
      args: [
        "+x",
        "demo.sh",
        "test.sh",
        "ansi-art.sh",
        "animation.sh",
        "colors.sh",
        "kitty.sh",
      ],
    },
  ]);
});

test("ensureWebContainerSeedScripts throws when shell chmod fails", async () => {
  const { spawnCalls, webcontainer, writes } = createFakeWebContainer({
    spawnExitCodes: { chmod: 1 },
  });

  await expect(ensureWebContainerSeedScripts(webcontainer)).rejects.toThrow(
    "Failed to set executable permissions for shell demo scripts",
  );
  expect(writes.get("demo.sh")).toContain("restty shell demo");
  expect(spawnCalls).toEqual([
    {
      command: "chmod",
      args: [
        "+x",
        "demo.sh",
        "test.sh",
        "ansi-art.sh",
        "animation.sh",
        "colors.sh",
        "kitty.sh",
      ],
    },
  ]);
});

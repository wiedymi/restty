import { expect, test } from "bun:test";
import { createResttyFontResourceStore } from "../src/runtime/fonts/font-resource-store";
import type { ResttyResolvedFontSource } from "../src/runtime/core/models";

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

test("font resource store dedupes parse work for concurrent buffer acquires", async () => {
  const sharedFont = { family: "TestMono" } as any;
  let parseCalls = 0;
  const store = createResttyFontResourceStore({
    usePersistentUrlCache: false,
    parseBuffer: async () => {
      parseCalls += 1;
      await wait(5);
      return [{ font: sharedFont, metadataLabel: "Regular" }];
    },
  });

  const source: ResttyResolvedFontSource = {
    kind: "buffer",
    data: new ArrayBuffer(8),
    label: "Test Mono",
  };

  const [leaseA, leaseB] = await Promise.all([store.acquire([source]), store.acquire([source])]);

  expect(parseCalls).toBe(1);
  expect(leaseA.faces.length).toBe(1);
  expect(leaseA.faces[0]?.font).toBe(sharedFont);
  expect(leaseB.faces[0]?.font).toBe(sharedFont);

  leaseA.release();
  leaseB.release();

  const leaseC = await store.acquire([source]);
  expect(parseCalls).toBe(1);
  leaseC.release();
});

test("font resource store dedupes url fetches and reuses in-memory bytes", async () => {
  const originalFetch = globalThis.fetch;
  const payload = new Uint8Array([1, 2, 3, 4]);
  let fetchCalls = 0;

  globalThis.fetch = (async () => {
    fetchCalls += 1;
    await wait(5);
    return new Response(payload, { status: 200 });
  }) as typeof fetch;

  try {
    const sharedFont = { family: "UrlFont" } as any;
    const store = createResttyFontResourceStore({
      usePersistentUrlCache: false,
      parseBuffer: async () => [{ font: sharedFont }],
    });

    const source: ResttyResolvedFontSource = {
      kind: "url",
      url: "https://example.test/font.ttf",
      label: "URL Font",
    };

    const [leaseA, leaseB] = await Promise.all([store.acquire([source]), store.acquire([source])]);

    expect(fetchCalls).toBe(1);
    expect(leaseA.faces[0]?.font).toBe(sharedFont);
    expect(leaseB.faces[0]?.font).toBe(sharedFont);

    leaseA.release();
    leaseB.release();

    const leaseC = await store.acquire([source]);
    expect(fetchCalls).toBe(1);
    leaseC.release();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

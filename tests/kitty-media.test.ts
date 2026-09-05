import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewriteKittyFileMediaToDirect } from "../src/pty/kitty-media";
import { loadResttyWasm } from "../src/wasm/runtime/restty-wasm";

function kittyApc(params: string, payload: string, useBel = false): string {
  return `\x1b_G${params};${payload}${useBel ? "\x07" : "\x1b\\"}`;
}

test("rewrites kitty file-medium transfer to direct-medium", () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-kitty-media-"));
  try {
    const file = join(dir, "image.bin");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    writeFileSync(file, bytes);

    const state = { remainder: "" };
    const payload = Buffer.from(file).toString("base64");
    const input = kittyApc("i=77,t=f,f=100", payload);
    const out = rewriteKittyFileMediaToDirect(
      input,
      state,
      (path) => new Uint8Array(readFileSync(path)),
    );

    expect(out).toContain("\x1b_G");
    expect(out).toContain("i=77");
    expect(out).toContain("t=d");
    expect(out.includes("t=f")).toBe(false);
    expect(out).toContain(`;${bytes.toString("base64")}\x1b\\`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("handles chunk boundaries without leaking partial APC", () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-kitty-media-"));
  try {
    const file = join(dir, "image.bin");
    const bytes = Buffer.from("PNGDATA");
    writeFileSync(file, bytes);

    const state = { remainder: "" };
    const payload = Buffer.from(file).toString("base64");
    const seq = kittyApc("i=11,t=f,f=100", payload, true);
    const split = Math.floor(seq.length / 2);

    const out1 = rewriteKittyFileMediaToDirect(
      `pre:${seq.slice(0, split)}`,
      state,
      (path) => new Uint8Array(readFileSync(path)),
    );
    const out2 = rewriteKittyFileMediaToDirect(
      `${seq.slice(split)}:post`,
      state,
      (path) => new Uint8Array(readFileSync(path)),
    );

    expect(out1).toBe("pre:");
    expect(out2.startsWith("\x1b_G")).toBe(true);
    expect(out2).toContain("t=d");
    expect(out2).toContain(":post");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("leaves direct-medium transfers untouched", () => {
  const state = { remainder: "" };
  const input = kittyApc("i=9,t=d,f=100", "aGVsbG8=");
  expect(rewriteKittyFileMediaToDirect(input, state, () => new Uint8Array(0))).toBe(input);
});

test("keeps unresolved file-medium transfers untouched", () => {
  const state = { remainder: "" };
  const input = kittyApc("i=9,t=f,f=100", Buffer.from("/missing/file").toString("base64"));
  expect(
    rewriteKittyFileMediaToDirect(input, state, () => {
      throw new Error("missing");
    }),
  ).toBe(input);
});

test("drops echoed kitty response packets from PTY stream", () => {
  const state = { remainder: "" };
  const input = `before${kittyApc("i=9,p=1", "ENOENT: image not found")}after`;
  const out = rewriteKittyFileMediaToDirect(input, state, () => new Uint8Array(0));
  expect(out).toBe("beforeafter");
});

test("sanitizes invalid kitty control numeric values", () => {
  const state = { remainder: "" };
  const input = "\x1b_Gp=11,i=2031647,a=p,C=1,q=2,r=11,c=nan\x1b\\";
  const out = rewriteKittyFileMediaToDirect(input, state, () => new Uint8Array(0));
  expect(out.includes("c=nan")).toBe(false);
  expect(out).toBe("\x1b_Gp=11,i=2031647,a=p,C=1,q=2,r=11\x1b\\");
});

test("drops invalid placement dimensions without mutating valid values", () => {
  const state = { remainder: "" };
  const input = "\x1b_Ga=p,p=12,i=7,C=1,r=14,c=nan\x1b\\";
  const out = rewriteKittyFileMediaToDirect(input, state, () => new Uint8Array(0));
  expect(out).toBe("\x1b_Ga=p,p=12,i=7,C=1,r=14\x1b\\");
});

test("rewritten APC is accepted by kitty graphics parser", async () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-kitty-media-"));
  try {
    const file = join(dir, "image.png");
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
      "base64",
    );
    writeFileSync(file, png1x1);

    const state = { remainder: "" };
    const payload = Buffer.from(file).toString("base64");
    const rewritten = rewriteKittyFileMediaToDirect(
      kittyApc("a=T,t=f,f=100,i=35", payload),
      state,
      (path) => new Uint8Array(readFileSync(path)),
    );

    const wasm = await loadResttyWasm();
    const handle = wasm.create(80, 24, 1000);
    expect(handle).toBeGreaterThan(0);
    wasm.setPixelSize(handle, 800, 480);
    wasm.write(handle, rewritten);
    wasm.renderUpdate(handle);
    const placements = wasm.getKittyPlacements(handle);
    wasm.destroy(handle);

    expect(placements.length).toBeGreaterThan(0);
    expect(placements[placements.length - 1]!.imageFormat).toBe(4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

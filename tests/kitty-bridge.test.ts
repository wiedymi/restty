import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createKittyGraphicsBridge } from "../playground/kitty-graphics-bridge";
import { loadResttyWasm } from "../src/wasm/runtime";

function kittyApc(params: string, payload: string): string {
  return `\x1b_G${params};${payload}\x1b\\`;
}

test("kitty bridge rewrites file-medium transfer to direct-medium", () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-kitty-bridge-"));
  try {
    const file = join(dir, "image.png");
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    writeFileSync(file, bytes);

    const payload = Buffer.from(file).toString("base64");
    const input = kittyApc("i=77,t=f,f=100", payload);

    const bridge = createKittyGraphicsBridge();
    const out = bridge.transform(input);

    expect(out).toContain("\x1b_G");
    expect(out).toContain("i=77");
    expect(out).toContain("t=d");
    expect(out.includes("t=f")).toBe(false);
    expect(out).toContain(`;${bytes.toString("base64")}\x1b\\`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("kitty bridge handles chunk boundaries without leaking partial APC", () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-kitty-bridge-"));
  try {
    const file = join(dir, "image.png");
    const bytes = Buffer.from("PNGDATA");
    writeFileSync(file, bytes);

    const payload = Buffer.from(file).toString("base64");
    const seq = kittyApc("i=11,t=f,f=100", payload);
    const split = Math.floor(seq.length / 2);

    const bridge = createKittyGraphicsBridge();
    const out1 = bridge.transform(`pre:${seq.slice(0, split)}`);
    const out2 = bridge.transform(`${seq.slice(split)}:post`);

    expect(out1).toBe("pre:");
    expect(out2.startsWith("\x1b_G")).toBe(true);
    expect(out2).toContain("t=d");
    expect(out2).toContain(":post");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("kitty bridge leaves direct-medium transfers untouched", () => {
  const bridge = createKittyGraphicsBridge();
  const input = kittyApc("i=9,t=d,f=100", "aGVsbG8=");
  expect(bridge.transform(input)).toBe(input);
});

test("kitty bridge unwraps tmux passthrough wrappers", () => {
  const bridge = createKittyGraphicsBridge();
  const inner = kittyApc("i=9,t=d,f=100", "aGVsbG8=");
  const wrapped = `\x1bPtmux;${inner.split("\x1b").join("\x1b\x1b")}\x1b\\`;
  expect(bridge.transform(wrapped)).toBe(inner);
});

test("kitty bridge rewrites file-medium inside tmux passthrough", () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-kitty-bridge-"));
  try {
    const file = join(dir, "image.png");
    const bytes = Buffer.from("PNGDATA");
    writeFileSync(file, bytes);

    const payload = Buffer.from(file).toString("base64");
    const inner = kittyApc("i=77,t=f,f=100", payload);
    const wrapped = `\x1bPtmux;${inner.split("\x1b").join("\x1b\x1b")}\x1b\\`;
    const out = createKittyGraphicsBridge().transform(wrapped);

    expect(out).toContain("t=d");
    expect(out.includes("t=f")).toBe(false);
    expect(out).toContain(bytes.toString("base64"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("kitty bridge sanitizes invalid placement dimensions", () => {
  const bridge = createKittyGraphicsBridge();
  const input = kittyApc("a=p,U=1,i=35,p=9,C=1,c=inf,r=nan", "");
  const out = bridge.transform(input);
  expect(out).toContain("a=p");
  expect(out.includes("c=inf")).toBe(false);
  expect(out.includes("r=nan")).toBe(false);
});

test("kitty bridge clamps overly large dimensions", () => {
  const bridge = createKittyGraphicsBridge();
  const input = kittyApc("a=p,U=1,i=35,p=9,C=1,c=999999,r=500000,w=200000,h=300000", "");
  const out = bridge.transform(input);
  expect(out).toContain("c=1000");
  expect(out).toContain("r=1000");
  expect(out).toContain("w=10000");
  expect(out).toContain("h=10000");
});

test("kitty bridge drops invalid multi-char control values", () => {
  const bridge = createKittyGraphicsBridge();
  const input = kittyApc("a=p,foo=bar,c=12", "");
  const out = bridge.transform(input);
  expect(out).toContain("a=p");
  expect(out).toContain("c=12");
  expect(out.includes("foo=bar")).toBe(false);
});

test("kitty bridge resolves duplicate params using last value", () => {
  const bridge = createKittyGraphicsBridge();
  const input = kittyApc("a=p,U=0,U=1,C=1,C=0,c=40,c=20", "");
  const out = bridge.transform(input);
  expect(out).toContain("a=p");
  expect(out).toContain("U=1");
  expect(out).toContain("C=0");
  expect(out).toContain("c=20");
  expect(out.includes("U=0")).toBe(false);
  expect(out.includes("C=1")).toBe(false);
  expect(out.includes("c=40")).toBe(false);
});

test("kitty bridge normalizes integer overflow and sign mismatches", () => {
  const bridge = createKittyGraphicsBridge();
  const input = kittyApc("a=p,c=-1,z=-999999999999,H=999999999999", "");
  const out = bridge.transform(input);
  expect(out).toContain("c=0");
  expect(out).toContain("z=-2147483648");
  expect(out).toContain("H=2147483647");
});

test("kitty bridge normalizes float-like numeric params", () => {
  const bridge = createKittyGraphicsBridge();
  const input = kittyApc("a=p,c=61.0,r=12.9,x=10.4", "");
  const out = bridge.transform(input);
  expect(out).toContain("c=61");
  expect(out).toContain("r=12");
  expect(out).toContain("x=10");
});

test("kitty bridge sanitizes no-payload APC control values", () => {
  const bridge = createKittyGraphicsBridge();
  const input = "\x1b_Ga=p,U=1,i=35,p=9,C=1,c=inf,r=nan\x1b\\";
  const out = bridge.transform(input);
  expect(out).toContain("a=p");
  expect(out.includes("c=inf")).toBe(false);
  expect(out.includes("r=nan")).toBe(false);
});

test("kitty bridge repairs virtual placement columns from known image size", () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-kitty-bridge-"));
  try {
    const file = join(dir, "image.png");
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pNwAAAABJRU5ErkJggg==",
      "base64",
    );
    writeFileSync(file, png1x1);

    const bridge = createKittyGraphicsBridge();
    const tx = kittyApc("a=T,t=f,f=100,i=35", Buffer.from(file).toString("base64"));
    bridge.transform(tx);

    const out = bridge.transform(kittyApc("a=p,U=1,i=35,p=9,c=nan,r=34", ""));
    expect(out).toContain("a=p");
    expect(out).toContain("c=34");
    expect(out).toContain("r=34");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("kitty bridge keeps explicit zero source geometry values", () => {
  const bridge = createKittyGraphicsBridge();
  const input = kittyApc("a=p,i=35,w=0,h=0,x=0,y=0,X=0,Y=0", "");
  const out = bridge.transform(input);
  expect(out).toContain("w=0");
  expect(out).toContain("h=0");
  expect(out).toContain("x=0");
  expect(out).toContain("y=0");
  expect(out).toContain("X=0");
  expect(out).toContain("Y=0");
});

test("kitty bridge preserves split surrogate pairs across chunks", () => {
  const bridge = createKittyGraphicsBridge();
  const placeholder = String.fromCodePoint(0x10eeee);
  const high = placeholder[0] ?? "";
  const low = placeholder[1] ?? "";
  const out1 = bridge.transform(`A${high}`);
  const out2 = bridge.transform(`${low}B`);
  expect(out1).toBe("A");
  expect(out2).toBe(`${placeholder}B`);
});

test("rewritten APC is accepted by kitty graphics parser", async () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-kitty-bridge-"));
  try {
    const file = join(dir, "image.png");
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pNwAAAABJRU5ErkJggg==",
      "base64",
    );
    writeFileSync(file, png1x1);

    const payload = Buffer.from(file).toString("base64");
    const bridge = createKittyGraphicsBridge();
    const rewritten = bridge.transform(kittyApc("a=T,t=f,f=100,i=35", payload));

    const wasm = await loadResttyWasm();
    const handle = wasm.create(80, 24, 1000);
    expect(handle).toBeGreaterThan(0);

    wasm.setPixelSize(handle, 800, 480);
    wasm.write(handle, rewritten);
    wasm.renderUpdate(handle);

    const placements = wasm.getKittyPlacements(handle);
    wasm.destroy(handle);

    expect(placements.length).toBeGreaterThan(0);
    expect(placements[placements.length - 1]!.imageFormat).toBe(100);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

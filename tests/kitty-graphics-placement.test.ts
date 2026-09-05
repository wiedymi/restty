import { expect, test } from "bun:test";
import { loadResttyWasm } from "../src/wasm/runtime/restty-wasm";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

test("kitty graphics transmit+display (rgb) yields drawable placement", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 1000);
  expect(handle).toBeGreaterThan(0);

  wasm.setPixelSize(handle, 800, 480);
  wasm.write(handle, "\x1b_Ga=T,f=24,s=1,v=1,t=d;/wAA\x1b\\");
  wasm.renderUpdate(handle);

  const placements = wasm.getKittyPlacements(handle);
  wasm.destroy(handle);

  expect(placements.length).toBeGreaterThan(0);
  const p = placements[placements.length - 1]!;
  expect(p.imageFormat).toBe(3);
  expect(typeof p.placementId).toBe("number");
  expect(p.placementId).toBeGreaterThanOrEqual(0);
  expect(p.placementExternal).toBe(false);
  expect(p.imageWidth).toBe(1);
  expect(p.imageHeight).toBe(1);
  expect(p.sourceWidth).toBeGreaterThan(0);
  expect(p.sourceHeight).toBeGreaterThan(0);
  expect(p.imageDataPtr).toBeGreaterThan(0);
  expect(p.imageDataLen).toBe(3);
});

test("kitty graphics transmit+display (png) yields drawable placement", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 1000);
  expect(handle).toBeGreaterThan(0);

  wasm.setPixelSize(handle, 800, 480);
  wasm.write(handle, `\x1b_Ga=T,f=100,t=d;${PNG_1X1_BASE64}\x1b\\`);
  wasm.renderUpdate(handle);

  const placements = wasm.getKittyPlacements(handle);
  wasm.destroy(handle);

  expect(placements.length).toBeGreaterThan(0);
  const p = placements[placements.length - 1]!;
  expect(p.imageFormat).toBe(4);
  expect(typeof p.placementId).toBe("number");
  expect(p.placementId).toBeGreaterThanOrEqual(0);
  expect(p.placementExternal).toBe(false);
  expect(p.imageWidth).toBe(1);
  expect(p.imageHeight).toBe(1);
  expect(p.sourceWidth).toBeGreaterThan(0);
  expect(p.sourceHeight).toBeGreaterThan(0);
  expect(p.imageDataPtr).toBeGreaterThan(0);
  expect(p.imageDataLen).toBeGreaterThan(0);
});

test("kitty graphics rejects a PNG with invalid chunk data", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 1000);
  try {
    wasm.write(
      handle,
      "\x1b_Ga=T,f=100,t=d,i=7;iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pNwAAAABJRU5ErkJggg==\x1b\\",
    );
    wasm.renderUpdate(handle);
    expect(wasm.getKittyPlacements(handle)).toHaveLength(0);
    expect(wasm.drainOutput(handle)).toContain("EINVAL");
  } finally {
    wasm.destroy(handle);
  }
});

test("kitty relative placements follow their parent position", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 1000);
  try {
    wasm.setPixelSize(handle, 800, 480);
    wasm.write(handle, "\x1b_Ga=T,f=24,s=1,v=1,i=1,p=1;/wAA\x1b\\");
    wasm.write(handle, "\x1b_Ga=p,i=1,p=2,P=1,Q=1,H=3,V=2,c=2,r=2\x1b\\");
    wasm.renderUpdate(handle);
    const placements = wasm.getKittyPlacements(handle);
    const parent = placements.find((p) => p.placementId === 1)!;
    const child = placements.find((p) => p.placementId === 2)!;
    expect(child.x).toBe(parent.x + 3);
    expect(child.y).toBe(parent.y + 2);
    expect(child.width).toBe(20);
    expect(child.height).toBe(40);
  } finally {
    wasm.destroy(handle);
  }
});

test("kitty animation changes pixels and image revision at the frame deadline", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 1000);
  const pixels = () => {
    wasm.renderUpdate(handle);
    const placement = wasm.getKittyPlacements(handle)[0]!;
    return {
      revision: placement.imageRevision,
      bytes: [
        ...new Uint8Array(wasm.memory.buffer, placement.imageDataPtr, placement.imageDataLen),
      ],
    };
  };
  try {
    wasm.write(handle, "\x1b_Ga=T,f=32,s=1,v=1,i=1;/wAA/w==\x1b\\");
    wasm.write(handle, "\x1b_Ga=f,i=1,f=32,s=1,v=1,z=50;AAD//w==\x1b\\");
    wasm.write(handle, "\x1b_Ga=a,i=1,r=1,z=50,c=1,s=3\x1b\\");
    const red = pixels();
    expect(red.bytes).toEqual([255, 0, 0, 255]);
    wasm.tickKittyAnimations(handle, 1000);
    expect(wasm.tickKittyAnimations(handle, 1020)).toBe(false);
    expect(wasm.tickKittyAnimations(handle, 1060)).toBe(true);
    const blue = pixels();
    expect(blue.bytes).toEqual([0, 0, 255, 255]);
    expect(blue.revision).not.toBe(red.revision);
  } finally {
    wasm.destroy(handle);
  }
});

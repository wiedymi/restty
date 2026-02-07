import { expect, test } from "bun:test";
import { loadResttyWasm } from "../src/wasm/runtime";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pNwAAAABJRU5ErkJggg==";

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
  expect(p.imageFormat).toBe(100);
  expect(p.imageWidth).toBe(1);
  expect(p.imageHeight).toBe(1);
  expect(p.sourceWidth).toBeGreaterThan(0);
  expect(p.sourceHeight).toBeGreaterThan(0);
  expect(p.imageDataPtr).toBeGreaterThan(0);
  expect(p.imageDataLen).toBeGreaterThan(0);
});

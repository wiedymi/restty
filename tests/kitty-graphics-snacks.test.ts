import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewriteKittyFileMediaToDirect } from "../src/pty/kitty-media";
import { loadResttyWasm } from "../src/wasm/runtime/restty-wasm";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";

const PLACEHOLDER_GRID_4X2 =
  "\u{10EEEE}\u0305\u0305\u{10EEEE}\u0305\u030D\u{10EEEE}\u0305\u030E\u{10EEEE}\u0305\u0310\n" +
  "\u{10EEEE}\u030D\u0305\u{10EEEE}\u030D\u030D\u{10EEEE}\u030D\u030E\u{10EEEE}\u030D\u0310\n";

test("snacks-style file-medium + unicode placeholders produce virtual placements", async () => {
  const dir = mkdtempSync(join(tmpdir(), "restty-snacks-kitty-"));
  try {
    const file = join(dir, "image.png");
    writeFileSync(file, Buffer.from(PNG_1X1_BASE64, "base64"));
    const imageId = 12345;

    const rewritten = rewriteKittyFileMediaToDirect(
      `\x1b_Gt=f,i=${imageId},f=100,q=2;${Buffer.from(file).toString("base64")}\x1b\\`,
      { remainder: "" },
      (path) => new Uint8Array(readFileSync(path)),
    );

    const r = (imageId >> 16) & 0xff;
    const g = (imageId >> 8) & 0xff;
    const b = imageId & 0xff;
    const coloredPlaceholders = `\x1b[38;2;${r};${g};${b}m${PLACEHOLDER_GRID_4X2}\x1b[39m`;
    const place = `\x1b_Ga=p,U=1,i=${imageId},p=11,C=1,c=4,r=2,q=2\x1b\\`;

    const wasm = await loadResttyWasm();
    const handle = wasm.create(120, 40, 1000);
    expect(handle).toBeGreaterThan(0);
    wasm.setPixelSize(handle, 1200, 800);
    wasm.write(handle, rewritten);
    wasm.write(handle, coloredPlaceholders);
    wasm.write(handle, place);
    wasm.renderUpdate(handle);

    const placements = wasm.getKittyPlacements(handle);
    wasm.destroy(handle);

    expect(placements.length).toBeGreaterThan(0);
    expect(placements.some((p) => p.imageId === imageId && p.z === -1)).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

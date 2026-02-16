import { expect, test } from "bun:test";
import { loadResttyWasm } from "../src/wasm/runtime/restty-wasm";

test("resize with hyperlinks in scrollback does not crash", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 10_000_000);
  expect(handle).toBeGreaterThan(0);

  for (let i = 0; i < 500; i++) {
    const uri = `https://example.com/item/${i}?session=test123`;
    wasm.write(handle, `\x1b]8;;${uri}\x1b\\Hyperlinked text line ${i}\x1b]8;;\x1b\\\r\n`);
  }

  wasm.resize(handle, 40, 24);
  wasm.resize(handle, 80, 24);
  wasm.resize(handle, 20, 24);
  wasm.resize(handle, 120, 24);

  wasm.destroy(handle);
});

test("resize with hyperlinks and small scrollback", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(40, 10, 500);
  expect(handle).toBeGreaterThan(0);

  for (let i = 0; i < 100; i++) {
    const uri = `https://example.com/path/${i}`;
    wasm.write(handle, `\x1b]8;;${uri}\x1b\\Link ${i}\x1b]8;;\x1b\\\r\n`);
  }

  wasm.resize(handle, 20, 10);
  wasm.resize(handle, 80, 10);
  wasm.resize(handle, 10, 10);
  wasm.resize(handle, 40, 10);

  wasm.destroy(handle);
});

test("chunked hyperlink delivery then resize", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 10_000_000);
  expect(handle).toBeGreaterThan(0);

  let allData = "";
  for (let i = 0; i < 500; i++) {
    const uri = `https://example.com/item/${i}?session=test123`;
    allData += `\x1b]8;;${uri}\x1b\\Hyperlinked text line ${i}\x1b]8;;\x1b\\\r\n`;
  }

  // Deliver in chunks that split mid-escape-sequence.
  let offset = 0;
  const chunkSizes = [13, 47, 7, 128, 3, 64, 256, 11, 1, 512];
  let chunkIdx = 0;
  while (offset < allData.length) {
    const size = Math.min(chunkSizes[chunkIdx % chunkSizes.length], allData.length - offset);
    wasm.write(handle, allData.substring(offset, offset + size));
    offset += size;
    chunkIdx++;
  }

  wasm.resize(handle, 40, 24);
  wasm.resize(handle, 80, 24);
  wasm.resize(handle, 20, 24);
  wasm.resize(handle, 120, 24);

  wasm.destroy(handle);
});

test("rapid resize with hyperlinks", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(80, 24, 5_000);
  expect(handle).toBeGreaterThan(0);

  for (let i = 0; i < 200; i++) {
    const uri = `https://example.com/item/${i}?extra=padding&more=data`;
    wasm.write(handle, `\x1b]8;;${uri}\x1b\\Line ${i} with some extra text to fill columns\x1b]8;;\x1b\\\r\n`);
  }

  for (let cols = 80; cols >= 20; cols -= 5) {
    wasm.resize(handle, cols, 24);
  }
  for (let cols = 20; cols <= 120; cols += 5) {
    wasm.resize(handle, cols, 24);
  }

  wasm.destroy(handle);
});

test("large session with mixed content then resize (botster scenario)", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(175, 43, 10_000_000);
  expect(handle).toBeGreaterThan(0);

  // 50K lines + 2500 hyperlinks across 10MB scrollback.
  for (let batch = 0; batch < 500; batch++) {
    let text = "";
    for (let line = 0; line < 100; line++) {
      text += `  This is line ${batch * 100 + line} of output with some typical content that fills the terminal width reasonably well and includes various debugging info\r\n`;
    }
    wasm.write(handle, text);

    for (let link = 0; link < 5; link++) {
      const uri = `https://example.com/file/${batch}/${link}?ref=main&line=${batch * 10 + link}`;
      wasm.write(handle, `\x1b]8;;${uri}\x1b\\src/components/file_${batch}_${link}.tsx:${link + 1}\x1b]8;;\x1b\\\r\n`);
    }
  }

  wasm.resize(handle, 80, 43);
  wasm.resize(handle, 175, 43);

  wasm.destroy(handle);
});

test("large session WITHOUT hyperlinks then resize", async () => {
  const wasm = await loadResttyWasm();
  const handle = wasm.create(175, 43, 10_000_000);
  expect(handle).toBeGreaterThan(0);

  for (let batch = 0; batch < 500; batch++) {
    let text = "";
    for (let line = 0; line < 105; line++) {
      text += `  This is line ${batch * 105 + line} of output with some typical content that fills the terminal width reasonably well and includes various debugging info\r\n`;
    }
    wasm.write(handle, text);
  }

  wasm.resize(handle, 80, 43);
  wasm.resize(handle, 175, 43);

  wasm.destroy(handle);
});

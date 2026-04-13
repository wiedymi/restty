import { expect, test } from "bun:test";
import { readPastePayloadFromDataTransfer } from "../src/runtime/create-runtime/clipboard-paste";

type MockDataTransfer = {
  getData: (type: string) => string;
  items?: Array<{ kind: string; type: string; getAsFile?: () => File | null }>;
  files?: File[];
};

function createDataTransfer(overrides: Partial<MockDataTransfer>): DataTransfer {
  return {
    getData: (type: string) => (type === "text/plain" ? "" : ""),
    ...overrides,
  } as unknown as DataTransfer;
}

test("readPastePayloadFromDataTransfer reads text/plain content", () => {
  const payload = readPastePayloadFromDataTransfer(
    createDataTransfer({
      getData: (type) => (type === "text/plain" ? "hello" : ""),
    }),
  );

  expect(payload).toEqual({ kind: "text", text: "hello" });
});

test("readPastePayloadFromDataTransfer ignores non-text payloads", () => {
  const image = new Blob([Uint8Array.of(1, 2, 3)], { type: "image/png" }) as File;
  const payload = readPastePayloadFromDataTransfer(
    createDataTransfer({
      getData: () => "",
      items: [{ kind: "file", type: "image/png", getAsFile: () => image }],
    }),
  );

  expect(payload).toBeNull();
});

test("readPastePayloadFromDataTransfer returns null when empty", () => {
  const image = new Blob([Uint8Array.of(4, 5, 6)], { type: "image/jpeg" }) as File;
  const payload = readPastePayloadFromDataTransfer(
    createDataTransfer({
      getData: () => "",
      files: [image],
    }),
  );

  expect(payload).toBeNull();
});

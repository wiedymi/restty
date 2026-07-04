import { expect, test } from "bun:test";
import { encodeBeforeInput, encodeKeyEvent, mapKeyForPty, sequences } from "../src/input/keymap";

type KeyEventOverrides = Partial<KeyboardEvent> & {
  key: string;
  code?: string;
};

function keyEvent(overrides: KeyEventOverrides): KeyboardEvent {
  const base = {
    key: overrides.key,
    code: overrides.code ?? "",
    type: overrides.type ?? "keydown",
    repeat: overrides.repeat ?? false,
    isComposing: overrides.isComposing ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    altKey: overrides.altKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    metaKey: overrides.metaKey ?? false,
    getModifierState: (_mod: string) => false,
  };
  return { ...base, ...overrides } as KeyboardEvent;
}

type BeforeInputOverrides = Partial<InputEvent> & {
  inputType: string;
  data?: string | null;
};

function beforeInputEvent(overrides: BeforeInputOverrides): InputEvent {
  const base = {
    inputType: overrides.inputType,
    data: overrides.data ?? null,
    dataTransfer: null,
  };
  return { ...base, ...overrides } as InputEvent;
}

test("default keymap emits terminal-standard backspace/delete", () => {
  expect(encodeKeyEvent(keyEvent({ key: "Backspace", code: "Backspace" }))).toBe("\x7f");
  expect(encodeKeyEvent(keyEvent({ key: "Delete", code: "Delete" }))).toBe("\x1b[3~");
  expect(sequences.backspace).toBe("\x7f");
  expect(sequences.delete).toBe("\x1b[3~");
});

test("default keymap supports shell line start and end bindings", () => {
  expect(encodeKeyEvent(keyEvent({ key: "a", code: "KeyA", ctrlKey: true }))).toBe("\x01");
  expect(encodeKeyEvent(keyEvent({ key: "e", code: "KeyE", ctrlKey: true }))).toBe("\x05");
  expect(encodeKeyEvent(keyEvent({ key: "Home", code: "Home" }))).toBe("\x1b[H");
  expect(encodeKeyEvent(keyEvent({ key: "End", code: "End" }))).toBe("\x1b[F");
});

test("default keymap supports shell word navigation shortcuts", () => {
  expect(encodeKeyEvent(keyEvent({ key: "ArrowLeft", code: "ArrowLeft", ctrlKey: true }))).toBe(
    "\x1bb",
  );
  expect(encodeKeyEvent(keyEvent({ key: "ArrowRight", code: "ArrowRight", ctrlKey: true }))).toBe(
    "\x1bf",
  );
  expect(encodeKeyEvent(keyEvent({ key: "ArrowLeft", code: "ArrowLeft", metaKey: true }))).toBe(
    "\x1bb",
  );
  expect(encodeKeyEvent(keyEvent({ key: "ArrowRight", code: "ArrowRight", metaKey: true }))).toBe(
    "\x1bf",
  );
  expect(
    encodeKeyEvent(
      keyEvent({ key: "ArrowLeft", code: "ArrowLeft", ctrlKey: true, shiftKey: true }),
    ),
  ).toBe("\x1b[1;6D");
});

test("default keymap keeps non-navigation command shortcuts local", () => {
  expect(encodeKeyEvent(keyEvent({ key: "d", code: "KeyD", metaKey: true }))).toBe("");
});

test("beforeinput delete events map to terminal-standard sequences", () => {
  expect(encodeBeforeInput(beforeInputEvent({ inputType: "deleteContentBackward" }))).toBe("\x7f");
  expect(encodeBeforeInput(beforeInputEvent({ inputType: "deleteContentForward" }))).toBe(
    "\x1b[3~",
  );
  expect(encodeBeforeInput(beforeInputEvent({ inputType: "deleteWordBackward" }))).toBe("\x7f");
  expect(encodeBeforeInput(beforeInputEvent({ inputType: "deleteWordForward" }))).toBe("\x1b[3~");
  expect(encodeBeforeInput(beforeInputEvent({ inputType: "insertParagraph" }))).toBe("\r");
});

test("mapKeyForPty normalizes legacy delete/backspace payloads", () => {
  expect(mapKeyForPty("\x08")).toBe("\x7f");
  expect(mapKeyForPty("\x08\x1b[P")).toBe("\x7f");
  expect(mapKeyForPty("\x1b[P")).toBe("\x1b[3~");
  expect(mapKeyForPty("\r\n")).toBe("\r");
});

test("mapKeyForPty normalizes only legacy-compatible kitty key payloads", () => {
  expect(mapKeyForPty("\x1b[127u")).toBe("\x7f");
  expect(mapKeyForPty("\x1b[127;1u")).toBe("\x7f");
  expect(mapKeyForPty("\x1b[127;1:1u")).toBe("\x7f");
  expect(mapKeyForPty("\x1b[13u")).toBe("\r");
  expect(mapKeyForPty("\x1b[3;1:1~")).toBe("\x1b[3~");
  expect(mapKeyForPty("\x1b[13;2u")).toBe("\x1b[13;2u");
  expect(mapKeyForPty("\x1b[9;2u")).toBe("\x1b[9;2u");
  expect(mapKeyForPty("\x1b[3;2~")).toBe("\x1b[3;2~");
  expect(mapKeyForPty("\x1b[127;1:3u")).toBe("\x1b[127;1:3u");
  expect(mapKeyForPty("\x1b[3;1:3~")).toBe("\x1b[3;1:3~");
});

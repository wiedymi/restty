import { expect, test } from "bun:test";
import { fitTextTailToWidth } from "../src/runtime/create-runtime/create-app-io-utils";

test("fitTextTailToWidth keeps full text when it already fits", () => {
  const result = fitTextTailToWidth("hello", 50, (value) => value.length * 10);
  expect(result).toEqual({
    text: "hello",
    offset: 0,
    widthPx: 50,
  });
});

test("fitTextTailToWidth trims from the left to preserve the text tail", () => {
  const result = fitTextTailToWidth("abcdef", 30, (value) => value.length * 10);
  expect(result).toEqual({
    text: "def",
    offset: 3,
    widthPx: 30,
  });
});

test("fitTextTailToWidth respects unicode codepoint boundaries", () => {
  const result = fitTextTailToWidth("a😀b", 20, (value) => Array.from(value).length * 10);
  expect(result).toEqual({
    text: "😀b",
    offset: 1,
    widthPx: 20,
  });
});

test("fitTextTailToWidth clamps width when even a single codepoint exceeds max", () => {
  const result = fitTextTailToWidth("abcd", 5, (value) => value.length * 10);
  expect(result).toEqual({
    text: "d",
    offset: 3,
    widthPx: 5,
  });
});

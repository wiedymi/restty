import { expect, test } from "bun:test";
import {
  createFontEntry,
  createFontManagerState,
  isColorEmojiFont,
  isNerdSymbolFont,
  isSymbolFont,
  pickFontIndexForText,
} from "../src/fonts";
import { isLikelyEmojiCodepoint } from "../src/runtime/create-runtime/codepoint-utils";
import { DEFAULT_FONT_INPUTS, resolveFontInputs } from "../src/runtime/fonts/font-sources";

const DEFAULT_RESOLVED_FONTS = resolveFontInputs(DEFAULT_FONT_INPUTS);

function makeFont(codepoints: number[]) {
  const glyphSet = new Set(codepoints);
  return {
    upem: 1000,
    ascender: 800,
    descender: -200,
    height: 1000,
    scaleForSize(sizePx: number) {
      return sizePx / 1000;
    },
    glyphIdForChar(ch: string) {
      const cp = ch.codePointAt(0) ?? 0;
      return glyphSet.has(cp) ? cp : 0;
    },
    advanceWidth() {
      return 600;
    },
    getGlyphBounds() {
      return { xMin: 0, xMax: 600, yMin: 0, yMax: 1000 };
    },
  };
}

test("font picking follows fallback order for matching glyphs", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x41]), "Primary Mono"),
    createFontEntry(makeFont([0x25a3]), "Symbols Nerd Font"),
    createFontEntry(makeFont([0x25a3]), "Noto Sans Symbols 2"),
  ];
  const picked = pickFontIndexForText(state, String.fromCodePoint(0x25a3), 1);
  expect(picked).toBe(1);
});

test("emoji presentation prefers color emoji fonts", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x1f600]), "Primary Mono"),
    createFontEntry(makeFont([0x1f600]), "Noto Color Emoji"),
  ];
  const picked = pickFontIndexForText(state, String.fromCodePoint(0x1f600), 1);
  expect(picked).toBe(1);
});

test("emoji presentation treats OpenMoji as an emoji fallback", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x1f95f]), "Primary Mono"),
    createFontEntry(makeFont([0x1f95f]), "OpenMoji"),
  ];
  const picked = pickFontIndexForText(state, String.fromCodePoint(0x1f95f), 2);
  expect(picked).toBe(1);
  expect(isColorEmojiFont(state.fonts[1])).toBe(true);
});

test("emoji-like symbols without selectors prefer color emoji fonts", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x270d]), "Primary Mono"),
    createFontEntry(makeFont([0x270d]), "Noto Color Emoji"),
  ];
  const picked = pickFontIndexForText(state, String.fromCodePoint(0x270d), 1);
  expect(picked).toBe(1);
});

test("text presentation selector prefers non-emoji fonts", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x2764, 0xfe0e]), "Primary Mono"),
    createFontEntry(makeFont([0x2764, 0xfe0e]), "Noto Color Emoji"),
  ];
  const text = `${String.fromCodePoint(0x2764)}${String.fromCodePoint(0xfe0e)}`;
  const picked = pickFontIndexForText(state, text, 1);
  expect(picked).toBe(0);
});

test("emoji ZWJ sequence ignores join controls when selecting emoji fallback", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x41]), "Primary Mono"),
    createFontEntry(makeFont([0x1f468, 0x1f469, 0x1f467]), "Noto Color Emoji"),
  ];
  const text = `${String.fromCodePoint(0x1f468)}\u200d${String.fromCodePoint(0x1f469)}\u200d${String.fromCodePoint(0x1f467)}`;
  const picked = pickFontIndexForText(state, text, 2);
  expect(picked).toBe(1);
});

test("combining marks do not force symbol fallback for Latin text", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x65, 0x6e, 0x61]), "Primary Mono"),
    createFontEntry(makeFont([0x65, 0x6e, 0x61, 0x0301, 0x0303, 0x0308]), "Symbola"),
  ];
  const text = `e${String.fromCodePoint(0x0301)}`;
  const picked = pickFontIndexForText(state, text, 1);
  expect(picked).toBe(0);
});

test("non-nerd symbols prefer first matching fallback in order", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x276f]), "Primary Nerd Mono"),
    createFontEntry(makeFont([0x276f]), "Noto Sans Symbols 2"),
  ];
  const picked = pickFontIndexForText(state, String.fromCodePoint(0x276f), 1);
  expect(picked).toBe(0);
});

test("default fonts prioritize Noto symbols before Symbola fallback", () => {
  const urls = DEFAULT_RESOLVED_FONTS.filter((source) => source.kind === "url").map(
    (source) => source.url,
  );
  const primaryIndex = urls.findIndex((url) =>
    url.includes("JetBrainsMonoNLNerdFontMono-Regular.ttf"),
  );
  const boldIndex = urls.findIndex((url) => url.includes("JetBrainsMonoNLNerdFontMono-Bold.ttf"));
  const italicIndex = urls.findIndex((url) =>
    url.includes("JetBrainsMonoNLNerdFontMono-Italic.ttf"),
  );
  const boldItalicIndex = urls.findIndex((url) =>
    url.includes("JetBrainsMonoNLNerdFontMono-BoldItalic.ttf"),
  );
  const symbolaIndex = urls.findIndex((url) => url.includes("ttf-symbola"));
  const notoSymbolsIndex = urls.findIndex((url) => url.includes("NotoSansSymbols2-Regular.ttf"));
  expect(primaryIndex).toBe(0);
  expect(boldIndex).toBeGreaterThan(primaryIndex);
  expect(italicIndex).toBeGreaterThan(boldIndex);
  expect(boldItalicIndex).toBeGreaterThan(italicIndex);
  expect(symbolaIndex).toBeGreaterThanOrEqual(0);
  expect(notoSymbolsIndex).toBeGreaterThanOrEqual(0);
  expect(notoSymbolsIndex).toBeLessThan(symbolaIndex);
});

test("default fonts prefer local JetBrains and Nerd symbols before CDN fallbacks", () => {
  const jetbrainsLocalIndex = DEFAULT_RESOLVED_FONTS.findIndex(
    (source) =>
      source.kind === "local" &&
      source.matchers.some((matcher) => matcher.includes("jetbrains mono")),
  );
  const jetbrainsUrlIndex = DEFAULT_RESOLVED_FONTS.findIndex(
    (source) =>
      source.kind === "url" && source.url.includes("JetBrainsMonoNLNerdFontMono-Regular.ttf"),
  );

  const nerdSymbolsLocalIndex = DEFAULT_RESOLVED_FONTS.findIndex(
    (source) =>
      source.kind === "local" &&
      source.matchers.some((matcher) => matcher.includes("symbols nerd font")),
  );
  const nerdSymbolsUrlIndex = DEFAULT_RESOLVED_FONTS.findIndex(
    (source) => source.kind === "url" && source.url.includes("SymbolsNerdFont-Regular.ttf"),
  );

  expect(jetbrainsLocalIndex).toBeGreaterThanOrEqual(0);
  expect(jetbrainsUrlIndex).toBeGreaterThanOrEqual(0);
  expect(jetbrainsLocalIndex).toBeLessThan(jetbrainsUrlIndex);

  expect(nerdSymbolsLocalIndex).toBeGreaterThanOrEqual(0);
  expect(nerdSymbolsUrlIndex).toBeGreaterThanOrEqual(0);
  expect(nerdSymbolsLocalIndex).toBeLessThan(nerdSymbolsUrlIndex);
});

test("symbol font classification includes Symbola and Apple Symbols", () => {
  const sampleFont = makeFont([0x21b5]);
  expect(isSymbolFont(createFontEntry(sampleFont, "Symbola"))).toBe(true);
  expect(isSymbolFont(createFontEntry(sampleFont, "Apple Symbols"))).toBe(true);
});

test("font classification accepts filename-derived labels", () => {
  const sampleFont = makeFont([0x21b5]);
  expect(isColorEmojiFont(createFontEntry(sampleFont, "NotoColorEmoji.ttf"))).toBe(true);
  expect(isSymbolFont(createFontEntry(sampleFont, "NotoSansSymbols2-Regular.ttf"))).toBe(true);
  expect(isNerdSymbolFont(createFontEntry(sampleFont, "SymbolsNerdFont-Regular.ttf"))).toBe(true);
});

test("runtime emoji heuristic includes common symbol ranges", () => {
  expect(isLikelyEmojiCodepoint(0x231a)).toBe(true);
  expect(isLikelyEmojiCodepoint(0x270d)).toBe(true);
  expect(isLikelyEmojiCodepoint(0x2b50)).toBe(true);
});

test("default local fallback includes robust Apple matcher aliases", () => {
  const localSources = DEFAULT_RESOLVED_FONTS.filter((source) => source.kind === "local");
  const appleSymbols = localSources.find((source) => source.label === "Apple Symbols");
  const appleEmoji = localSources.find((source) => source.label === "Apple Color Emoji");
  expect(appleSymbols?.matchers.includes("apple symbols")).toBe(true);
  expect(appleSymbols?.matchers.includes("applesymbols")).toBe(true);
  expect(appleEmoji?.matchers.includes("apple color emoji")).toBe(true);
  expect(appleEmoji?.matchers.includes("applecoloremoji")).toBe(true);
});

test("default fonts include canadian aboriginal fallback for syllabics", () => {
  const canadianUrlIndex = DEFAULT_RESOLVED_FONTS.findIndex(
    (source) =>
      source.kind === "url" && source.url.includes("NotoSansCanadianAboriginal-Regular.ttf"),
  );
  const canadianLocalSource = DEFAULT_RESOLVED_FONTS.find(
    (source) =>
      source.kind === "local" &&
      source.matchers.some((matcher) => matcher.includes("canadian aboriginal")),
  );
  expect(canadianUrlIndex).toBeGreaterThanOrEqual(0);
  expect(canadianLocalSource).toBeTruthy();
  if (canadianLocalSource?.kind === "local") {
    expect(canadianLocalSource.matchers.includes("euphemia ucas")).toBe(true);
  }
});

test("font input resolver uses the new public shape and rejects legacy source objects", () => {
  const resolved = resolveFontInputs([
    { family: "Fira Code", local: "require" },
    "fonts/FiraCode-Regular.ttf",
    { data: new Uint8Array([1, 2, 3]), name: "Buffer Font" },
  ]);

  expect(resolved[0]).toMatchObject({
    kind: "local",
    family: "Fira Code",
    required: true,
  });
  expect(resolved[1]).toMatchObject({
    kind: "url",
    url: "fonts/FiraCode-Regular.ttf",
  });
  expect(resolved[2]).toMatchObject({
    kind: "buffer",
    label: "Buffer Font",
  });

  expect(() =>
    resolveFontInputs([{ type: "url", url: "https://example.test/font.ttf" } as any]),
  ).toThrow("removed legacy font source shape");
});

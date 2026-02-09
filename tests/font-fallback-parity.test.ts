import { expect, test } from "bun:test";
import {
  createFontEntry,
  createFontManagerState,
  isSymbolFont,
  pickFontIndexForText,
  type FontEntry,
} from "../src/fonts";
import { DEFAULT_FONT_SOURCES } from "../src/app/font-sources";

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

function shapeClusterWithFont(entry: FontEntry, text: string) {
  const chars = Array.from(text);
  let advance = 0;
  const glyphs = chars.map((ch) => {
    const glyphId = entry.font.glyphIdForChar(ch);
    advance += 600;
    return { glyphId, xAdvance: 600, yAdvance: 0, xOffset: 0, yOffset: 0 };
  });
  return { glyphs, advance };
}

test("font picking follows fallback order for matching glyphs", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x41]), "Primary Mono"),
    createFontEntry(makeFont([0x25a3]), "Symbols Nerd Font Mono"),
    createFontEntry(makeFont([0x25a3]), "Noto Sans Symbols 2"),
  ];
  const picked = pickFontIndexForText(state, String.fromCodePoint(0x25a3), 1, shapeClusterWithFont);
  expect(picked).toBe(1);
});

test("emoji presentation prefers color emoji fonts", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x1f600]), "Primary Mono"),
    createFontEntry(makeFont([0x1f600]), "Noto Color Emoji"),
  ];
  const picked = pickFontIndexForText(state, String.fromCodePoint(0x1f600), 1, shapeClusterWithFont);
  expect(picked).toBe(1);
});

test("text presentation selector prefers non-emoji fonts", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x2764, 0xfe0e]), "Primary Mono"),
    createFontEntry(makeFont([0x2764, 0xfe0e]), "Noto Color Emoji"),
  ];
  const text = `${String.fromCodePoint(0x2764)}${String.fromCodePoint(0xfe0e)}`;
  const picked = pickFontIndexForText(state, text, 1, shapeClusterWithFont);
  expect(picked).toBe(0);
});

test("non-nerd symbols prefer first matching fallback in order", () => {
  const state = createFontManagerState();
  state.fonts = [
    createFontEntry(makeFont([0x276f]), "Primary Nerd Mono"),
    createFontEntry(makeFont([0x276f]), "Noto Sans Symbols 2"),
  ];
  const picked = pickFontIndexForText(state, String.fromCodePoint(0x276f), 1, shapeClusterWithFont);
  expect(picked).toBe(0);
});

test("default font sources prioritize Noto symbols before Symbola fallback", () => {
  const urls = DEFAULT_FONT_SOURCES.filter((source) => source.type === "url").map((source) => source.url);
  const primaryIndex = urls.findIndex((url) => url.includes("JetBrainsMonoNLNerdFontMono-Regular.ttf"));
  const boldIndex = urls.findIndex((url) => url.includes("JetBrainsMonoNLNerdFontMono-Bold.ttf"));
  const italicIndex = urls.findIndex((url) => url.includes("JetBrainsMonoNLNerdFontMono-Italic.ttf"));
  const boldItalicIndex = urls.findIndex((url) => url.includes("JetBrainsMonoNLNerdFontMono-BoldItalic.ttf"));
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

test("default font sources prefer local JetBrains and Nerd symbols before CDN fallbacks", () => {
  const jetbrainsLocalIndex = DEFAULT_FONT_SOURCES.findIndex(
    (source) =>
      source.type === "local" &&
      source.matchers.some((matcher) => matcher.includes("jetbrains mono")),
  );
  const jetbrainsUrlIndex = DEFAULT_FONT_SOURCES.findIndex(
    (source) =>
      source.type === "url" && source.url.includes("JetBrainsMonoNLNerdFontMono-Regular.ttf"),
  );

  const nerdSymbolsLocalIndex = DEFAULT_FONT_SOURCES.findIndex(
    (source) =>
      source.type === "local" &&
      source.matchers.some((matcher) => matcher.includes("symbols nerd font")),
  );
  const nerdSymbolsUrlIndex = DEFAULT_FONT_SOURCES.findIndex(
    (source) =>
      source.type === "url" && source.url.includes("SymbolsNerdFontMono-Regular.ttf"),
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

test("default local fallback includes robust Apple matcher aliases", () => {
  const localSources = DEFAULT_FONT_SOURCES.filter((source) => source.type === "local");
  const appleSymbols = localSources.find((source) => source.label === "Apple Symbols");
  const appleEmoji = localSources.find((source) => source.label === "Apple Color Emoji");
  expect(appleSymbols?.matchers.includes("apple symbols")).toBe(true);
  expect(appleSymbols?.matchers.includes("applesymbols")).toBe(true);
  expect(appleEmoji?.matchers.includes("apple color emoji")).toBe(true);
  expect(appleEmoji?.matchers.includes("applecoloremoji")).toBe(true);
});

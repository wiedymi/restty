import { expect, test } from "bun:test";
import {
  buildFontSourcesForSelection,
  resolveFontHintTarget,
  supportsLocalFontPicker,
  syncFontFamilyControls,
  syncHintingControls,
} from "../playground/lib/font-controls.ts";

test("buildFontSourcesForSelection keeps local matcher first and preset sources ahead of fallbacks", () => {
  const sources = buildFontSourcesForSelection("fira-code", "fira code retina");

  expect(sources[0]).toMatchObject({
    type: "local",
    label: "local:fira code retina",
    matchers: ["fira code retina"],
    required: true,
  });
  expect(sources[1]).toMatchObject({
    type: "local",
    label: "local:fira code",
  });
  expect(sources[4]).toMatchObject({
    type: "local",
    label: "local:fira code bold italic",
  });
  expect(sources[5]).toMatchObject({
    type: "url",
    label: "Fira Code Regular",
  });
  expect(sources.some((source) => source.label === "JetBrains Mono Regular")).toBe(true);
  expect(sources.at(-1)).toMatchObject({
    type: "url",
    label: "Noto Sans CJK SC",
  });
});

test("resolveFontHintTarget falls back to auto for invalid values", () => {
  expect(resolveFontHintTarget("light")).toBe("light");
  expect(resolveFontHintTarget("normal")).toBe("normal");
  expect(resolveFontHintTarget("auto")).toBe("auto");
  expect(resolveFontHintTarget("weird")).toBe("auto");
  expect(resolveFontHintTarget(null)).toBe("auto");
});

test("supportsLocalFontPicker only returns true when queryLocalFonts exists", () => {
  expect(supportsLocalFontPicker({ queryLocalFonts() {} })).toBe(true);
  expect(supportsLocalFontPicker({})).toBe(false);
  expect(supportsLocalFontPicker(null)).toBe(false);
});

test("syncFontFamilyControls updates selected values and disabled state", () => {
  const fontFamilySelect = { value: "" } as HTMLSelectElement;
  const fontFamilyLocalSelect = { value: "", disabled: false } as HTMLSelectElement;
  const btnLoadLocalFonts = { disabled: false } as HTMLButtonElement;

  syncFontFamilyControls({
    fontFamilySelect,
    fontFamilyLocalSelect,
    btnLoadLocalFonts,
    selectedFontFamily: "jetbrains",
    selectedLocalFontMatcher: "my font",
    supportsLocalFontPicker: false,
  });

  expect(fontFamilySelect.value).toBe("jetbrains");
  expect(fontFamilyLocalSelect.value).toBe("local:my%20font");
  expect(fontFamilyLocalSelect.disabled).toBe(true);
  expect(btnLoadLocalFonts.disabled).toBe(true);
});

test("syncHintingControls mirrors ligature and hinting state into controls", () => {
  const ligaturesSelect = { value: "" } as HTMLSelectElement;
  const fontHintingSelect = { value: "" } as HTMLSelectElement;
  const fontHintTargetSelect = { value: "", disabled: false } as HTMLSelectElement;

  syncHintingControls({
    ligaturesSelect,
    fontHintingSelect,
    fontHintTargetSelect,
    selectedLigatures: true,
    selectedFontHinting: false,
    selectedFontHintTarget: "normal",
  });

  expect(ligaturesSelect.value).toBe("on");
  expect(fontHintingSelect.value).toBe("off");
  expect(fontHintTargetSelect.value).toBe("normal");
  expect(fontHintTargetSelect.disabled).toBe(true);
});

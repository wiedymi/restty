import { expect, test } from "bun:test";
import {
  syncFontFamilyControls,
  syncHintingControls,
} from "../playground/lib/font-control-sync.ts";
import { resolveFontHintTarget } from "../playground/lib/font-controls.ts";
import {
  DENIED_LOCAL_FONT_HINT,
  DEFAULT_LOCAL_FONT_HINT,
  FONT_FAMILY_LOCAL_PREFIX,
  UNSUPPORTED_LOCAL_FONT_HINT,
  buildDetectedLocalFontOptions,
  detectLocalFontState,
  getDefaultLocalFontHintText,
  getLocalFontSelectValue,
  supportsLocalFontPicker,
} from "../playground/lib/font-local-picker.ts";

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

test("getLocalFontSelectValue encodes the selected matcher", () => {
  expect(getLocalFontSelectValue("")).toBe("");
  expect(getLocalFontSelectValue("my font")).toBe(`${FONT_FAMILY_LOCAL_PREFIX}my%20font`);
});

test("getDefaultLocalFontHintText follows picker support", () => {
  expect(getDefaultLocalFontHintText(true)).toBe(DEFAULT_LOCAL_FONT_HINT);
  expect(getDefaultLocalFontHintText(false)).toBe(UNSUPPORTED_LOCAL_FONT_HINT);
});

test("buildDetectedLocalFontOptions deduplicates and normalizes values", () => {
  expect(
    buildDetectedLocalFontOptions([
      { family: "  Fira Code  " },
      { family: "fira code" },
      { family: "" },
      { family: "JetBrains Mono" },
    ]),
  ).toEqual([
    { value: `${FONT_FAMILY_LOCAL_PREFIX}fira%20code`, label: "Local Font: Fira Code" },
    {
      value: `${FONT_FAMILY_LOCAL_PREFIX}jetbrains%20mono`,
      label: "Local Font: JetBrains Mono",
    },
  ]);
});

test("detectLocalFontState returns detected options and success hint", async () => {
  await expect(
    detectLocalFontState({
      queryLocalFonts: async () => [{ family: "Fira Code" }, { family: "JetBrains Mono" }],
    }),
  ).resolves.toEqual({
    detectedOptions: [
      { value: `${FONT_FAMILY_LOCAL_PREFIX}fira%20code`, label: "Local Font: Fira Code" },
      {
        value: `${FONT_FAMILY_LOCAL_PREFIX}jetbrains%20mono`,
        label: "Local Font: JetBrains Mono",
      },
    ],
    hintText: "Detected 2 local font families.",
  });
});

test("detectLocalFontState reports unsupported and denied cases", async () => {
  await expect(
    detectLocalFontState({
      browserWindow: {},
      queryLocalFonts: null,
    }),
  ).resolves.toEqual({
    detectedOptions: [],
    hintText: UNSUPPORTED_LOCAL_FONT_HINT,
  });

  await expect(
    detectLocalFontState({
      queryLocalFonts: async () => {
        throw new Error("denied");
      },
    }),
  ).resolves.toEqual({
    detectedOptions: [],
    hintText: DENIED_LOCAL_FONT_HINT,
  });
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

import { expect, test } from "bun:test";
import { buildFontSourcesForSelection } from "../playground/lib/font-source-catalog.ts";

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

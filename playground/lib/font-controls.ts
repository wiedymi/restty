export type FontHintTarget = "auto" | "light" | "normal";

export function resolveFontHintTarget(value: string | null | undefined): FontHintTarget {
  if (value === "light" || value === "normal" || value === "auto") return value;
  return "auto";
}

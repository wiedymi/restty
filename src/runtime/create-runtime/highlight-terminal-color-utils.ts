import { colorToFloats, type ThemeTerminalColor } from "../../theme";
import type { Color } from "../../renderer";
import type { RuntimeTerminalColor } from "./highlight-terminal-color-utils.types";

export function runtimeTerminalColorFromTheme(value: ThemeTerminalColor): RuntimeTerminalColor {
  if (value === "cell-foreground") return { kind: "cell-foreground" };
  if (value === "cell-background") return { kind: "cell-background" };
  return {
    kind: "color",
    color: colorToFloats(value, 255),
  };
}

export function resolveHighlightBackgroundColor(
  value: RuntimeTerminalColor,
  cellFg: Color,
  cellBg: Color,
  inverse: boolean,
): Color {
  switch (value.kind) {
    case "color":
      return value.color;
    case "cell-foreground":
      return inverse ? cellBg : cellFg;
    case "cell-background":
      return inverse ? cellFg : cellBg;
  }
}

export function resolveHighlightForegroundColor(
  value: RuntimeTerminalColor,
  cellFg: Color,
  cellBg: Color,
  inverse: boolean,
): Color {
  switch (value.kind) {
    case "color":
      return value.color;
    case "cell-foreground":
      return inverse ? cellBg : cellFg;
    case "cell-background":
      return inverse ? cellFg : cellBg;
  }
}

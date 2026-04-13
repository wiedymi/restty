import type { Color } from "../../renderer";

export type RuntimeTerminalColor =
  | {
      kind: "color";
      color: Color;
    }
  | {
      kind: "cell-foreground";
    }
  | {
      kind: "cell-background";
    };

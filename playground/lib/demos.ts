import type { ResttyPaneApi } from "../../src/index.ts";
import {
  createBasicDemoPayload,
  createPaletteDemoPayload,
  createUnicodeDemoPayload,
} from "./demo-content.ts";
import { getActivePaneState, type PaneState } from "./pane-state.ts";

type DemoPane = Pick<ResttyPaneApi, "clearScreen" | "sendInput">;

export type PlaygroundDemoKind = "basic" | "palette" | "unicode" | "anim";

export function createDemoController(pane: DemoPane) {
  let timer = 0;

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  };

  const startAnimation = () => {
    stop();
    pane.clearScreen();
    const start = performance.now();
    let tick = 0;
    timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - start) / 1000;
      const spinner = ["|", "/", "-", "\\"][tick % 4];
      const cols = 80;
      const barWidth = Math.max(10, Math.min(60, cols - 20));
      const phase = (Math.sin(elapsed * 1.6) + 1) * 0.5;
      const fill = Math.floor(barWidth * phase);
      const bar = "█".repeat(fill) + " ".repeat(Math.max(0, barWidth - fill));

      const lines = [
        `restty demo: animation ${spinner}`,
        "",
        `time ${elapsed.toFixed(2)}s`,
        `progress [${bar}]`,
        "",
        "palette:",
        `  \x1b[38;5;45mcyan\x1b[0m \x1b[38;5;202morange\x1b[0m \x1b[38;5;118mgreen\x1b[0m \x1b[38;5;213mpink\x1b[0m`,
        "",
        "type to echo input below...",
        "",
      ];
      pane.sendInput(`\x1b[H\x1b[J${lines.join("\r\n")}`);
      tick += 1;
    }, 80);
  };

  const run = (kind: PlaygroundDemoKind | string) => {
    stop();
    switch (kind) {
      case "palette":
        pane.sendInput(createPaletteDemoPayload());
        break;
      case "unicode":
        pane.sendInput(createUnicodeDemoPayload());
        break;
      case "anim":
        startAnimation();
        break;
      case "basic":
      default:
        pane.sendInput(createBasicDemoPayload());
        break;
    }
  };

  return { run, stop };
}

export function stopPaneDemo(state: Pick<PaneState, "demos"> | null | undefined) {
  if (!state?.demos) return false;
  state.demos.stop();
  return true;
}

export function runActivePaneDemo(
  paneStates: Map<number, PaneState>,
  activePaneId: number | null,
  kind: PlaygroundDemoKind | string | null | undefined,
) {
  const state = getActivePaneState(paneStates, activePaneId);
  if (!state?.demos) return false;
  state.demos.run(kind ?? "basic");
  return true;
}

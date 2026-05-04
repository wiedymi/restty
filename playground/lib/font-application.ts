import type { ResttyPaneApi } from "../../src/index.ts";
import type { FontHintTarget } from "./font-controls.ts";
import { getCurrentFonts } from "./font-catalog.ts";

export type FontApplicationPane = Pick<
  ResttyPaneApi,
  "setLigatures" | "setFontHintTarget" | "setFontHinting"
>;

export type FontApplicationHost = {
  setFonts: (fonts: ReturnType<typeof getCurrentFonts>) => Promise<void>;
  forEachPane: (visitor: (pane: FontApplicationPane) => void) => void;
};

type FontsOptions = {
  host: FontApplicationHost;
  selectedFontFamily: string;
  selectedLocalFontMatcher: string;
  onError?: (error: unknown) => void;
};

type FontRenderingOptions = {
  host: FontApplicationHost;
  selectedLigatures: boolean;
  selectedFontHinting: boolean;
  selectedFontHintTarget: FontHintTarget;
};

export async function applyFontsToAllPanes(options: FontsOptions) {
  try {
    await options.host.setFonts(
      getCurrentFonts(options.selectedFontFamily, options.selectedLocalFontMatcher),
    );
  } catch (error) {
    options.onError?.(error);
  }
}

export function applyFontRenderingOptionsToAllPanes(options: FontRenderingOptions) {
  options.host.forEachPane((pane) => {
    pane.setLigatures(options.selectedLigatures);
    pane.setFontHintTarget(options.selectedFontHintTarget);
    pane.setFontHinting(options.selectedFontHinting);
  });
}

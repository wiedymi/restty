import type { ResttyPaneApi } from "../../src/index.ts";
import type { FontHintTarget } from "./font-controls.ts";
import { getCurrentFontSources } from "./font-source-catalog.ts";

export type FontApplicationPane = Pick<
  ResttyPaneApi,
  "setLigatures" | "setFontHintTarget" | "setFontHinting"
>;

export type FontApplicationHost = {
  setFontSources: (sources: ReturnType<typeof getCurrentFontSources>) => Promise<void>;
  forEachPane: (visitor: (pane: FontApplicationPane) => void) => void;
};

type FontSourcesOptions = {
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

export async function applyFontSourcesToAllPanes(options: FontSourcesOptions) {
  try {
    await options.host.setFontSources(
      getCurrentFontSources(options.selectedFontFamily, options.selectedLocalFontMatcher),
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

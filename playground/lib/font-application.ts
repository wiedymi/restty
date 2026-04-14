import type { FontHintTarget } from "./font-controls.ts";
import { getCurrentFontSources } from "./font-source-catalog.ts";

export type FontApplicationHost = {
  setFontSources: (sources: ReturnType<typeof getCurrentFontSources>) => Promise<void>;
  getPanes: () => Array<{
    runtime: {
      terminal: {
        setLigatures: (value: boolean) => void;
        setFontHintTarget: (value: FontHintTarget) => void;
        setFontHinting: (value: boolean) => void;
      };
    };
  }>;
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
  const panes = options.host.getPanes();
  for (let i = 0; i < panes.length; i += 1) {
    const pane = panes[i];
    pane.runtime.terminal.setLigatures(options.selectedLigatures);
    pane.runtime.terminal.setFontHintTarget(options.selectedFontHintTarget);
    pane.runtime.terminal.setFontHinting(options.selectedFontHinting);
  }
}

import { createPaneSearchUiController, type PaneSearchUiController } from "../pane-search-ui";
import type { ResttyManagedPane, ResttyManagedPaneSearchUiOptions } from "./managed-pane-types";

export type CreateManagedPaneSearchUiControllerOptions = {
  root: HTMLElement;
  searchUi?: boolean | ResttyManagedPaneSearchUiOptions;
  getActivePane: () => ResttyManagedPane | null;
  getFocusedPane: () => ResttyManagedPane | null;
};

export function createManagedPaneSearchUiController(
  options: CreateManagedPaneSearchUiControllerOptions,
): PaneSearchUiController {
  const searchUiConfig =
    typeof options.searchUi === "object" && options.searchUi ? options.searchUi : undefined;

  return createPaneSearchUiController({
    root: options.root,
    enabled: options.searchUi === false ? false : (searchUiConfig?.enabled ?? true),
    placeholder: searchUiConfig?.placeholder,
    previousButtonText: searchUiConfig?.previousButtonText,
    nextButtonText: searchUiConfig?.nextButtonText,
    clearButtonText: searchUiConfig?.clearButtonText,
    closeButtonText: searchUiConfig?.closeButtonText,
    statusFormatter: searchUiConfig?.statusFormatter,
    shortcut: searchUiConfig?.shortcut,
    styles: searchUiConfig?.styles,
    getActivePane: options.getActivePane,
    getFocusedPane: options.getFocusedPane,
  });
}

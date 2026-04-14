import type {
  ResttyManagedPaneManager,
  ResttyManagedPane,
  ResttyManagedPaneStyleOptions,
  ResttyManagedPaneSearchUiStyleOptions,
} from "../panes/managed-pane-types";
import type { ResttyPaneManager } from "../panes/types";

export function getPaneStyleOptions(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
): Readonly<Required<ResttyManagedPaneStyleOptions>> {
  return paneManager.getStyleOptions();
}

export function setPaneStyleOptions(
  paneManager: ResttyPaneManager<ResttyManagedPane>,
  options: ResttyManagedPaneStyleOptions,
): void {
  paneManager.setStyleOptions(options);
}

export function getSearchUiStyleOptions(
  paneManager: Pick<ResttyManagedPaneManager, "getSearchUiStyleOptions">,
): Readonly<Required<ResttyManagedPaneSearchUiStyleOptions>> {
  return paneManager.getSearchUiStyleOptions();
}

export function setSearchUiStyleOptions(
  paneManager: Pick<ResttyManagedPaneManager, "setSearchUiStyleOptions">,
  options: ResttyManagedPaneSearchUiStyleOptions,
): void {
  paneManager.setSearchUiStyleOptions(options);
}

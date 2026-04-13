import type { ResttyPaneContextMenuOptions, ResttyPaneShortcutsOptions } from "./types";
import type { ResttyDefaultPaneContextMenuOptions, ResttyManagedPane } from "./managed-pane-types";

export type ManagedPaneContextMenuResolutionOptions = {
  contextMenu?: ResttyPaneContextMenuOptions<ResttyManagedPane> | null;
  defaultContextMenu?: boolean | ResttyDefaultPaneContextMenuOptions;
};

export type ManagedPaneShortcutResolutionOptions = boolean | ResttyPaneShortcutsOptions | undefined;

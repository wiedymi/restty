import type { DesktopNotification } from "../../input";
import type { ResttyManagedAppPane } from "../panes/managed-pane-types";
import type { ResttyPaneSplitDirection } from "../panes-types";

export type ResttySurfaceEvents = {
  onPaneCreated?: (pane: ResttyManagedAppPane) => void;
  onPaneClosed?: (pane: ResttyManagedAppPane) => void;
  onPaneSplit?: (
    sourcePane: ResttyManagedAppPane,
    createdPane: ResttyManagedAppPane,
    direction: ResttyPaneSplitDirection,
  ) => void;
  onActivePaneChange?: (pane: ResttyManagedAppPane | null) => void;
  onLayoutChanged?: () => void;
  /** Global handler for desktop notifications emitted by any pane. */
  onDesktopNotification?: (notification: DesktopNotification & { paneId: number }) => void;
};

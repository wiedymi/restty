import type { DesktopNotification } from "../../input";
import type { ResttyManagedPane } from "../panes/managed-pane-types";
import type { ResttyPaneSplitDirection } from "../panes/types";

export type ResttySurfaceEvents = {
  onPaneCreated?: (pane: ResttyManagedPane) => void;
  onPaneClosed?: (pane: ResttyManagedPane) => void;
  onPaneSplit?: (
    sourcePane: ResttyManagedPane,
    createdPane: ResttyManagedPane,
    direction: ResttyPaneSplitDirection,
  ) => void;
  onActivePaneChange?: (pane: ResttyManagedPane | null) => void;
  onLayoutChanged?: () => void;
  /** Global handler for desktop notifications emitted by any pane. */
  onDesktopNotification?: (notification: DesktopNotification & { paneId: number }) => void;
};

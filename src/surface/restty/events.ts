import type { DesktopNotification } from "../../input";
import type { ResttyPaneSplitDirection, ResttyPaneWithRuntime } from "../panes/types";

export type ResttySurfacePane = ResttyPaneWithRuntime;

export type ResttySurfaceEvents = {
  onPaneCreated?: (pane: ResttySurfacePane) => void;
  onPaneClosed?: (pane: ResttySurfacePane) => void;
  onPaneSplit?: (
    sourcePane: ResttySurfacePane,
    createdPane: ResttySurfacePane,
    direction: ResttyPaneSplitDirection,
  ) => void;
  onActivePaneChange?: (pane: ResttySurfacePane | null) => void;
  onLayoutChanged?: () => void;
  /** Global handler for desktop notifications emitted by any pane. */
  onDesktopNotification?: (notification: DesktopNotification & { paneId: number }) => void;
};
